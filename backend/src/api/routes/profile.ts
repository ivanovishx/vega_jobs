import { Router } from 'express';
import { candidateProfileService } from '../../services/candidateProfileService';
import { PDFParse } from 'pdf-parse';
import multer from 'multer';
import type { AuthRequest } from '../../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now']);

router.get('/', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    let profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) {
      profile = await candidateProfileService.createCandidateProfile(userId);
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const profile = await candidateProfileService.getCandidateProfileByUserId(userId);
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

router.post('/resume-pdf', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    await parser.destroy();

    const cleanText = text.toLowerCase().replace(/[^a-z0-9+#]/g, ' ');
    const words = cleanText.split(/\s+/).filter((w: string) => w.length > 2 && !STOP_WORDS.has(w));
    const uniqueKeywords = Array.from(new Set(words));

    const userId = (req as AuthRequest).userId!;
    let profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const updated = await candidateProfileService.updateCandidateProfile(profile.id, {
      resumeKeywords: uniqueKeywords
    });

    res.json(updated);
  } catch (err: any) {
    console.error('PDF parsing error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/keywords', async (req, res) => {
  try {
    const { keywords } = req.body;
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'keywords must be an array' });
    }

    const userId = (req as AuthRequest).userId!;
    let profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const updated = await candidateProfileService.updateCandidateProfile(profile.id, {
      resumeKeywords: keywords
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
