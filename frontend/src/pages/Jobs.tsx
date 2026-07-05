import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJobListings, fetchJobMatches } from '../api/client';
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
  RefreshCw,
  Sparkles,
  Loader2,
  X,
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

interface MatchBreakdown {
  contentSimilarity: number;
  titleMatch: number;
  requiredSkills: number;
  experience: number;
  seniority: number;
  education: number;
  domain: number;
  workMode: number;
  visa: number;
}

interface JobMatch extends JobListing {
  matchScore: number;
  matchBreakdown: MatchBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  confidence: number;
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

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (score >= 40) return 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300';
  return 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400';
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />;
  return sortDir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
    : <ArrowDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />;
}

function MatchBadge({ job, onClick }: { job: JobMatch; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${scoreColor(job.matchScore)}`}
    >
      {job.matchScore}%
    </button>
  );
}

function MatchPanel({ job, onClose }: { job: JobMatch; onClose: () => void }) {
  const breakdown = [
    { label: 'Content Match', value: job.matchBreakdown.contentSimilarity, max: 30 },
    { label: 'Title / Role', value: job.matchBreakdown.titleMatch, max: 20 },
    { label: 'Skills', value: job.matchBreakdown.requiredSkills, max: 20 },
    { label: 'Experience', value: job.matchBreakdown.experience, max: 10 },
    { label: 'Seniority', value: job.matchBreakdown.seniority, max: 8 },
    { label: 'Education', value: job.matchBreakdown.education, max: 6 },
    { label: 'Domain Fit', value: job.matchBreakdown.domain, max: 3 },
    { label: 'Work Mode', value: job.matchBreakdown.workMode, max: 2 },
    { label: 'Visa', value: job.matchBreakdown.visa, max: 1 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#16161a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl w-full max-w-md p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium uppercase tracking-wide">{job.company}</p>
            <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mt-0.5 leading-snug">{job.jobTitle}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-2xl font-bold px-3 py-1 rounded-xl ${scoreColor(job.matchScore)}`}>
              {job.matchScore}%
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors">
              <X className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Score Breakdown</p>
          {breakdown.map(({ label, value, max }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 dark:text-zinc-400 w-32 shrink-0">{label}</span>
              <div className="flex-1 bg-gray-100 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${value / max >= 0.7 ? 'bg-emerald-500' : value / max >= 0.4 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 w-12 text-right">{value}/{max}</span>
            </div>
          ))}
        </div>

        {/* Data confidence — how much of the score came from real posting data
            vs. neutral filler for fields the listing didn't provide. */}
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Based on <span className="font-medium text-gray-500 dark:text-zinc-400">{Math.round(job.confidence * 100)}%</span> real posting data
          {job.confidence < 0.4 && ' — sparse listing, score is partly estimated'}
        </p>

        {/* Keywords */}
        {job.matchedKeywords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Matched</p>
            <div className="flex flex-wrap gap-1.5">
              {job.matchedKeywords.map(k => (
                <span key={k} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs rounded-full border border-emerald-200 dark:border-emerald-500/30">{k}</span>
              ))}
            </div>
          </div>
        )}

        {job.missingKeywords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Missing</p>
            <div className="flex flex-wrap gap-1.5">
              {job.missingKeywords.slice(0, 8).map(k => (
                <span key={k} className="px-2 py-0.5 bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-zinc-400 text-xs rounded-full border border-gray-200 dark:border-white/10">{k}</span>
              ))}
              {job.missingKeywords.length > 8 && (
                <span className="px-2 py-0.5 bg-gray-50 dark:bg-white/[0.04] text-gray-400 dark:text-zinc-500 text-xs rounded-full border border-gray-200 dark:border-white/10">+{job.missingKeywords.length - 8} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page component ───────────────────────────────────────────────────────────

export default function Jobs() {
  // Browse mode state
  const [listings, setListings] = useState<JobListing[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, companies: 0, locations: 0 });
  const [options, setOptions] = useState<Options>({ companies: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Match mode state
  const [matchMode, setMatchMode] = useState(false);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<JobMatch | null>(null);
  const [matchPage, setMatchPage] = useState(1);
  const [matchSearch, setMatchSearch] = useState('');
  const matchesFetched = useRef(false);

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

  // ── Browse mode load ────────────────────────────────────────────────────────

  const load = useCallback(async (initial = false) => {
    try {
      const data = await fetchJobListings({
        search, company: companyFilter, location: locationFilter,
        jobTitle: jobTitleSearch, sortBy, sortDir, page, pageSize,
      });
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { total: 0, companies: 0, locations: 0 });
      setOptions(data.options ?? { companies: [], locations: [] });
      setLastUpdated(new Date());
      if (initial) setLoading(false);
    } catch (err: any) {
      if (initial) { setError(err.message ?? 'Failed to load job listings'); setLoading(false); }
    }
  }, [search, companyFilter, locationFilter, jobTitleSearch, sortBy, sortDir, page, pageSize]);

  useEffect(() => {
    if (matchMode) return;
    setLoading(true);
    load(true);
  }, [load, matchMode]);

  // ── Match mode load ─────────────────────────────────────────────────────────

  const loadMatches = useCallback(async () => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      const data = await fetchJobMatches();
      setMatches(data.listings ?? []);
      matchesFetched.current = true;
    } catch (err: any) {
      setMatchError(err.response?.data?.error ?? err.message ?? 'Failed to load matches');
    } finally {
      setMatchLoading(false);
    }
  }, []);

  const handleToggleMatchMode = () => {
    if (!matchMode && !matchesFetched.current) {
      loadMatches();
    }
    setMatchMode(m => !m);
    setMatchPage(1);
    setMatchSearch('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (matchMode) {
      await loadMatches();
    } else {
      await load(false);
    }
    setRefreshing(false);
  };

  // Reset to page 1 when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleCompany = (v: string) => { setCompanyFilter(v); setPage(1); };
  const handleLocation = (v: string) => { setLocationFilter(v); setPage(1); };
  const handleJobTitle = (v: string) => { setJobTitleSearch(v); setPage(1); };
  const handlePageSize = (v: number) => { setPageSize(v); setPage(1); };

  const handleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };

  // ── Match mode derived data ─────────────────────────────────────────────────

  const filteredMatches = matches.filter(m => {
    if (!matchSearch) return true;
    const q = matchSearch.toLowerCase();
    return (
      (m.company ?? '').toLowerCase().includes(q) ||
      (m.jobTitle ?? '').toLowerCase().includes(q) ||
      (m.location ?? '').toLowerCase().includes(q)
    );
  });

  const matchTotalPages = Math.ceil(filteredMatches.length / pageSize);
  const matchFrom = filteredMatches.length === 0 ? 0 : (matchPage - 1) * pageSize + 1;
  const matchTo = Math.min(matchPage * pageSize, filteredMatches.length);
  const pagedMatches = filteredMatches.slice((matchPage - 1) * pageSize, matchPage * pageSize);

  // ── Browse mode derived data ────────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const isLoading = matchMode ? matchLoading : loading;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (error && !matchMode) {
    return <div className="flex items-center justify-center h-64 text-red-500 dark:text-red-400 text-sm">{error}</div>;
  }

  const currentTotal = matchMode ? filteredMatches.length : total;
  const currentFrom = matchMode ? matchFrom : from;
  const currentTo = matchMode ? matchTo : to;
  const currentTotalPages = matchMode ? matchTotalPages : totalPages;
  const currentPage = matchMode ? matchPage : page;
  const setCurrentPage = matchMode ? setMatchPage : setPage;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Jobs</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Browse and filter open positions</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {lastUpdated && !matchMode && (
            <span className="text-xs text-gray-400 dark:text-zinc-500 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleToggleMatchMode}
            disabled={matchLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:cursor-wait ${
              matchMode
                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                : 'text-gray-600 dark:text-zinc-400 bg-white dark:bg-[#16161a] border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
            }`}
          >
            {matchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {matchLoading ? 'Generando…' : matchMode ? 'Exit Match Mode' : 'Match Mode'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-zinc-400 bg-white dark:bg-[#16161a] border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/15">
            <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Total Jobs</p>
            <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">{(matchMode ? matches.length : stats.total).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Companies</p>
            <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">{stats.companies.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 px-5 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
            <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Locations</p>
            <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">{stats.locations.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 p-4">
        {matchMode ? (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search matches…"
              value={matchSearch}
              onChange={e => { setMatchSearch(e.target.value); setMatchPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
              <input
                type="text" placeholder="Search jobs…" value={search}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <select value={companyFilter} onChange={e => handleCompany(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-[#16161a] text-gray-700 dark:text-zinc-300">
              <option value="">All Companies</option>
              {options.companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={locationFilter} onChange={e => handleLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-[#16161a] text-gray-700 dark:text-zinc-300">
              <option value="">All Locations</option>
              {options.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
              <input type="text" placeholder="Filter by title…" value={jobTitleSearch}
                onChange={e => handleJobTitle(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Match error banner ── */}
      {matchMode && matchError && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {matchError}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.04]">
                {matchMode && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap w-16">
                    Match
                  </th>
                )}
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
                    onClick={() => !matchMode && handleSort(key)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap ${!matchMode ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-zinc-200' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {label}
                      {!matchMode && <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                matchMode ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-20">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <Loader2 className="h-7 w-7 text-indigo-500 dark:text-indigo-400 animate-spin" />
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">Analyzing your matches…</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                            Scoring {stats.total > 0 ? `${stats.total.toLocaleString()} jobs` : 'jobs'} against your profile
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" style={{ width: `${60 + (j * 10) % 30}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                )
              ) : matchMode ? (
                pagedMatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-gray-400 dark:text-zinc-500 text-sm">
                      No matches found.
                    </td>
                  </tr>
                ) : (
                  pagedMatches.map((job, idx) => (
                    <tr key={job.id} className={`border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-white/[0.03]'}`}>
                      <td className="px-4 py-3">
                        <MatchBadge job={job} onClick={() => setSelectedMatch(job)} />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100 whitespace-nowrap max-w-[180px] truncate">{job.company ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-zinc-300 max-w-[260px] truncate">{job.jobTitle ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 whitespace-nowrap max-w-[160px] truncate">{job.location ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 dark:text-zinc-500 whitespace-nowrap">{formatDate(job.scrapedAt)}</td>
                      <td className="px-4 py-3">
                        {job.jobUrl ? (
                          <a href={job.jobUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors whitespace-nowrap">
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Position
                          </a>
                        ) : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                listings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-gray-400 dark:text-zinc-500 text-sm">
                      No positions match your filters.
                    </td>
                  </tr>
                ) : (
                  listings.map((job, idx) => (
                    <tr key={job.id} className={`border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-white/[0.03]'}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100 whitespace-nowrap max-w-[180px] truncate">{job.company ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-zinc-300 max-w-[260px] truncate">{job.jobTitle ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 whitespace-nowrap max-w-[160px] truncate">{job.location ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 dark:text-zinc-500 whitespace-nowrap">{formatDate(job.scrapedAt)}</td>
                      <td className="px-4 py-3">
                        {job.jobUrl ? (
                          <a href={job.jobUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors whitespace-nowrap">
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Position
                          </a>
                        ) : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination bar ── */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-zinc-400">
            <span>
              {currentTotal === 0 ? 'No results' : `Showing ${currentFrom}–${currentTo} of ${currentTotal.toLocaleString()} jobs`}
            </span>
            <select value={pageSize} onChange={e => handlePageSize(Number(e.target.value))}
              className="text-xs border border-gray-200 dark:border-white/10 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[#16161a]">
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage <= 1}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              First
            </button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
            </button>

            {Array.from({ length: Math.min(5, currentTotalPages) }, (_, i) => {
              let p: number;
              if (currentTotalPages <= 5) p = i + 1;
              else if (currentPage <= 3) p = i + 1;
              else if (currentPage >= currentTotalPages - 2) p = currentTotalPages - 4 + i;
              else p = currentPage - 2 + i;
              return (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`min-w-[30px] px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${currentPage === p ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.08]'}`}>
                  {p}
                </button>
              );
            })}

            <button onClick={() => setCurrentPage(p => Math.min(currentTotalPages, p + 1))} disabled={currentPage >= currentTotalPages}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
            </button>
            <button onClick={() => setCurrentPage(currentTotalPages)} disabled={currentPage >= currentTotalPages}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Last
            </button>
          </div>
        </div>
      </div>

      {/* ── Match detail panel ── */}
      {selectedMatch && (
        <MatchPanel job={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}
