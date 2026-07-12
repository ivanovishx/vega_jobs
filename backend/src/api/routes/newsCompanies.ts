import { Router } from 'express';
import { prisma } from '../../db/prisma';

const router = Router();

// Requires the indexes + facet table from
// backend/sql/2026-07-11_crunchbase_search_filters.sql.
//
// Every CrunchbaseCompany column is text, so typed values are derived with
// the expressions below. Each expression must stay identical to its
// expression index in the SQL file or the planner won't use the index.
const CITY_EXPR = `NULLIF(split_part(location_identifiers, ', ', 1), '')`;
const STATE_EXPR = `NULLIF(split_part(location_identifiers, ', ', 2), '')`;
const FOUNDED_YEAR_EXPR = `(CASE WHEN founded_on ~ '^\\d{4}' THEN left(founded_on, 4)::int END)`;
const FUNDING_TOTAL_EXPR = `(CASE WHEN split_part(funding_total, ' ', 1) ~ '^[0-9]+(\\.[0-9]+)?$'
                                  THEN split_part(funding_total, ' ', 1)::numeric END)`;
const LAST_FUNDING_EXPR = `NULLIF(last_funding_at, '')`;

const ALLOWED_SORT = ['rank', 'name', 'website', 'founded', 'lastFunding', 'fundingTotal'] as const;
type SortCol = (typeof ALLOWED_SORT)[number];

// Map the public sort key to a raw SQL expression over the CrunchbaseCompany table.
const SORT_EXPR: Record<SortCol, string> = {
  rank: 'rank_org::int',
  name: 'identifier',
  website: 'website',
  founded: FOUNDED_YEAR_EXPR,
  lastFunding: LAST_FUNDING_EXPR,
  fundingTotal: FUNDING_TOTAL_EXPR,
};

const SEARCH_COLS: Record<string, string[]> = {
  name: ['identifier'],
  description: ['short_description'],
  website: ['website'],
  all: ['identifier', 'short_description', 'website'],
};

const FUNDING_STAGES = new Set([
  'seed', 'early_stage_venture', 'late_stage_venture', 'private_equity', 'ipo', 'm_and_a',
]);

const csv = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

router.get('/facets', async (_req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe<{ kind: string; value: string; count: number }[]>(
      `SELECT kind, value, count FROM "CrunchbaseFacet" ORDER BY count DESC, value ASC`
    );
    const pick = (kind: string) =>
      rows.filter(r => r.kind === kind).map(r => ({ value: r.value, count: Number(r.count) }));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      categoryGroups: pick('category_group'),
      states: pick('state'),
      stages: pick('funding_stage'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      searchIn = 'all',
      status = 'active',
      stages = '',
      categories = '',
      states = '',
      foundedFrom = '',
      foundedTo = '',
      fundedWithinDays = '',
      minFunding = '',
      maxFunding = '',
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

    const params: unknown[] = [];
    const conditions: string[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    if (search) {
      const cols = SEARCH_COLS[searchIn] ?? SEARCH_COLS.all;
      const ph = p(`%${search}%`);
      conditions.push(`(${cols.map(c => `"${c}" ILIKE ${ph}`).join(' OR ')})`);
    }

    let statusFilter: string | null = null;
    if (status === 'active' || status === 'closed') {
      statusFilter = status;
      conditions.push(`operating_status = ${p(status)}`);
    }

    const stageList = csv(stages).filter(s => FUNDING_STAGES.has(s));
    if (stageList.length) {
      conditions.push(`funding_stage IN (${stageList.map(s => p(s)).join(', ')})`);
    }

    const categoryList = csv(categories);
    if (categoryList.length) {
      conditions.push(
        `string_to_array(category_groups, ', ') && ARRAY[${categoryList.map(c => p(c)).join(', ')}]::text[]`
      );
    }

    const stateList = csv(states);
    if (stateList.length) {
      conditions.push(`${STATE_EXPR} IN (${stateList.map(s => p(s)).join(', ')})`);
    }

    const fromYear = parseInt(foundedFrom);
    if (fromYear) conditions.push(`${FOUNDED_YEAR_EXPR} >= ${p(fromYear)}`);
    const toYear = parseInt(foundedTo);
    if (toYear) conditions.push(`${FOUNDED_YEAR_EXPR} <= ${p(toYear)}`);

    // last_funding_at is ISO YYYY-MM-DD text, so string comparison is chronological.
    const withinDays = parseInt(fundedWithinDays);
    if (withinDays) {
      const cutoff = new Date(Date.now() - withinDays * 86_400_000).toISOString().slice(0, 10);
      conditions.push(`${LAST_FUNDING_EXPR} >= ${p(cutoff)}`);
    }

    const minF = parseFloat(minFunding);
    if (!isNaN(minF)) conditions.push(`${FUNDING_TOTAL_EXPR} >= ${p(minF)}`);
    const maxF = parseFloat(maxFunding);
    if (!isNaN(maxF)) conditions.push(`${FUNDING_TOTAL_EXPR} <= ${p(maxF)}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // CrunchbaseCompany has ~1.8M rows. An exact COUNT(*) over the whole table
    // takes ~55s, so with no filters we use the planner's row estimate
    // (reltuples). The default view (only the status filter) uses the cached
    // per-status count from CrunchbaseFacet. Anything narrower gets an exact
    // count — every filterable column is indexed to keep that fast.
    const onlyStatusFilter = statusFilter !== null && conditions.length === 1;
    const countPromise = !conditions.length
      ? prisma
          .$queryRawUnsafe<[{ estimate: number }]>(
            `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'CrunchbaseCompany'`
          )
          .then((rows) => Number(rows[0]?.estimate ?? 0))
      : onlyStatusFilter
      ? prisma
          .$queryRawUnsafe<[{ count: number }]>(
            `SELECT count FROM "CrunchbaseFacet" WHERE kind = 'operating_status' AND value = $1`,
            statusFilter
          )
          .then((rows) => Number(rows[0]?.count ?? 0))
      : prisma
          .$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*) as count FROM "CrunchbaseCompany" ${where}`,
            ...params
          )
          .then((rows) => Number(rows[0].count));

    const limitPh = p(limitNum);
    const offsetPh = p(offset);

    const [total, companies] = await Promise.all([
      countPromise,
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT
           "uuid" AS id,
           "identifier" AS name,
           "rank_org"::int AS rank,
           "website",
           "short_description" AS description1,
           CASE WHEN "permalink" IS NOT NULL
             THEN 'https://www.crunchbase.com/organization/' || "permalink"
             ELSE NULL END AS "crunchbaseLink",
           ${CITY_EXPR} AS "city",
           ${STATE_EXPR} AS "state",
           ${FOUNDED_YEAR_EXPR} AS "foundedYear",
           NULLIF("funding_stage", '') AS "fundingStage",
           ${FUNDING_TOTAL_EXPR}::float8 AS "fundingTotalUsd",
           ${LAST_FUNDING_EXPR} AS "lastFundingAt",
           NULLIF("last_funding_type", '') AS "lastFundingType",
           "category_groups" AS "categoryGroups",
           "operating_status" AS "operatingStatus"
         FROM "CrunchbaseCompany"
         ${where}
         ORDER BY ${orderExpr} ${dir} NULLS LAST
         LIMIT ${limitPh} OFFSET ${offsetPh}`,
        ...params
      ),
    ]);

    res.json({
      companies,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
