import { Router } from 'express';
import { prisma } from '../../db/prisma';

const router = Router();

const ALLOWED_SORT = ['rank', 'name', 'website'] as const;
type SortCol = (typeof ALLOWED_SORT)[number];

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
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const searchParams = search ? [`%${search}%`] : [];
    const where = search ? `WHERE "name" ILIKE $1` : '';
    const pIdx = searchParams.length + 1;

    const [countRows, companies] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "CompanyDirectory" ${where}`,
        ...searchParams
      ),
      prisma.$queryRawUnsafe<{ id: string; name: string | null; rank: number | null; website: string | null; description1: string | null }[]>(
        `SELECT id, name, rank, website, description1
         FROM "CompanyDirectory"
         ${where}
         ORDER BY "${col}" ${dir} NULLS LAST
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
