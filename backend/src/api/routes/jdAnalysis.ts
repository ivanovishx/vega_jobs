import { Router } from 'express';
import { jdAnalysisService } from '../../services/jdAnalysisService';
import { candidateProfileService } from '../../services/candidateProfileService';
import type { AuthRequest } from '../../middleware/auth';

const router = Router();

router.post('/analyze', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { jobId, rawJobDescription } = req.body;

    const profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile before analyzing jobs.' });
    }

    const result = await jdAnalysisService.analyzeJobDescription({
      jobId,
      rawJobDescription,
      candidateProfileId: profile.id
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
