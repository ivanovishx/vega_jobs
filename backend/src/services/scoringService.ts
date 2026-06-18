import { ParsedJD } from './jdParserService';

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

export interface ScoreResult {
  overallScore: number;
  requiredSkillsScore: number;
  experienceScore: number;
  domainScore: number;
  seniorityScore: number;
  locationScore: number;
  visaScore: number;
  bonusSkillsScore: number;
  educationScore: number;
  explanation: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  riskFlags: string[];
}

// Weights: must sum to 100
const W = {
  skills: 30,
  experience: 20,
  domain: 15,
  seniority: 10,
  education: 10,
  workMode: 5,
  visa: 5,
  bonusSkills: 5,
};

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

function inferSeniorityFromTitle(jobTitle: string | undefined): string | null {
  if (!jobTitle) return null;
  const t = jobTitle.toLowerCase();
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return level;
  }
  return 'Mid'; // default
}

function inferEducationFromRequirements(requirements: string[]): string | null {
  const text = requirements.join(' ').toLowerCase();
  // Check from highest to lowest — return the minimum required
  for (const level of [...EDUCATION_ORDER].reverse()) {
    const keywords = EDUCATION_KEYWORDS[level];
    if (keywords.some(k => text.includes(k))) return level;
  }
  return null;
}

function scoreSeniority(jobSeniority: string | null, candidateSeniority: string | null | undefined): number {
  if (!jobSeniority || !candidateSeniority) return Math.round(W.seniority * 0.5); // neutral
  const jobIdx = SENIORITY_ORDER.indexOf(jobSeniority);
  const candidateIdx = SENIORITY_ORDER.indexOf(candidateSeniority);
  if (jobIdx === -1 || candidateIdx === -1) return Math.round(W.seniority * 0.5);
  const diff = candidateIdx - jobIdx;
  if (diff === 0) return W.seniority;          // exact match
  if (diff === 1) return W.seniority;          // one above: still great
  if (diff === -1) return Math.round(W.seniority * 0.6); // one below: possible stretch
  if (diff >= 2) return Math.round(W.seniority * 0.3);   // overqualified
  return 0;                                               // too junior
}

function scoreEducation(required: string | null, candidate: string | null | undefined): number {
  if (!required) return W.education; // no requirement — full credit
  if (!candidate) return Math.round(W.education * 0.5); // unknown — neutral
  const reqIdx = EDUCATION_ORDER.indexOf(required);
  const canIdx = EDUCATION_ORDER.indexOf(candidate);
  if (canIdx >= reqIdx) return W.education;                        // meets or exceeds
  const deficit = reqIdx - canIdx;
  return Math.max(0, W.education - deficit * Math.round(W.education / 3));
}

export const scoringService = {
  score(parsedJd: ParsedJD, profile: CandidateProfileData): ScoreResult {
    let explanation = '';
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    // Combined candidate skills: coreSkills + tools
    const allCandidateSkills = [...profile.coreSkills, ...profile.tools].map(s => s.toLowerCase());

    // 1. Required Skills (30%)
    let requiredSkillsScore = 0;
    if (parsedJd.requiredSkills.length > 0) {
      const matched = parsedJd.requiredSkills.filter(s => allCandidateSkills.includes(s.toLowerCase()));
      const missing = parsedJd.requiredSkills.filter(s => !allCandidateSkills.includes(s.toLowerCase()));
      matchedKeywords.push(...matched);
      missingKeywords.push(...missing);
      requiredSkillsScore = Math.round((matched.length / parsedJd.requiredSkills.length) * W.skills);
    } else {
      requiredSkillsScore = W.skills;
    }

    // 2. Experience (20%)
    let experienceScore = 0;
    if (parsedJd.yearsOfExperience !== undefined) {
      if (profile.yearsOfExperience >= parsedJd.yearsOfExperience) {
        experienceScore = W.experience;
      } else {
        const deficit = parsedJd.yearsOfExperience - profile.yearsOfExperience;
        experienceScore = Math.max(0, W.experience - deficit * 4);
        explanation += `${parsedJd.yearsOfExperience}+ years required, you have ${profile.yearsOfExperience}. `;
      }
    } else {
      experienceScore = W.experience;
    }

    // 3. Domain Fit (15%) — direct match, no dictionary
    let domainScore = 0;
    if (profile.domainExperience.length > 0) {
      const jobText = [
        ...(parsedJd.requiredSkills),
        ...(parsedJd.preferredSkills),
        ...(parsedJd.domainKeywords),
        ...(parsedJd.responsibilities),
        parsedJd.title ?? '',
        parsedJd.company ?? '',
      ].join(' ').toLowerCase();

      const matchedDomains = profile.domainExperience.filter(d => jobText.includes(d.toLowerCase()));
      matchedKeywords.push(...matchedDomains);
      // Score proportional to how many of YOUR domains appear in the job (coverage)
      domainScore = Math.round((matchedDomains.length / profile.domainExperience.length) * W.domain);
    } else {
      domainScore = Math.round(W.domain * 0.5); // neutral if no domain set
    }

    // 4. Seniority (10%)
    const jobSeniority = inferSeniorityFromTitle(parsedJd.title);
    const seniorityScore = scoreSeniority(jobSeniority, profile.seniorityLevel);

    // 5. Education (10%)
    const requiredEdu = inferEducationFromRequirements(parsedJd.responsibilities);
    const educationScore = scoreEducation(requiredEdu, profile.educationLevel);

    // 6. Work Mode (5%)
    let locationScore = 0;
    if (parsedJd.workMode && profile.preferredWorkMode) {
      if (parsedJd.workMode.toLowerCase() === profile.preferredWorkMode.toLowerCase()) {
        locationScore = W.workMode;
      } else if (parsedJd.workMode === 'unknown') {
        locationScore = Math.round(W.workMode * 0.6);
      }
    } else if (!parsedJd.workMode || parsedJd.workMode === 'unknown') {
      locationScore = Math.round(W.workMode * 0.6);
    }

    // 7. Visa (5%)
    let visaScore = W.visa;
    if (parsedJd.visaLanguage.some(v => v.includes('no sponsorship') || v.includes('no c2c'))) {
      if (profile.workAuthorization?.toLowerCase().includes('need sponsorship')) {
        visaScore = 0;
        explanation += 'This role may not offer visa sponsorship. ';
      }
    }

    // 8. Bonus Skills (5%)
    let bonusSkillsScore = 0;
    if (parsedJd.preferredSkills.length > 0) {
      const matched = parsedJd.preferredSkills.filter(s => allCandidateSkills.includes(s.toLowerCase()));
      matchedKeywords.push(...matched);
      bonusSkillsScore = Math.round((matched.length / parsedJd.preferredSkills.length) * W.bonusSkills);
    } else {
      bonusSkillsScore = W.bonusSkills;
    }

    const overallScore = Math.min(
      100,
      requiredSkillsScore + experienceScore + domainScore + seniorityScore +
      educationScore + locationScore + visaScore + bonusSkillsScore
    );

    return {
      overallScore,
      requiredSkillsScore,
      experienceScore,
      domainScore,
      seniorityScore,
      educationScore,
      locationScore,
      visaScore,
      bonusSkillsScore,
      explanation,
      matchedKeywords: [...new Set(matchedKeywords)],
      missingKeywords: [...new Set(missingKeywords)],
      riskFlags: parsedJd.riskFlags,
    };
  },
};
