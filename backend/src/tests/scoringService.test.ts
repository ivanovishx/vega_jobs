import { describe, it, expect } from 'vitest';
import { scoringService, WEIGHTS } from '../services/scoringService';

// Minimal builders so each test only states what it cares about.
const jd = (over: any = {}) => ({
  title: undefined,
  company: undefined,
  workMode: 'unknown',
  requiredSkills: [],
  preferredSkills: [],
  domainKeywords: [],
  yearsOfExperience: undefined,
  visaLanguage: [],
  riskFlags: [],
  tools: [],
  responsibilities: [],
  ...over,
});

const profile = (over: any = {}) => ({
  targetRoles: [],
  targetLocations: [],
  workAuthorization: null,
  yearsOfExperience: 0,
  seniorityLevel: null,
  educationLevel: null,
  coreSkills: [],
  tools: [],
  domainExperience: [],
  preferredWorkMode: null,
  ...over,
});

describe('scoringService (multi-signal)', () => {
  it('gives full credit for a complete skills overlap', () => {
    const result = scoringService.score(
      jd({ requiredSkills: ['python', 'c++', 'rust'] }) as any,
      profile({ coreSkills: ['python', 'c++', 'rust'] }) as any,
    );
    expect(result.breakdown.requiredSkills).toBe(WEIGHTS.requiredSkills); // 3/3 matched
    expect(result.matchedKeywords).toEqual(expect.arrayContaining(['Python', 'C++', 'Rust']));
  });

  it('damps the skills score when the job lists too few skills to be reliable', () => {
    // Only one recognized skill → matching it should not reach a full score.
    const result = scoringService.score(
      jd({ requiredSkills: ['manufacturing'] }) as any,
      profile({ coreSkills: ['manufacturing'] }) as any,
    );
    expect(result.breakdown.requiredSkills).toBe(Math.round(WEIGHTS.requiredSkills / 3)); // 1/3
  });

  it('passes through the content-similarity signal', () => {
    const result = scoringService.score(jd() as any, profile() as any, { contentSimilarity: 1 });
    expect(result.breakdown.contentSimilarity).toBe(WEIGHTS.contentSimilarity);
  });

  it('scores title against target roles even with no skills', () => {
    const result = scoringService.score(
      jd({ title: 'Senior Product Manager' }) as any,
      profile({ targetRoles: ['Product Manager'] }) as any,
    );
    expect(result.breakdown.titleMatch).toBe(WEIGHTS.titleMatch); // both role tokens present
    expect(result.breakdown.requiredSkills).toBe(Math.round(WEIGHTS.requiredSkills * 0.5)); // no data → neutral
  });

  it('penalizes an experience deficit but does not zero it', () => {
    const result = scoringService.score(
      jd({ yearsOfExperience: 5 }) as any,
      profile({ yearsOfExperience: 2 }) as any, // 3-year deficit → 1 - 0.6 = 0.4
    );
    expect(result.breakdown.experience).toBe(Math.round(WEIGHTS.experience * 0.4));
  });

  it('overallScore equals the sum of the breakdown', () => {
    const result = scoringService.score(
      jd({ requiredSkills: ['python'], title: 'Data Scientist' }) as any,
      profile({ coreSkills: ['python'], targetRoles: ['Data Scientist'] }) as any,
      { contentSimilarity: 0.5 },
    );
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(result.overallScore).toBe(Math.min(100, sum));
  });

  it('reports lower confidence when the posting has little data', () => {
    const rich = scoringService.score(
      jd({ requiredSkills: ['python'], yearsOfExperience: 3, responsibilities: ["Bachelor's degree required"] }) as any,
      profile({ coreSkills: ['python'], educationLevel: "Master's" }) as any,
      { contentSimilarity: 0.4 },
    );
    const sparse = scoringService.score(jd() as any, profile({ coreSkills: ['python'] }) as any);
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });
});
