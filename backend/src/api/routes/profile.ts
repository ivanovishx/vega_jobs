import { Router } from 'express';
import { candidateProfileService } from '../../services/candidateProfileService';

const router = Router();
const MOCK_USER_ID = "mock-user-id";

router.get('/', async (req, res) => {
  try {
    const profile = await candidateProfileService.getCandidateProfileByUserId(MOCK_USER_ID);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const profile = await candidateProfileService.getCandidateProfileByUserId(MOCK_USER_ID);
    if (profile) {
      const updated = await candidateProfileService.updateCandidateProfile(profile.id, req.body);
      res.json(updated);
    } else {
      res.status(404).json({ error: "Profile not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
