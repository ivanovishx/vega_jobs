import { describe, it, expect } from 'vitest';
import { scoringService } from '../services/scoringService';

describe('scoringService', () => {
  it('should score a perfect match high', () => {
    const parsedJd = {
      requiredSkills: ['python', 'c++'],
      preferredSkills: ['rust'],
      yearsOfExperience: 5,
      domainKeywords: ['robotics'],
      tools: [],
      visaLanguage: [],
      riskFlags: [],
      responsibilities: []
    };

    const profile = {
      targetRoles: ['TPM'],
      targetLocations: [],
      yearsOfExperience: 6,
      coreSkills: ['python', 'c++', 'rust'],
      tools: [],
      domainExperience: ['robotics']
    };

    const result = scoringService.score(parsedJd, profile);

    // Weights: skills=30, experience=20, domain=15, bonus=5
    expect(result.requiredSkillsScore).toBe(30);  // 2/2 required matched
    expect(result.experienceScore).toBe(20);       // 6 >= 5
    expect(result.domainScore).toBe(15);           // 'robotics' in domainKeywords → matched
    expect(result.bonusSkillsScore).toBe(5);       // 1/1 preferred matched
    expect(result.overallScore).toBeGreaterThan(80);
  });

  it('should penalize for missing experience', () => {
    const parsedJd = {
      requiredSkills: [],
      preferredSkills: [],
      yearsOfExperience: 5,
      domainKeywords: [],
      tools: [],
      visaLanguage: [],
      riskFlags: [],
      responsibilities: []
    };

    const profile = {
      targetRoles: [],
      targetLocations: [],
      yearsOfExperience: 2, // 3 years deficit
      coreSkills: [],
      tools: [],
      domainExperience: []
    };

    const result = scoringService.score(parsedJd, profile);

    // W.experience=20, deficit=3, penalty=3*4=12 → 20-12=8
    expect(result.experienceScore).toBe(8);
  });
});
