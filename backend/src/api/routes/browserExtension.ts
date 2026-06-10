import { Router } from 'express';
import { jobService } from '../../services/jobService';
import { jdAnalysisService } from '../../services/jdAnalysisService';
import { applicationService } from '../../services/applicationService';
import { classifyUrl, inferCompanyNameFromUrl } from '../../services/urlClassifierService';
import { prisma } from '../../db/prisma';

const router = Router();
const MOCK_USER_ID = "mock-user-id"; // MVP simplicity

router.post('/capture-job', async (req, res) => {
  try {
    const result = await jobService.createJobFromBrowser({ ...req.body, userId: MOCK_USER_ID });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/analyze-current-job', async (req, res) => {
  try {
    const { rawJobDescription, candidateProfileId, jobId } = req.body;
    const result = await jdAnalysisService.analyzeJobDescription({
      jobId, rawJobDescription, candidateProfileId
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/application-status', async (req, res) => {
  try {
    const { applicationId } = req.query;
    if (!applicationId) return res.status(400).json({ error: 'Missing applicationId' });
    const result = await applicationService.getApplicationStatus(applicationId as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/update-application', async (req, res) => {
  try {
    const result = await applicationService.updateApplicationStatus(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { candidateProfileService } from '../../services/candidateProfileService';

router.post('/evaluate-job', async (req, res) => {
  try {
    const { url, text } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    const classification = classifyUrl(url as string);
    const inferredCompany = inferCompanyNameFromUrl(url as string);

    // Get candidate profile to calculate match score
    const profile = await candidateProfileService.getCandidateProfileByUserId(MOCK_USER_ID);
    let matchScoreStr = '';
    if (profile && profile.resumeKeywords && profile.resumeKeywords.length > 0 && text) {
      const pageText = text.toLowerCase();
      let matches = 0;
      profile.resumeKeywords.forEach(kw => {
        // very simple bag of words match
        if (pageText.includes(kw)) matches++;
      });
      const score = Math.round((matches / profile.resumeKeywords.length) * 100);
      matchScoreStr = ` (Match Score: ${score}%)`;
    }

    // Query Applications directly via the Job join so we consider ALL Jobs at this
    // URL, not just the first one. Avoids the orphan-Job edge case that caused
    // duplicate inserts.
    const app = await prisma.application.findFirst({
      where: {
        userId: MOCK_USER_ID,
        job: { url: classification.normalizedUrl }
      },
      include: { job: { include: { company: true } } },
      orderBy: { createdAt: 'asc' }
    });

    if (!app) {
      return res.json({
        applied: false,
        inToApply: false,
        category: classification.category,
        normalizedUrl: classification.normalizedUrl,
        homepageUrl: classification.homepageUrl,
        inferredCompany,
        message: "New entry! No records found." + matchScoreStr
      });
    }

    const companyLabel = app.job.company?.name || 'this company';

    if (app.status === 'To Apply') {
      return res.json({
        applied: false,
        inToApply: true,
        category: app.category || classification.category,
        normalizedUrl: classification.normalizedUrl,
        homepageUrl: classification.homepageUrl,
        message: `Already in your "Positions to Apply" — ${companyLabel}: ${app.job.title}` + matchScoreStr,
        status: app.status,
        applicationId: app.id,
        dateSaved: app.dateSaved
      });
    }

    return res.json({
      applied: true,
      inToApply: false,
      category: app.category || classification.category,
      normalizedUrl: classification.normalizedUrl,
      homepageUrl: classification.homepageUrl,
      message: `You already applied to ${companyLabel} for the ${app.job.title} role!` + matchScoreStr,
      status: app.status,
      applicationId: app.id,
      dateSaved: app.dateSaved
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
