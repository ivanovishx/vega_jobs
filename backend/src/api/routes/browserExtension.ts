import { Router } from 'express';
import { jobService } from '../../services/jobService';
import { jdAnalysisService } from '../../services/jdAnalysisService';
import { applicationService } from '../../services/applicationService';

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

router.get('/evaluate-job', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing URL parameter' });
    
    const job = await jobService.getJobByUrl(url as string);
    if (!job) {
      return res.json({ applied: false, message: "New job! No records found." });
    }

    if (job.applications && job.applications.length > 0) {
      const app = job.applications[0];
      return res.json({ 
        applied: true, 
        message: `You already applied to ${job.company?.name || 'this company'} for the ${job.title} role!`,
        status: app.status,
        dateSaved: app.dateSaved
      });
    }

    return res.json({ applied: false, message: `Job exists in database as ${job.title}, but no application submitted yet.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
