import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { jobMatchingService } from '../../services/jobMatchingService';
import type { AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/matches', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const results = await jobMatchingService.getMatches(userId);
    if (!results) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile to see matches.' });
    }
    res.json({ listings: results, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/companies', async (_req, res) => {
  try {
    const companies = await prisma.$queryRaw<{ company: string; jobCount: number }[]>`
      SELECT company, COUNT(*)::int AS "jobCount"
      FROM "JobListings"
      WHERE company IS NOT NULL AND company <> ''
      GROUP BY company
      ORDER BY company ASC
    `;
    res.json({ companies });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const ALLOWED_SORT = ['company', 'jobTitle', 'location', 'scrapedAt'] as const;
type SortCol = (typeof ALLOWED_SORT)[number];

router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      company = '',
      location = '',
      jobTitle = '',
      sortBy = 'scrapedAt',
      sortDir = 'desc',
      page = '1',
      pageSize = '25',
    } = req.query as Record<string, string>;

    const col: SortCol = ALLOWED_SORT.includes(sortBy as SortCol)
      ? (sortBy as SortCol)
      : 'scrapedAt';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(parseInt(pageSize) || 25, 1), 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(
        company ILIKE $${i} OR
        "jobTitle" ILIKE $${i} OR
        description ILIKE $${i} OR
        location ILIKE $${i}
      )`);
      params.push(`%${search}%`);
      i++;
    }
    if (company) {
      conditions.push(`company ILIKE $${i}`);
      params.push(`%${company}%`);
      i++;
    }
    if (location) {
      conditions.push(`location ILIKE $${i}`);
      params.push(`%${location}%`);
      i++;
    }
    if (jobTitle) {
      conditions.push(`"jobTitle" ILIKE $${i}`);
      params.push(`%${jobTitle}%`);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Rows
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, company, "jobTitle", location, "jobUrl", "scrapedAt"
       FROM "JobListings"
       ${where}
       ORDER BY "${col}" ${dir} NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      ...params, limit, offset
    );

    // Total count
    const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM "JobListings" ${where}`,
      ...params
    );

    // Stats (filtered)
    const statsRows = await prisma.$queryRawUnsafe<{ total: number; companies: number; locations: number }[]>(
      `SELECT COUNT(*)::int AS total,
              COUNT(DISTINCT company)::int AS companies,
              COUNT(DISTINCT location)::int AS locations
       FROM "JobListings" ${where}`,
      ...params
    );

    // Filter options (full list, unfiltered)
    const optionsRows = await prisma.$queryRaw<{ companies: string[]; locations: string[] }[]>`
      SELECT
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT company ORDER BY company), NULL) AS companies,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT location ORDER BY location), NULL) AS locations
      FROM "JobListings"
    `;

    res.json({
      listings: rows,
      total: countRows[0]?.total ?? 0,
      page: Math.max(parseInt(page) || 1, 1),
      pageSize: limit,
      stats: statsRows[0] ?? { total: 0, companies: 0, locations: 0 },
      options: optionsRows[0] ?? { companies: [], locations: [] },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
