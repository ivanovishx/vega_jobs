import { Router } from 'express';
import { prisma } from '../../db/prisma';

const router = Router();

// Same public sort keys as the CompanyDirectory route, mapped to CrunchbaseCompany columns.
const ALLOWED_SORT = ['rank', 'name', 'website'] as const;
type SortCol = (typeof ALLOWED_SORT)[number];

// Map the public sort key to a raw SQL expression over the CrunchbaseCompany table.
const SORT_EXPR: Record<SortCol, string> = {
  rank: 'rank_org::int',
  name: 'identifier',
  website: 'website',
};

router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      page = '1',
      limit = '50',
      sortBy = 'rank',
      sortDir = 'asc',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const col: SortCol = ALLOWED_SORT.includes(sortBy as SortCol) ? (sortBy as SortCol) : 'rank';
    const orderExpr = SORT_EXPR[col];
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const searchParams = search ? [`%${search}%`] : [];
    const where = search ? `WHERE "identifier" ILIKE $1` : '';
    const pIdx = searchParams.length + 1;

    const [countRows, companies] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "CrunchbaseCompany" ${where}`,
        ...searchParams
      ),
      prisma.$queryRawUnsafe<{ id: string; name: string | null; rank: number | null; website: string | null; description1: string | null; crunchbaseLink: string | null; linkCareers1: string | null; linkCareers2: string | null }[]>(
        `SELECT
           "uuid" AS id,
           "identifier" AS name,
           "rank_org"::int AS rank,
           "website",
           "short_description" AS description1,
           CASE WHEN "permalink" IS NOT NULL
             THEN 'https://www.crunchbase.com/organization/' || "permalink"
             ELSE NULL END AS "crunchbaseLink",
           NULL::text AS "linkCareers1",
           NULL::text AS "linkCareers2"
         FROM "CrunchbaseCompany"
         ${where}
         ORDER BY ${orderExpr} ${dir} NULLS LAST
         LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
        ...searchParams,
        limitNum,
        offset
      ),
    ]);

    res.json({
      companies,
      total: Number(countRows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
