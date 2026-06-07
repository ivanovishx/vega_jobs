import { ParsedJD } from './jdParserService';

export interface CandidateProfileData {
  targetRoles: string[];
  targetLocations: string[];
  workAuthorization?: string | null;
  yearsOfExperience: number;
  coreSkills: string[];
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
  explanation: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  riskFlags: string[];
}

export const scoringService = {
  score(parsedJd: ParsedJD, profile: CandidateProfileData): ScoreResult {
    // Weights
    // Required skills match: 35%
    // Relevant experience: 25%
    // Domain fit: 15%
    // Seniority fit: 10%
    // Location/work mode fit: 5%
    // Visa/work authorization fit: 5%
    // Bonus/preferred skills: 5%

    let explanation = '';
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    // 1. Required Skills (35%)
    let requiredSkillsScore = 0;
    if (parsedJd.requiredSkills.length > 0) {
      const matchedSkills = parsedJd.requiredSkills.filter(skill => profile.coreSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase()));
      matchedKeywords.push(...matchedSkills);
      missingKeywords.push(...parsedJd.requiredSkills.filter(skill => !matchedSkills.includes(skill)));
      requiredSkillsScore = Math.round((matchedSkills.length / parsedJd.requiredSkills.length) * 35);
    } else {
      requiredSkillsScore = 35; // default if none specified
    }

    // 2. Experience (25%)
    let experienceScore = 0;
    if (parsedJd.yearsOfExperience !== undefined) {
      if (profile.yearsOfExperience >= parsedJd.yearsOfExperience) {
        experienceScore = 25;
        explanation += `Meets or exceeds the ${parsedJd.yearsOfExperience}+ years of experience required. `;
      } else {
        const deficit = parsedJd.yearsOfExperience - profile.yearsOfExperience;
        experienceScore = Math.max(0, 25 - (deficit * 5));
        explanation += `Slightly below the ${parsedJd.yearsOfExperience}+ years experience requirement. `;
      }
    } else {
      experienceScore = 25; // default if not specified
    }

    // 3. Domain Fit (15%)
    let domainScore = 0;
    if (parsedJd.domainKeywords.length > 0) {
      const matchedDomains = parsedJd.domainKeywords.filter(d => profile.domainExperience.map(p => p.toLowerCase()).includes(d.toLowerCase()));
      matchedKeywords.push(...matchedDomains);
      domainScore = Math.round((matchedDomains.length / parsedJd.domainKeywords.length) * 15);
    } else {
      domainScore = 15;
    }

    // 4. Seniority Fit (10%)
    let seniorityScore = 10; // Simplification for MVP

    // 5. Location/Work Mode Fit (5%)
    let locationScore = 0;
    if (parsedJd.workMode && profile.preferredWorkMode && parsedJd.workMode.toLowerCase() === profile.preferredWorkMode.toLowerCase()) {
      locationScore = 5;
    } else if (parsedJd.workMode === 'unknown') {
      locationScore = 3;
    }

    // 6. Visa Fit (5%)
    let visaScore = 5;
    if (parsedJd.visaLanguage.some(v => v.includes('no sponsorship') || v.includes('no c2c'))) {
      if (profile.workAuthorization && profile.workAuthorization.toLowerCase().includes('need sponsorship')) {
         visaScore = 0;
         explanation += `This role may not offer visa sponsorship. `;
      }
    }

    // 7. Bonus Skills (5%)
    let bonusSkillsScore = 0;
    if (parsedJd.preferredSkills.length > 0) {
       const matchedBonus = parsedJd.preferredSkills.filter(skill => profile.coreSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase()));
       matchedKeywords.push(...matchedBonus);
       bonusSkillsScore = Math.round((matchedBonus.length / parsedJd.preferredSkills.length) * 5);
    } else {
      bonusSkillsScore = 5;
    }

    const overallScore = requiredSkillsScore + experienceScore + domainScore + seniorityScore + locationScore + visaScore + bonusSkillsScore;

    return {
      overallScore,
      requiredSkillsScore,
      experienceScore,
      domainScore,
      seniorityScore,
      locationScore,
      visaScore,
      bonusSkillsScore,
      explanation,
      matchedKeywords: [...new Set(matchedKeywords)],
      missingKeywords: [...new Set(missingKeywords)],
      riskFlags: parsedJd.riskFlags
    };
  }
};
