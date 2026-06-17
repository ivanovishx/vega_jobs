import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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
    const rowsRes = await pool.query(
      `SELECT
         id::text,
         company,
         "jobTitle",
         location,
         "jobUrl",
         "scrapedAt"
       FROM "JobListings"
       ${where}
       ORDER BY "${col}" ${dir} NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    // Total count for pagination
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM "JobListings" ${where}`,
      params
    );

    // Stats (filtered)
    const statsRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(DISTINCT company)::int AS companies,
         COUNT(DISTINCT location)::int AS locations
       FROM "JobListings"
       ${where}`,
      params
    );

    // Filter options (always full list, unfiltered)
    const optionsRes = await pool.query(`
      SELECT
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT company ORDER BY company), NULL) AS companies,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT location ORDER BY location), NULL) AS locations
      FROM "JobListings"
    `);

    res.json({
      listings: rowsRes.rows,
      total: countRes.rows[0].total,
      page: Math.max(parseInt(page) || 1, 1),
      pageSize: limit,
      stats: statsRes.rows[0],
      options: optionsRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
