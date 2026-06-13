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

    // Step 1: blocklist check — ignore known non-employer domains immediately
    if (isBlocklisted(url)) {
      return res.json({ ignore: true, message: 'Blocked domain — not job-related.' });
    }

    const classification = classifyUrl(url as string);
    const inferredCompany = inferCompanyNameFromUrl(url as string);
    const pageText = (text || '').toLowerCase();

    // Step 2: validate classification with page text signals
    const jobScore     = scoreTextSignals(pageText, JOB_TEXT_SIGNALS);
    const careersScore = scoreTextSignals(pageText, CAREERS_TEXT_SIGNALS);
    const companyScore = scoreTextSignals(pageText, COMPANY_TEXT_SIGNALS);

    let finalCategory = classification.category;

    if (classification.category === 'Job') {
      // Needs at least 2 job signals to confirm it's a real posting
      if (jobScore < 2) {
        // Might be a careers listing misidentified by URL — check careers signals
        if (careersScore >= 1) {
          finalCategory = 'Careers';
        } else {
          return res.json({ ignore: true, message: 'URL looks like a job but page content does not confirm it.' });
        }
      }
    } else if (classification.category === 'Careers') {
      // Needs at least 1 careers signal
      if (careersScore < 1 && jobScore < 2) {
        return res.json({ ignore: true, message: 'URL looks like a careers page but page content does not confirm it.' });
      }
    } else {
      // Company: only save if it's a true homepage (path is / or empty) with company signals
      let parsed: URL;
      try { parsed = new URL(url); } catch { return res.json({ ignore: true, message: 'Unparseable URL.' }); }
      const isHomepage = parsed.pathname === '/' || parsed.pathname === '';
      if (!isHomepage || companyScore < 1) {
        return res.json({ ignore: true, message: 'Not a recognizable company homepage.' });
      }
    }

    // Step 3: match score against candidate profile
    const profile = await candidateProfileService.getCandidateProfileByUserId(MOCK_USER_ID);
    let matchScoreStr = '';
    if (profile && profile.resumeKeywords && profile.resumeKeywords.length > 0 && pageText) {
      let matches = 0;
      profile.resumeKeywords.forEach(kw => { if (pageText.includes(kw)) matches++; });
      const score = Math.round((matches / profile.resumeKeywords.length) * 100);
      matchScoreStr = ` (Match Score: ${score}%)`;
    }

    // Step 4: dedup check — look for existing application at this URL
    const app = await prisma.application.findFirst({
      where: {
        userId: MOCK_USER_ID,
        job: { url: classification.normalizedUrl }
      },
      include: { job: { include: { company: true } } },
      orderBy: { createdAt: 'asc' }
    });

    // For Careers: also dedup by hostname to avoid saving the same careers site repeatedly
    if (!app && finalCategory === 'Careers') {
      let parsed: URL;
      try { parsed = new URL(url); } catch { parsed = new URL('http://unknown'); }
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const existingCareers = await prisma.application.findFirst({
        where: {
          userId: MOCK_USER_ID,
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
