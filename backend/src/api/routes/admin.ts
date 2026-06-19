import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { AuthRequest, requireRole } from '../../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

function setImpersonationCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('impersonation_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 4 * 60 * 60 * 1000,
  });
}

router.get('/users', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, picture: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/users/:id/profile', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      role: true,
      createdAt: true,
      candidateProfile: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { job: { include: { company: true } } },
  });

  res.json({
    ...user,
    applications: applications.map((app) => ({
      applicationId: app.id,
      companyName: app.job.company?.name || app.job.title || 'Unknown',
      jobTitle: app.job.title,
      status: app.status,
      category: app.category,
      jobUrl: app.job.url,
      location: app.job.location,
      salaryRange: app.job.salaryRange,
      matchScore: app.matchScore,
      dateApplied: app.dateApplied,
      dateSaved: app.dateSaved,
      nextAction: app.nextAction,
      nextActionDueDate: app.nextActionDueDate,
    })),
  });
});

router.post('/impersonate/end', async (req: AuthRequest, res: Response) => {
  if (!req.impersonating || !req.adminId) {
    res.status(400).json({ error: 'Not impersonating' });
    return;
  }

  await prisma.impersonationLog.updateMany({
    where: { adminId: req.adminId, targetId: req.userId!, endedAt: null },
    data: { endedAt: new Date() },
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('impersonation_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.json({ ok: true });
});

router.post('/impersonate/:userId', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const targetId = req.params.userId as string;
  const adminId = req.userId!;

  if (targetId === adminId) {
    res.status(400).json({ error: 'No puedes impersonar tu propia cuenta' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  await prisma.impersonationLog.create({ data: { adminId, targetId } });

  const token = jwt.sign({ adminId, targetId }, JWT_SECRET, { expiresIn: '4h' });
  setImpersonationCookie(res, token);
  res.json({ ok: true, targetId });
});

export default router;
