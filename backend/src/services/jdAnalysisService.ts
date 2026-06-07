import { prisma } from '../db/prisma';
import { jdParserService } from './jdParserService';
import { scoringService } from './scoringService';

export const jdAnalysisService = {
  async analyzeJobDescription(input: {
    jobId?: string;
    rawJobDescription: string;
    candidateProfileId: string;
  }) {
    // 1. Fetch Candidate Profile
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: input.candidateProfileId }
    });

    if (!profile) {
      throw new Error("Candidate profile not found");
    }

    // 2. Parse JD
    const parsedJd = jdParserService.parse(input.rawJobDescription);

    // 3. Score
    const scoreResult = scoringService.score(parsedJd, {
      targetRoles: profile.targetRoles,
      targetLocations: profile.targetLocations,
      workAuthorization: profile.workAuthorization,
      yearsOfExperience: profile.yearsOfExperience,
      coreSkills: profile.coreSkills,
      domainExperience: profile.domainExperience,
      preferredWorkMode: profile.preferredWorkMode
    });

    let suggestedApplicationStrategy = 'Apply normally.';
    if (scoreResult.overallScore > 80) {
      suggestedApplicationStrategy = 'Strong match. Apply immediately and try to find a referral.';
    } else if (scoreResult.overallScore < 50) {
      suggestedApplicationStrategy = 'Weak match. Only apply if you have time, or tailor your resume heavily.';
    }

    const data = {
      overallScore: scoreResult.overallScore,
      requiredSkillsScore: scoreResult.requiredSkillsScore,
      experienceScore: scoreResult.experienceScore,
      domainScore: scoreResult.domainScore,
      seniorityScore: scoreResult.seniorityScore,
      locationScore: scoreResult.locationScore,
      visaScore: scoreResult.visaScore,
      bonusSkillsScore: scoreResult.bonusSkillsScore,
      explanation: scoreResult.explanation,
      matchedKeywords: scoreResult.matchedKeywords,
      missingKeywords: scoreResult.missingKeywords,
      riskFlags: scoreResult.riskFlags,
      extractedFields: parsedJd as any,
      suggestedResumeKeywords: scoreResult.missingKeywords.slice(0, 5),
      suggestedApplicationStrategy
    };

    if (input.jobId) {
      // Save analysis to DB
      const analysis = await prisma.jobDescriptionAnalysis.upsert({
        where: { jobId: input.jobId },
        update: data,
        create: {
          jobId: input.jobId,
          ...data
        }
      });
      return { analysisId: analysis.id, ...data };
    }

    return { analysisId: 'temp-' + Date.now(), ...data };
  }
};
