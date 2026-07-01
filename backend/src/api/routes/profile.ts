import { Router } from 'express';
import { candidateProfileService } from '../../services/candidateProfileService';
import { customFieldService } from '../../services/customFieldService';
import { skillExtractionService } from '../../services/skillExtractionService';
import { PDFParse } from 'pdf-parse';
import multer from 'multer';
import type { AuthRequest } from '../../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

    // Match the resume against the curated skill dictionary instead of turning
    // every word into a keyword. Result is an actual list of skills.
    const uniqueKeywords = skillExtractionService.extractSkills(text);

    const userId = (req as AuthRequest).userId!;
    let profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const updated = await candidateProfileService.updateCandidateProfile(profile.id, {
      resumeText: text,
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

    // Canonicalize + de-duplicate so manual entries match the same form the
    // extractor produces (e.g. "js" -> "JavaScript", "postgres" -> "PostgreSQL").
    const normalized = Array.from(
      new Set(
        keywords
          .map((k: unknown) => (typeof k === 'string' ? skillExtractionService.canonicalize(k) : null))
          .filter((k): k is string => !!k)
      )
    );

    const userId = (req as AuthRequest).userId!;
    let profile = await candidateProfileService.getCandidateProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const updated = await candidateProfileService.updateCandidateProfile(profile.id, {
      resumeKeywords: normalized
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Custom (learned) application fields ──────────────────────────────────────

// List all custom fields for the signed-in user.
router.get('/custom-fields', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const fields = await customFieldService.list(userId);
    res.json(fields);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Extension reports the fields it found on a page. New ones are recorded
// (with no answer yet); the full list is returned so the extension can fill
// any fields the user has already answered.
router.post('/custom-fields/discover', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];
    const result = await customFieldService.discover(userId, fields);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save/overwrite a single field's answer — used by the extension when the user
// edits a field on the page, and by the profile UI.
router.post('/custom-fields/value', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { fieldKey, label, value, fieldType, options, lastSeenUrl } = req.body || {};
    if (!label && !fieldKey) {
      return res.status(400).json({ error: 'label or fieldKey is required' });
    }
    const saved = await customFieldService.saveValue(userId, { fieldKey, label, value, fieldType, options, lastSeenUrl });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a field's answer by id (profile UI).
router.put('/custom-fields/:id', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { value } = req.body || {};
    const updated = await customFieldService.updateById(userId, req.params.id, value ?? null);
    if (!updated) return res.status(404).json({ error: 'Field not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/custom-fields/:id', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const removed = await customFieldService.remove(userId, req.params.id);
    if (!removed) return res.status(404).json({ error: 'Field not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
