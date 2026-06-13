import { Router } from 'express';
import { candidateProfileService } from '../../services/candidateProfileService';
import { PDFParse } from 'pdf-parse';

import multer from 'multer';

const router = Router();
const MOCK_USER_ID = "mock-user-id";
const upload = multer({ storage: multer.memoryStorage() });

// Basic stop words to filter out
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now']);

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

router.post('/resume-pdf', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse PDF using PDFParse v2 class-based API
    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;
    await parser.destroy();

    // Extract unique keywords
    // 1. Lowercase, replace non-letters with spaces
    const cleanText = text.toLowerCase().replace(/[^a-z0-9+#]/g, ' ');
    // 2. Split by spaces, filter short/stop words
    const words = cleanText.split(/\s+/).filter((w: string) => w.length > 2 && !STOP_WORDS.has(w));
    // 3. Deduplicate
    const uniqueKeywords = Array.from(new Set(words));

    // Update Profile
    let profile = await candidateProfileService.getCandidateProfileByUserId(MOCK_USER_ID);
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

    let profile = await candidateProfileService.getCandidateProfileByUserId(MOCK_USER_ID);
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
