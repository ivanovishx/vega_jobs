import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCompanies } from '../api/client';
import { Search, Building2, RefreshCw, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface CompanyRow {
  id: string;
  name: string | null;
  rank: number | null;
  website: string | null;
  description1: string | null;
}

type SortCol = 'rank' | 'name' | 'website';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (col !== sortBy) return <ChevronsUpDown className="h-3 w-3 text-gray-300 ml-1 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-indigo-500 ml-1 shrink-0" />
    : <ChevronDown className="h-3 w-3 text-indigo-500 ml-1 shrink-0" />;
}

export default function Companies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<SortCol>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  // Debounce search → reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!isFirstLoad.current) setFetching(true);
    try {
      const data = await fetchCompanies({ search: debouncedSearch, page, limit, sortBy, sortDir });
      setCompanies(data.companies ?? []);
      setTotal(data.total ?? 0);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (isFirstLoad.current) setError(err.message ?? 'Failed to load companies');
    } finally {
      if (isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
      setFetching(false);
    }
  }, [debouncedSearch, page, limit, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSort = (col: SortCol) => {
    if (col === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>;
  }

  const colHeaders: { key: SortCol | null; label: string }[] = [
    { key: 'rank', label: 'Rank' },
    { key: 'name', label: 'Company Name' },
    { key: null, label: 'Description' },
    { key: 'website', label: 'Website' },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">Companies directory</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3 max-w-xs">
        <div className="p-2 rounded-lg bg-emerald-50">
          <Building2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Total Companies</p>
          <p className="text-xl font-bold text-gray-900">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* Search + page size */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity ${fetching ? 'opacity-60' : 'opacity-100'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {colHeaders.map(col => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => handleSort(col.key as SortCol) : undefined}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {col.key && <SortIcon col={col.key as SortCol} sortBy={sortBy} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${40 + (j * 15) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-gray-400 text-sm">
                    No companies match your search.
                  </td>
                </tr>
              ) : (
                companies.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${idx % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs tabular-nums w-16">
                      {c.rank ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {c.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-sm">
                      {c.description1
                        ? <span className="line-clamp-2 text-xs leading-relaxed">{c.description1}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {c.website ? (
                        <a
                          href={normalizeUrl(c.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors whitespace-nowrap text-xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Visit
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {((page - 1) * limit + 1).toLocaleString()}–{Math.min(page * limit, total).toLocaleString()} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >«</button>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >‹ Prev</button>
              <span className="px-3 py-1 text-xs text-gray-500">
                {page} / {totalPages.toLocaleString()}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >Next ›</button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
