import { Router } from 'express';
import { jobService } from '../../services/jobService';
import { jdAnalysisService } from '../../services/jdAnalysisService';
import { applicationService } from '../../services/applicationService';
import {
  classifyUrl,
  inferCompanyNameFromUrl,
  isBlocklisted,
  scoreTextSignals,
  JOB_TEXT_SIGNALS,
  CAREERS_TEXT_SIGNALS,
  COMPANY_TEXT_SIGNALS,
} from '../../services/urlClassifierService';
import { candidateProfileService } from '../../services/candidateProfileService';
import { prisma } from '../../db/prisma';
import type { AuthRequest } from '../../middleware/auth';

const router = Router();

router.post('/capture-job', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const result = await jobService.createJobFromBrowser({ ...req.body, userId });
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

router.post('/evaluate-job', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { url, text } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });

    if (isBlocklisted(url)) {
      return res.json({ ignore: true, message: 'Blocked domain — not job-related.' });
    }

    const classification = classifyUrl(url as string);
    const inferredCompany = inferCompanyNameFromUrl(url as string);
    const pageText = (text || '').toLowerCase();

    const jobScore     = scoreTextSignals(pageText, JOB_TEXT_SIGNALS);
    const careersScore = scoreTextSignals(pageText, CAREERS_TEXT_SIGNALS);
    const companyScore = scoreTextSignals(pageText, COMPANY_TEXT_SIGNALS);

    let finalCategory = classification.category;

    if (classification.category === 'Job') {
      if (jobScore < 2) {
        if (careersScore >= 1) {
          finalCategory = 'Careers';
        } else {
          return res.json({ ignore: true, message: 'URL looks like a job but page content does not confirm it.' });
        }
      }
    } else if (classification.category === 'Careers') {
      if (careersScore < 1 && jobScore < 2) {
        return res.json({ ignore: true, message: 'URL looks like a careers page but page content does not confirm it.' });
      }
    } else {
      let parsed: URL;
      try { parsed = new URL(url); } catch { return res.json({ ignore: true, message: 'Unparseable URL.' }); }
      const isHomepage = parsed.pathname === '/' || parsed.pathname === '';
      if (!isHomepage || companyScore < 1) {
        return res.json({ ignore: true, message: 'Not a recognizable company homepage.' });
      }
    }

    const profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    let matchScoreStr = '';
    if (profile && profile.resumeKeywords && profile.resumeKeywords.length > 0 && pageText) {
      let matches = 0;
      profile.resumeKeywords.forEach(kw => { if (pageText.includes(kw)) matches++; });
      const score = Math.round((matches / profile.resumeKeywords.length) * 100);
      matchScoreStr = ` (Match Score: ${score}%)`;
    }

    const app = await prisma.application.findFirst({
      where: {
        userId,
        job: { url: classification.normalizedUrl }
      },
      include: { job: { include: { company: true } } },
      orderBy: { createdAt: 'asc' }
    });

    if (!app && finalCategory === 'Careers') {
      let parsed: URL;
      try { parsed = new URL(url); } catch { parsed = new URL('http://unknown'); }
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const existingCareers = await prisma.application.findFirst({
        where: {
          userId,
          category: 'Careers',
          job: { url: { contains: hostname } }
        }
      });
      if (existingCareers) {
        return res.json({
          applied: false,
          inToApply: true,
          category: 'Careers',
          normalizedUrl: classification.normalizedUrl,
          homepageUrl: classification.homepageUrl,
          message: `Careers page for ${inferredCompany} already saved.` + matchScoreStr,
          status: 'To Apply',
          applicationId: existingCareers.id,
        });
      }
    }

    if (!app) {
      return res.json({
        applied: false,
        inToApply: false,
        category: finalCategory,
        normalizedUrl: classification.normalizedUrl,
        homepageUrl: classification.homepageUrl,
        inferredCompany,
        message: 'New entry! No records found.' + matchScoreStr
      });
    }

    const companyLabel = app.job.company?.name || 'this company';

    if (app.status === 'To Apply') {
      return res.json({
        applied: false,
        inToApply: true,
        category: app.category || finalCategory,
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
      category: app.category || finalCategory,
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
