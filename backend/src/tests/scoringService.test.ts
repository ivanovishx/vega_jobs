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
      domainExperience: ['robotics']
    };

    const result = scoringService.score(parsedJd, profile);
    
    expect(result.requiredSkillsScore).toBe(35);
    expect(result.experienceScore).toBe(25);
    expect(result.domainScore).toBe(15);
    expect(result.bonusSkillsScore).toBe(5);
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
      domainExperience: []
    };

    const result = scoringService.score(parsedJd, profile);
    
    // 25 - (3 * 5) = 10
    expect(result.experienceScore).toBe(10);
  });
});
