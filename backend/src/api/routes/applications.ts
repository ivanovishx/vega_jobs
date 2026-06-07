import { Router } from 'express';
import { applicationService } from '../../services/applicationService';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await applicationService.listActiveApplications(req.query as any);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    // Hardcoding candidateProfileId for MVP since we don't have auth middleware yet
    const profileId = req.query.profileId as string;
    if (!profileId) return res.status(400).json({ error: "profileId required" });
    const result = await applicationService.summarizePipeline(profileId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    const status = await applicationService.getApplicationStatus(req.params.id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, note, eventDate } = req.body;
    const result = await applicationService.updateApplicationStatus({
      applicationId: req.params.id,
      status,
      note,
      eventDate
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/events', async (req, res) => {
  try {
    const { eventType, note, eventDate, contactId } = req.body;
    const result = await applicationService.addApplicationEvent({
      applicationId: req.params.id,
      eventType,
      note,
      eventDate,
      contactId
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
