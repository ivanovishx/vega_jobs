import { Router } from 'express';
import { jobService } from '../../services/jobService';
import type { AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const jobs = await jobService.searchJobs({ ...req.query as any, userId });
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "Not found" });
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
