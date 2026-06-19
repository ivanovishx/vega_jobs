import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'USER' | 'ADMIN';
  impersonating?: boolean;
  adminId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const impersonationToken = req.cookies?.impersonation_token;
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (impersonationToken) {
    try {
      const payload = jwt.verify(impersonationToken, process.env.JWT_SECRET!) as {
        adminId: string;
        targetId: string;
      };
      req.userId = payload.targetId;
      req.adminId = payload.adminId;
      req.impersonating = true;
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid or expired impersonation token' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role: 'ADMIN') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (!user || user.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    req.userRole = user.role;
    next();
  };
}
