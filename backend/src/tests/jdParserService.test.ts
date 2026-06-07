import { describe, it, expect } from 'vitest';
import { jdParserService } from '../services/jdParserService';

describe('jdParserService', () => {
  it('should parse basic fields correctly', () => {
    const jdText = `We are looking for a Senior TPM with 5+ years of experience in robotics.
      Must know python, C++, and JIRA.
      Hybrid role. No sponsorship available. Fast-paced environment.`;
    
    const parsed = jdParserService.parse(jdText);
    
    expect(parsed.seniority).toBe('Senior');
    expect(parsed.yearsOfExperience).toBe(5);
    expect(parsed.workMode).toBe('hybrid');
    expect(parsed.domainKeywords).toContain('robotics');
    expect(parsed.tools).toEqual(expect.arrayContaining(['python', 'c++', 'jira']));
    expect(parsed.riskFlags).toContain('fast-paced environment');
  });
});
