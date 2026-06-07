import { Router } from 'express';
import { jdAnalysisService } from '../../services/jdAnalysisService';

const router = Router();
const MOCK_USER_ID = "mock-user-id";

router.post('/analyze', async (req, res) => {
  try {
    const { jobId, rawJobDescription, candidateProfileId } = req.body;
    const result = await jdAnalysisService.analyzeJobDescription({
      jobId,
      rawJobDescription,
      candidateProfileId
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
