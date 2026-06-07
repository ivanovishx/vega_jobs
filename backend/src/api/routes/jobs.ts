import { Router } from 'express';
import { jobService } from '../../services/jobService';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const jobs = await jobService.searchJobs(filters as any);
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
