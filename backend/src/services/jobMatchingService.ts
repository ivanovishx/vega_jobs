import { prisma } from '../db/prisma';
import { candidateProfileService } from './candidateProfileService';
import { scoringService, CandidateProfileData } from './scoringService';
import { keywordDictionaryService } from './keywordDictionaryService';
import { ParsedJD } from './jdParserService';

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
  const split = Math.ceil(skills.length * 0.7);

  return {
    title: job.jobTitle ?? undefined,
    company: job.company ?? undefined,
    workMode: inferWorkMode(job.location),
    requiredSkills: skills.slice(0, split),
    preferredSkills: skills.slice(split),
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

    const profileData: CandidateProfileData = {
      targetRoles: profile.targetRoles,
      targetLocations: profile.targetLocations,
      workAuthorization: profile.workAuthorization,
      yearsOfExperience: profile.yearsOfExperience,
      seniorityLevel: (profile as any).seniorityLevel ?? null,
      educationLevel: (profile as any).educationLevel ?? null,
      coreSkills: profile.coreSkills,
      tools: (profile as any).tools ?? [],
      domainExperience: profile.domainExperience,
      preferredWorkMode: profile.preferredWorkMode,
    };

    const rows = await prisma.$queryRaw<JobListingRow[]>`
      SELECT id::text, company, "jobTitle", location, "jobUrl", "scrapedAt",
             skills, requirements, description
      FROM "JobListings"
    `;

    const results = rows.map(job => {
      const parsedJD = buildParsedJD(job);
      const score = scoringService.score(parsedJD, profileData);
      return {
        id: job.id,
        company: job.company,
        jobTitle: job.jobTitle,
        location: job.location,
        jobUrl: job.jobUrl,
        scrapedAt: job.scrapedAt,
        matchScore: score.overallScore,
        matchBreakdown: {
          requiredSkills: score.requiredSkillsScore,
          experience: score.experienceScore,
          domain: score.domainScore,
          seniority: score.seniorityScore,
          education: score.educationScore,
          location: score.locationScore,
          visa: score.visaScore,
          bonusSkills: score.bonusSkillsScore,
        },
        matchedKeywords: score.matchedKeywords,
        missingKeywords: score.missingKeywords,
      };
    });

    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  },
};
