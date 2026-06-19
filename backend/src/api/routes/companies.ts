import { Router } from 'express';
import { prisma } from '../../db/prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { search = '' } = req.query as Record<string, string>;

    const where = search ? `WHERE "companyName" ILIKE $1` : '';
    const params = search ? [`%${search}%`] : [];

    const companies = await prisma.$queryRawUnsafe<{ companyName: string; website: string }[]>(
      `SELECT "companyName", website
       FROM "CompanyScrapeQueue"
       ${where}
       ORDER BY "companyName" ASC`,
      ...params
    );

    res.json({ companies, total: companies.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
