import { prisma } from '../db/prisma';
import { candidateProfileService } from './candidateProfileService';
import { scoringService, CandidateProfileData } from './scoringService';
import { keywordDictionaryService } from './keywordDictionaryService';
import { skillExtractionService } from './skillExtractionService';
import { textSimilarityService } from './textSimilarityService';
import { ParsedJD } from './jdParserService';

// TF-IDF cosine between long documents is small in absolute terms even for a
// strong match, so we scale each job's cosine relative to the best match in the
// candidate's own corpus. The FLOOR stops that from inflating pure noise: when
// even the best match is weak, everyone stays low instead of the top being
// stretched to 100%. Tunable.
const CONTENT_SIMILARITY_FLOOR = 0.15;

interface JobListingRow {
  id: string;
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  jobUrl: string | null;
  scrapedAt: Date | null;
  skills: string[] | null;
  requirements: string[] | null;
  description: string | null;
}

function inferWorkMode(location: string | null): ParsedJD['workMode'] {
  if (!location) return 'unknown';
  const l = location.toLowerCase();
  if (l.includes('remote') || l.includes('virtual')) return 'remote';
  if (l.includes('hybrid')) return 'hybrid';
  if (l.includes('onsite') || l.includes('in office')) return 'onsite';
  return 'unknown';
}

function extractYearsOfExperience(requirements: string[]): number | undefined {
  const text = requirements.join(' ').toLowerCase();
  const match = text.match(/(\d+)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/);
  return match ? parseInt(match[1], 10) : undefined;
}

function extractVisaLanguage(requirements: string[]): string[] {
  const text = requirements.join(' ').toLowerCase();
  return keywordDictionaryService.getVisaKeywords().filter(v => text.includes(v));
}

function buildParsedJD(job: JobListingRow): ParsedJD {
  const skills = job.skills ?? [];
  const requirements = job.requirements ?? [];

  // The scraper stores skills/requirements as free-form bullet lines, not tokens.
  // Extract canonical skills from all the job text so scoring compares like with
  // like (the old 70/30 slice of raw lines was arbitrary and never matched).
  const jobText = [...skills, ...requirements, job.description ?? '', job.jobTitle ?? ''].join('\n');
  const requiredSkills = skillExtractionService.extractSkills(jobText);

  return {
    title: job.jobTitle ?? undefined,
    company: job.company ?? undefined,
    workMode: inferWorkMode(job.location),
    requiredSkills,
    // We have no reliable required-vs-preferred signal, so we don't fabricate one.
    preferredSkills: [],
    // domainKeywords left empty — domain scoring now uses direct text match in scoringService
    domainKeywords: [],
    yearsOfExperience: extractYearsOfExperience(requirements),
    visaLanguage: extractVisaLanguage(requirements),
    riskFlags: [],
    tools: [],
    responsibilities: requirements,
  };
}

export const jobMatchingService = {
  async getMatches(userId: string) {
    const profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) return null;

    // Single source of truth for skills: the user's curated coreSkills plus the
    // skills extracted from their resume (resumeKeywords). This keeps the web
    // "Match Mode" and the Chrome extension Match Score working off the same set.
    const resumeKeywords: string[] = (profile as any).resumeKeywords ?? [];
    const resumeText: string = (profile as any).resumeText ?? '';
    const coreSkills = Array.from(new Set([...profile.coreSkills, ...resumeKeywords]));

    // Nothing to match against at all: no skills, no target roles, no domain and
    // no resume text. Any score would be pure neutral filler, so prompt the user
    // to fill in their profile instead of showing phantom "matches".
    const hasProfileData =
      coreSkills.length > 0 ||
      profile.targetRoles.length > 0 ||
      profile.domainExperience.length > 0 ||
      resumeText.trim().length > 0;
    if (!hasProfileData) return { empty: true as const };

    const profileData: CandidateProfileData = {
      targetRoles: profile.targetRoles,
      targetLocations: profile.targetLocations,
      workAuthorization: profile.workAuthorization,
      yearsOfExperience: profile.yearsOfExperience,
      seniorityLevel: (profile as any).seniorityLevel ?? null,
      educationLevel: (profile as any).educationLevel ?? null,
      coreSkills,
      tools: (profile as any).tools ?? [],
      domainExperience: profile.domainExperience,
      preferredWorkMode: profile.preferredWorkMode,
    };

    const rows = await prisma.$queryRaw<JobListingRow[]>`
      SELECT id::text, company, "jobTitle", location, "jobUrl", "scrapedAt",
             skills, requirements, description
      FROM "JobListings"
    `;

    // Build the candidate "document" and one document per job, then compute a
    // TF-IDF index over the job corpus. This is the content-similarity signal —
    // it works even for jobs where the skill dictionary found nothing.
    const candidateTokens = textSimilarityService.tokenize([
      resumeText,
      ...resumeKeywords,
      ...profile.coreSkills,
      ...profile.targetRoles,
      ...profile.domainExperience,
    ].join(' '));

    const parsedList = rows.map(buildParsedJD);
    const jobTokensList = rows.map(job =>
      textSimilarityService.tokenize([
        job.jobTitle ?? '',
        ...(job.skills ?? []),
        ...(job.requirements ?? []),
        job.description ?? '',
      ].join(' '))
    );

    const idf = textSimilarityService.buildIdf(jobTokensList);
    const scoreSimilarity = textSimilarityService.makeScorer(candidateTokens, idf, jobTokensList.length);

    // Cosine of every job against the candidate, then normalize relative to the
    // best one so the strongest content match reads as ~full and the rest are
    // proportional — fixing the compression where every real match looked weak.
    const cosines = jobTokensList.map(toks =>
      candidateTokens.length > 0 && toks.length > 0 ? scoreSimilarity(toks) : null
    );
    const maxCosine = Math.max(0, ...cosines.filter((c): c is number => c !== null));
    const contentDenom = Math.max(maxCosine, CONTENT_SIMILARITY_FLOOR);

    const results = rows.map((job, i) => {
      const parsedJD = parsedList[i];
      const cosine = cosines[i];
      const contentSimilarity = cosine === null ? null : Math.min(1, cosine / contentDenom);
      const score = scoringService.score(parsedJD, profileData, { contentSimilarity });
      return {
        id: job.id,
        company: job.company,
        jobTitle: job.jobTitle,
        location: job.location,
        jobUrl: job.jobUrl,
        scrapedAt: job.scrapedAt,
        matchScore: score.overallScore,
        matchBreakdown: score.breakdown,
        matchedKeywords: score.matchedKeywords,
        missingKeywords: score.missingKeywords,
        confidence: score.confidence,
      };
    });

    // Best score first; when scores tie, prefer the listing we're more confident
    // about (more of its score came from real data rather than neutral filler).
    results.sort((a, b) => (b.matchScore - a.matchScore) || (b.confidence - a.confidence));
    return results;
  },
};
