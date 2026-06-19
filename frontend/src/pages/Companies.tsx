import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCompanies } from '../api/client';
import { Search, Building2, RefreshCw, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface CompanyRow {
  id: string;
  name: string | null;
  rank: number | null;
  website: string | null;
  description1: string | null;
  crunchbaseLink: string | null;
  linkCareers1: string | null;
  linkCareers2: string | null;
}

type SortCol = 'rank' | 'name' | 'website';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function isValidUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const s = url.trim().toLowerCase();
  if (!s || s === 'null' || s === 'undefined' || s === 'n/a') return false;
  try { return Boolean(new URL(url.startsWith('http') ? url : `https://${url}`)); }
  catch { return false; }
}

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (col !== sortBy) return <ChevronsUpDown className="h-3 w-3 text-gray-300 ml-1 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-indigo-500 ml-1 shrink-0" />
    : <ChevronDown className="h-3 w-3 text-indigo-500 ml-1 shrink-0" />;
}

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
  onLimitChange: (l: number) => void;
  position: 'top' | 'bottom';
}

function PaginationBar({ page, totalPages, total, limit, onPageChange, onLimitChange, position }: PaginationBarProps) {
  const borderClass = position === 'top' ? 'border-b' : 'border-t';
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${borderClass} border-gray-100 flex-wrap gap-2`}>
      <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0 flex-wrap">
        {position === 'top' && (
          <span className="text-gray-400 pr-2 border-r border-gray-200 mr-1">
            <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-gray-500">Shift+Ctrl+←/→</kbd> to navigate
          </span>
        )}
        <span>Companies per page:</span>
        <select
          value={limit}
          onChange={e => onLimitChange(Number(e.target.value))}
          className="border border-gray-200 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-2 hidden sm:inline">
          {((page - 1) * limit + 1).toLocaleString()}–{Math.min(page * limit, total).toLocaleString()} of {total.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1}
          className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">‹ Prev</button>
        <span className="px-3 py-1 text-xs text-gray-500 select-none">{page} / {totalPages.toLocaleString()}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next ›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}
          className="px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
      </div>
    </div>
  );
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

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Debounce search → reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Keyboard shortcuts: Shift+Ctrl+Arrow to change page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.shiftKey || !e.ctrlKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPage(p => Math.min(p + 1, totalPages));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPage(p => Math.max(p - 1, 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [totalPages]);

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

  const handlePageChange = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));
  const handleLimitChange = (l: number) => { setLimit(l); setPage(1); };

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>;
  }

  const colHeaders: { key: SortCol | null; label: string }[] = [
    { key: 'rank', label: 'Rank' },
    { key: 'name', label: 'Company' },
    { key: 'website', label: 'Website' },
    { key: null, label: 'Description' },
    { key: null, label: 'Careers' },
  ];

  const paginationProps = { page, totalPages, total, limit, onPageChange: handlePageChange, onLimitChange: handleLimitChange };

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

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table card */}
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity ${fetching ? 'opacity-60' : 'opacity-100'}`}>

        {/* Top pagination */}
        {!loading && (
          <PaginationBar {...paginationProps} position="top" />
        )}

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
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${40 + (j * 12) % 45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-gray-400 text-sm">
                    No companies match your search.
                  </td>
                </tr>
              ) : (
                companies.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${idx % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs tabular-nums w-14 shrink-0">
                      {c.rank ?? '—'}
                    </td>

                    {/* Company name → crunchbaseLink */}
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {c.crunchbaseLink ? (
                        <a
                          href={normalizeUrl(c.crunchbaseLink)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-indigo-600 transition-colors"
                        >
                          {c.name ?? '—'}
                        </a>
                      ) : (
                        c.name ?? '—'
                      )}
                    </td>

                    {/* Website — show URL */}
                    <td className="px-4 py-3 max-w-[180px]">
                      {c.website ? (
                        <a
                          href={normalizeUrl(c.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors text-xs truncate max-w-full"
                          title={c.website}
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{displayUrl(c.website)}</span>
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      {c.description1
                        ? <span className="line-clamp-2 text-xs leading-relaxed">{c.description1}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>

                    {/* Careers */}
                    <td className="px-4 py-3">
                      {isValidUrl(c.linkCareers1) || isValidUrl(c.linkCareers2) ? (
                        <div className="flex flex-col gap-1">
                          {isValidUrl(c.linkCareers1) && (
                            <a
                              href={normalizeUrl(c.linkCareers1)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 transition-colors text-xs truncate max-w-[160px]"
                              title={c.linkCareers1}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{displayUrl(c.linkCareers1)}</span>
                            </a>
                          )}
                          {isValidUrl(c.linkCareers2) && (
                            <a
                              href={normalizeUrl(c.linkCareers2)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 transition-colors text-xs truncate max-w-[160px]"
                              title={c.linkCareers2}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{displayUrl(c.linkCareers2)}</span>
                            </a>
                          )}
                        </div>
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

        {/* Bottom pagination */}
        {!loading && (
          <PaginationBar {...paginationProps} position="bottom" />
        )}
      </div>

    </div>
  );
}
