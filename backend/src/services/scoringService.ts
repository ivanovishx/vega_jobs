import { ParsedJD } from './jdParserService';
import { skillExtractionService } from './skillExtractionService';
import { tokenize } from './textSimilarityService';

export interface CandidateProfileData {
  targetRoles: string[];
  targetLocations: string[];
  workAuthorization?: string | null;
  yearsOfExperience: number;
  seniorityLevel?: string | null;
  educationLevel?: string | null;
  coreSkills: string[];
  tools: string[];
  domainExperience: string[];
  preferredWorkMode?: string | null;
}

export interface ScoreBreakdown {
  contentSimilarity: number;
  titleMatch: number;
  requiredSkills: number;
  experience: number;
  seniority: number;
  education: number;
  domain: number;
  workMode: number;
  visa: number;
}

export interface ScoreResult {
  overallScore: number;
  // 0–1: share of the total weight that was backed by real data from the job
  // posting (not neutral filler). Low = we're guessing more than measuring.
  confidence: number;
  breakdown: ScoreBreakdown;
  explanation: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  riskFlags: string[];
}

// Weights per signal — must sum to 100. No single signal dominates, so a job
// with, say, no parseable skills can still score well on title + content.
export const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  contentSimilarity: 30,
  titleMatch: 20,
  requiredSkills: 20,
  experience: 10,
  seniority: 8,
  education: 6,
  domain: 3,
  workMode: 2,
  visa: 1,
};

// When a signal has no data (the posting didn't provide it, or the profile
// can't be compared on it) we neither reward nor punish — we fill it at this
// neutral fraction of its weight. Missing data therefore pulls the score toward
// the middle, never to 0 or 100.
const NEUTRAL_FILL = 0.5;

// A job whose only recognized skill is, say, "Manufacturing" would otherwise
// give a full skills score to anyone who happens to list that one word. Divide
// matches by at least this many skills so thin evidence can't reach 100%.
const MIN_JOB_SKILLS = 3;

const SENIORITY_KEYWORDS: Record<string, string[]> = {
  Junior:    ['junior', 'entry', 'entry-level', 'associate', 'new grad', 'graduate'],
  Mid:       ['mid', 'mid-level', 'ii ', ' ii,', 'intermediate'],
  Senior:    ['senior', 'sr.', 'sr ', 'lead'],
  Staff:     ['staff'],
  Principal: ['principal'],
  Director:  ['director', 'head of'],
  Executive: ['vp ', 'vice president', 'cto', 'ceo', 'chief'],
};

const SENIORITY_ORDER = ['Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Director', 'Executive'];

const EDUCATION_KEYWORDS: Record<string, string[]> = {
  "High School":  ['high school', 'ged'],
  "Associate":    ["associate's", 'associate degree', 'aa ', 'as '],
  "Bachelor's":   ["bachelor's", 'bachelor', 'bs ', 'b.s.', 'bs,', 'be ', 'b.e.', 'ba ', 'b.a.', 'undergraduate'],
  "Master's":     ["master's", 'master', 'ms ', 'm.s.', 'ms,', 'mba', 'm.b.a.', 'meng', 'm.eng'],
  "PhD":          ['phd', 'ph.d', 'doctorate', 'doctoral'],
};

const EDUCATION_ORDER = ["High School", "Associate", "Bachelor's", "Master's", "PhD"];

// Returns the seniority the title signals, or null when the title says nothing.
function inferSeniorityFromTitle(jobTitle: string | undefined): string | null {
  if (!jobTitle) return null;
  const t = jobTitle.toLowerCase();
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return level;
  }
  return null;
}

function inferEducationFromRequirements(requirements: string[]): string | null {
  const text = requirements.join(' ').toLowerCase();
  for (const level of [...EDUCATION_ORDER].reverse()) {
    const keywords = EDUCATION_KEYWORDS[level];
    if (keywords.some(k => text.includes(k))) return level;
  }
  return null;
}

// Each signal reports a value in [0,1], or null when it has no data.
function scoreSeniority(jobSeniority: string | null, candidateSeniority: string | null | undefined): number | null {
  if (!jobSeniority || !candidateSeniority) return null;
  const jobIdx = SENIORITY_ORDER.indexOf(jobSeniority);
  const candidateIdx = SENIORITY_ORDER.indexOf(candidateSeniority);
  if (jobIdx === -1 || candidateIdx === -1) return null;
  const diff = candidateIdx - jobIdx;
  if (diff === 0) return 1;      // exact match
  if (diff === 1) return 1;      // one above: still great
  if (diff === -1) return 0.6;   // one below: stretch
  if (diff >= 2) return 0.3;     // overqualified
  return 0;                       // too junior
}

function scoreEducation(required: string | null, candidate: string | null | undefined): number | null {
  if (!required) return null;                 // no requirement stated → no signal
  if (!candidate) return null;                // candidate hasn't told us → no signal
  const reqIdx = EDUCATION_ORDER.indexOf(required);
  const canIdx = EDUCATION_ORDER.indexOf(candidate);
  if (reqIdx === -1 || canIdx === -1) return null;
  if (canIdx >= reqIdx) return 1;             // meets or exceeds
  const deficit = reqIdx - canIdx;
  return Math.max(0, 1 - deficit / 3);
}

// Token-overlap between the job title and the candidate's target roles.
function scoreTitleMatch(title: string | undefined, targetRoles: string[]): number | null {
  const titleTokens = new Set(tokenize(title ?? ''));
  const roleTokenLists = targetRoles.map(r => tokenize(r)).filter(toks => toks.length > 0);
  if (titleTokens.size === 0 || roleTokenLists.length === 0) return null;
  // Best-matching target role: fraction of its tokens present in the title.
  return Math.max(
    ...roleTokenLists.map(roleTokens => roleTokens.filter(t => titleTokens.has(t)).length / roleTokens.length)
  );
}

export interface ScoreExtras {
  // Precomputed TF-IDF cosine (already scaled to 0–1) — supplied by the caller
  // because it needs the whole job corpus to compute IDF. null when unavailable.
  contentSimilarity?: number | null;
}

export const scoringService = {
  score(parsedJd: ParsedJD, profile: CandidateProfileData, extras: ScoreExtras = {}): ScoreResult {
    let explanation = '';
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    // Candidate skills, canonicalized so free-text lines up with the dictionary.
    const candidateSkillSet = new Set(
      [...profile.coreSkills, ...profile.tools]
        .map(s => skillExtractionService.canonicalize(s))
        .filter((s): s is string => !!s)
    );

    // ── Signal: required skills (dictionary overlap) ──
    let skillsValue: number | null;
    const jobSkills = Array.from(new Set(
      parsedJd.requiredSkills
        .map(s => skillExtractionService.canonicalize(s))
        .filter((s): s is string => !!s)
    ));
    if (jobSkills.length > 0) {
      const matched = jobSkills.filter(s => candidateSkillSet.has(s));
      const missing = jobSkills.filter(s => !candidateSkillSet.has(s));
      matchedKeywords.push(...matched);
      missingKeywords.push(...missing);
      skillsValue = matched.length / Math.max(jobSkills.length, MIN_JOB_SKILLS);
    } else {
      skillsValue = null; // job listed no recognizable skills — no signal
    }

    // ── Signal: experience ──
    let experienceValue: number | null;
    if (parsedJd.yearsOfExperience === undefined) {
      experienceValue = null;
    } else if (profile.yearsOfExperience >= parsedJd.yearsOfExperience) {
      experienceValue = 1;
    } else {
      const deficit = parsedJd.yearsOfExperience - profile.yearsOfExperience;
      experienceValue = Math.max(0, 1 - deficit * 0.2); // ~20% per missing year
      explanation += `${parsedJd.yearsOfExperience}+ years required, you have ${profile.yearsOfExperience}. `;
    }

    // ── Signal: domain fit (direct text match) ──
    let domainValue: number | null;
    if (profile.domainExperience.length > 0) {
      const jobText = [
        ...parsedJd.requiredSkills,
        ...parsedJd.preferredSkills,
        ...parsedJd.domainKeywords,
        ...parsedJd.responsibilities,
        parsedJd.title ?? '',
        parsedJd.company ?? '',
      ].join(' ').toLowerCase();
      const matchedDomains = profile.domainExperience.filter(d => jobText.includes(d.toLowerCase()));
      matchedKeywords.push(...matchedDomains);
      domainValue = matchedDomains.length / profile.domainExperience.length;
    } else {
      domainValue = null;
    }

    // ── Signal: seniority ──
    const seniorityValue = scoreSeniority(inferSeniorityFromTitle(parsedJd.title), profile.seniorityLevel);

    // ── Signal: education ──
    const educationValue = scoreEducation(inferEducationFromRequirements(parsedJd.responsibilities), profile.educationLevel);

    // ── Signal: work mode ──
    let workModeValue: number | null;
    if (!parsedJd.workMode || parsedJd.workMode === 'unknown' || !profile.preferredWorkMode) {
      workModeValue = null;
    } else {
      workModeValue = parsedJd.workMode.toLowerCase() === profile.preferredWorkMode.toLowerCase() ? 1 : 0;
    }

    // ── Signal: visa ──
    let visaValue: number | null;
    if (parsedJd.visaLanguage.length === 0) {
      visaValue = null;
    } else if (parsedJd.visaLanguage.some(v => v.includes('no sponsorship') || v.includes('no c2c'))
               && profile.workAuthorization?.toLowerCase().includes('need sponsorship')) {
      visaValue = 0;
      explanation += 'This role may not offer visa sponsorship. ';
    } else {
      visaValue = 1;
    }

    // ── Signal: title ↔ target roles ──
    const titleValue = scoreTitleMatch(parsedJd.title, profile.targetRoles);

    // ── Signal: content similarity (supplied by caller) ──
    const contentValue = extras.contentSimilarity ?? null;

    // ── Blend all signals with graceful degradation ──
    const values: Record<keyof ScoreBreakdown, number | null> = {
      contentSimilarity: contentValue,
      titleMatch: titleValue,
      requiredSkills: skillsValue,
      experience: experienceValue,
      seniority: seniorityValue,
      education: educationValue,
      domain: domainValue,
      workMode: workModeValue,
      visa: visaValue,
    };

    const breakdown = {} as ScoreBreakdown;
    let totalWeight = 0;
    let availableWeight = 0;
    for (const key of Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]) {
      const weight = WEIGHTS[key];
      const value = values[key];
      totalWeight += weight;
      if (value === null) {
        breakdown[key] = Math.round(NEUTRAL_FILL * weight);
      } else {
        breakdown[key] = Math.round(value * weight);
        availableWeight += weight;
      }
    }

    const overallScore = (Object.values(breakdown) as number[]).reduce((a, b) => a + b, 0);
    const confidence = totalWeight === 0 ? 0 : availableWeight / totalWeight;

    return {
      overallScore: Math.min(100, overallScore),
      confidence,
      breakdown,
      explanation,
      matchedKeywords: [...new Set(matchedKeywords)],
      missingKeywords: [...new Set(missingKeywords)],
      riskFlags: parsedJd.riskFlags,
    };
  },
};
