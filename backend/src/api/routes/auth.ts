import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { google } from 'googleapis';
import { Readable } from 'stream';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../../db/prisma';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET!;

// CV template stored on Google Drive (shared "anyone with the link"). Used by the
// "save to my Drive" flow to copy the file into the signed-in user's own Drive.
const CV_TEMPLATE_FILE_ID = process.env.CV_TEMPLATE_FILE_ID || '1wN_z6DRva3dIArIUnWscnF9P7eiQJBZ9';
const CV_TEMPLATE_DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${CV_TEMPLATE_FILE_ID}`;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function driveOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${BACKEND_URL}/auth/google/drive/callback`
  );
}

function makeToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function setTokenCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${BACKEND_URL}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'));

          // Match by email first so an existing account (e.g. created via
          // email/password on the frontend) gets Google linked to it instead
          // of a duplicate user being created.
          const existingByEmail = await prisma.user.findUnique({ where: { email } });

          const user = existingByEmail
            ? await prisma.user.update({
                where: { id: existingByEmail.id },
                data: {
                  googleId: existingByEmail.googleId ?? profile.id,
                  name: existingByEmail.name ?? profile.displayName,
                  picture: existingByEmail.picture ?? profile.photos?.[0]?.value,
                },
              })
            : await prisma.user.upsert({
                where: { googleId: profile.id },
                update: { name: profile.displayName, picture: profile.photos?.[0]?.value },
                create: {
                  email,
                  googleId: profile.id,
                  name: profile.displayName,
                  picture: profile.photos?.[0]?.value,
                },
              });

          await prisma.candidateProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id },
          });

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

const googleNotConfigured = (_req: Request, res: Response) => {
  res.status(503).json({ error: 'Google OAuth is not configured on the server' });
};

router.get(
  '/google',
  googleConfigured
    ? passport.authenticate('google', { scope: ['profile', 'email'], session: false })
    : googleNotConfigured
);

router.get(
  '/google/callback',
  ...(googleConfigured
    ? [
        passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}?auth_error=1` }),
        (req: Request, res: Response) => {
          const user = req.user as { id: string };
          setTokenCookie(res, makeToken(user.id));
          res.redirect(FRONTEND_URL);
        },
      ]
    : [googleNotConfigured])
);

// ── Save CV template to the user's Google Drive ───────────────────────────────
// Incremental Drive consent: the user grants `drive.file` once, we use the access
// token immediately to copy the template into their Drive, and never store it.

router.get('/google/drive', (req: Request, res: Response) => {
  if (!googleConfigured) return googleNotConfigured(req, res);

  const token = req.cookies?.token;
  if (!token) return res.redirect(`${FRONTEND_URL}/cv-template?drive=auth`);

  let userId: string;
  try {
    userId = (jwt.verify(token, JWT_SECRET) as { userId: string }).userId;
  } catch {
    return res.redirect(`${FRONTEND_URL}/cv-template?drive=auth`);
  }

  // Carry the user id through the round-trip in a short-lived signed state param.
  const state = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '10m' });
  const url = driveOAuthClient().generateAuthUrl({
    access_type: 'online',
    scope: [DRIVE_SCOPE],
    state,
  });
  res.redirect(url);
});

router.get('/google/drive/callback', async (req: Request, res: Response) => {
  const backToCv = (status: string) => res.redirect(`${FRONTEND_URL}/cv-template?drive=${status}`);
  if (!googleConfigured) return googleNotConfigured(req, res);

  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) return backToCv('error');

  let userId: string;
  try {
    userId = (jwt.verify(state, JWT_SECRET) as { userId: string }).userId;
  } catch {
    return backToCv('error');
  }

  try {
    const client = driveOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch the public template PDF server-side (no CORS), then upload a copy into
    // the user's Drive. drive.file scope covers files the app creates.
    const resp = await fetch(CV_TEMPLATE_DOWNLOAD_URL);
    if (!resp.ok) return backToCv('error');
    const buffer = Buffer.from(await resp.arrayBuffer());

    const drive = google.drive({ version: 'v3', auth: client });
    const file = await drive.files.create({
      requestBody: { name: 'Plantilla CV - Vega.pdf', mimeType: 'application/pdf' },
      media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
      fields: 'id, webViewLink',
    });

    // Persist the link to the Drive copy so "view in Drive" is always available
    // later (latest save wins). Separate from cvCopyUrl (the user's edited copy).
    const link = file.data.webViewLink;
    if (link) {
      await prisma.candidateProfile.updateMany({ where: { userId }, data: { cvDriveFileUrl: link } });
    }

    // Pass the new file's link back so the UI can offer "open in Drive" directly.
    return res.redirect(
      `${FRONTEND_URL}/cv-template?drive=ok${link ? `&fileUrl=${encodeURIComponent(link)}` : ''}`
    );
  } catch (err) {
    console.error('Drive save error:', err);
    return backToCv('error');
  }
});

// ── Email / Password ──────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, phone } = req.body as {
    email?: string; password?: string; name?: string; phone?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name: name ?? null, passwordHash } });

  await prisma.candidateProfile.create({
    data: { userId: user.id, phone: phone ?? null },
  });

  const token = makeToken(user.id);
  setTokenCookie(res, token);
  res.status(201).json({ id: user.id, email: user.email, name: user.name, picture: user.picture, token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Incorrect credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Incorrect credentials' });
    return;
  }

  const token = makeToken(user.id);
  setTokenCookie(res, token);
  res.json({ id: user.id, email: user.email, name: user.name, picture: user.picture, token });
});

// ── Session ───────────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const impersonationToken = req.cookies?.impersonation_token;
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (impersonationToken) {
    try {
      const payload = jwt.verify(impersonationToken, JWT_SECRET) as { adminId: string; targetId: string };
      const target = await prisma.user.findUnique({
        where: { id: payload.targetId },
        select: { id: true, email: true, name: true, picture: true, role: true },
      });
      if (!target) { res.status(401).json({ error: 'User not found' }); return; }
      res.json({ ...target, impersonating: true, adminId: payload.adminId });
      return;
    } catch {
      res.status(401).json({ error: 'Invalid impersonation token' });
      return;
    }
  }

  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, picture: true, role: true },
    });
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    res.json({ ...user, impersonating: false });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.json({ ok: true });
});

export default router;
