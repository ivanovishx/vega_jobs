import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJobListings } from '../api/client';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Building2,
  MapPin,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface JobListing {
  id: string;
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  jobUrl: string | null;
  scrapedAt: string | null;
}

interface Stats {
  total: number;
  companies: number;
  locations: number;
}

interface Options {
  companies: string[];
  locations: string[];
}

type SortCol = 'company' | 'jobTitle' | 'location' | 'scrapedAt';
type SortDir = 'asc' | 'desc';

// ── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 5 * 60_000; // 5 minutes
const PAGE_SIZES = [25, 50, 100];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
  return sortDir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
    : <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />;
}

// ── Page component ───────────────────────────────────────────────────────────

export default function Jobs() {
  // Data
  const [listings, setListings] = useState<JobListing[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, companies: 0, locations: 0 });
  const [options, setOptions] = useState<Options>({ companies: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTitleSearch, setJobTitleSearch] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<SortCol>('scrapedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (initial = false) => {
    try {
      const data = await fetchJobListings({
        search,
        company: companyFilter,
        location: locationFilter,
        jobTitle: jobTitleSearch,
        sortBy,
        sortDir,
        page,
        pageSize,
      });
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { total: 0, companies: 0, locations: 0 });
      setOptions(data.options ?? { companies: [], locations: [] });
      if (initial) setLoading(false);
    } catch (err: any) {
      if (initial) {
        setError(err.message ?? 'Failed to load job listings');
        setLoading(false);
      }
    }
  }, [search, companyFilter, locationFilter, jobTitleSearch, sortBy, sortDir, page, pageSize]);

  // Reload when any filter/sort/page changes
  useEffect(() => {
    setLoading(true);
    load(true);
  }, [load]);

  // Polling for live updates
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => load(false), POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  // Reset to page 1 when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleCompany = (v: string) => { setCompanyFilter(v); setPage(1); };
  const handleLocation = (v: string) => { setLocationFilter(v); setPage(1); };
  const handleJobTitle = (v: string) => { setJobTitleSearch(v); setPage(1); };
  const handlePageSize = (v: number) => { setPageSize(v); setPage(1); };

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Browse and filter open positions</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Briefcase className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Jobs</p>
            <p className="text-xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Companies</p>
            <p className="text-xl font-bold text-gray-900">{stats.companies.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50">
            <MapPin className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Locations</p>
            <p className="text-xl font-bold text-gray-900">{stats.locations.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Global search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Company dropdown */}
          <select
            value={companyFilter}
            onChange={e => handleCompany(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-700"
          >
            <option value="">All Companies</option>
            {options.companies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Location dropdown */}
          <select
            value={locationFilter}
            onChange={e => handleLocation(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-700"
          >
            <option value="">All Locations</option>
            {options.locations.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Job title search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by title…"
              value={jobTitleSearch}
              onChange={e => handleJobTitle(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {(
                  [
                    { key: 'company', label: 'Company' },
                    { key: 'jobTitle', label: 'Job Title' },
                    { key: 'location', label: 'Location' },
                    { key: 'scrapedAt', label: 'Date Added' },
                  ] as { key: SortCol; label: string }[]
                ).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {label}
                      <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (j * 10) % 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : listings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-gray-400 text-sm">
                    No positions match your filters.
                  </td>
                </tr>
              ) : (
                listings.map((job, idx) => (
                  <tr
                    key={job.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap max-w-[180px] truncate">
                      {job.company ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[260px] truncate">
                      {job.jobTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap max-w-[160px] truncate">
                      {job.location ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {formatDate(job.scrapedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {job.jobUrl ? (
                        <a
                          href={job.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Position
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

        {/* ── Pagination bar ── */}
        <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total.toLocaleString()} jobs`}
            </span>
            <select
              value={pageSize}
              onChange={e => handlePageSize(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {PAGE_SIZES.map(n => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[30px] px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    page === p
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
