import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../../db/prisma';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function setTokenCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: { name: profile.displayName, picture: profile.photos?.[0]?.value },
            create: {
              email,
              googleId: profile.id,
              name: profile.displayName,
              picture: profile.photos?.[0]?.value,
            },
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
  res.status(503).json({ error: 'Google OAuth no está configurado en el servidor' });
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

// ── Email / Password ──────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, phone } = req.body as {
    email?: string; password?: string; name?: string; phone?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña son requeridos' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name: name ?? null, passwordHash } });

  // Pre-populate phone in candidate profile if provided
  if (phone) {
    await prisma.candidateProfile.upsert({
      where: { userId: user.id },
      update: { phone },
      create: { userId: user.id, phone },
    });
  }

  setTokenCookie(res, makeToken(user.id));
  res.status(201).json({ id: user.id, email: user.email, name: user.name, picture: user.picture });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña son requeridos' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  setTokenCookie(res, makeToken(user.id));
  res.json({ id: user.id, email: user.email, name: user.name, picture: user.picture });
});

// ── Session ───────────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, picture: true },
    });
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

export default router;
