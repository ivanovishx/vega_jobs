import { Router } from 'express';
import { applicationService } from '../../services/applicationService';
import { aiParsingService } from '../../services/aiParsingService';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await applicationService.listActiveApplications(req.query as any);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { companyName, jobTitle, jobUrl, status, notes, dateApplied } = req.body;
    if (!companyName || !jobTitle) {
      return res.status(400).json({ error: "companyName and jobTitle are required" });
    }
    
    // For MVP, we use the mock user ID as in other places
    const userId = "mock-user-id";
    
    const result = await applicationService.createApplication({
      userId,
      companyName,
      jobTitle,
      jobUrl,
      status: status || 'Applied',
      notes,
      dateApplied
    });
    
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('DUPLICATE_URL')) {
      return res.status(400).json({ error: err.message.replace('DUPLICATE_URL: ', '') });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/autofill', upload.single('screenshot'), async (req, res) => {
  try {
    const url = req.body.url;
    const file = req.file;

    if (!url && !file) {
      return res.status(400).json({ error: "Must provide either a 'url' field or upload a 'screenshot' file." });
    }

    let extractedData;

    if (file) {
      // Parse from Image
      const base64Data = file.buffer.toString('base64');
      extractedData = await aiParsingService.parseFromImage(file.mimetype, base64Data);
    } else {
      // Parse from URL
      extractedData = await aiParsingService.parseFromUrl(url);
    }

    res.json(extractedData);
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
