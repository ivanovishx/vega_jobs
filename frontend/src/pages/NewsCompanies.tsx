import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchNewsCompanies, fetchNewsCompanyFacets } from '../api/client';
import {
  Search, Building2, RefreshCw, ExternalLink,
  ChevronUp, ChevronDown, ChevronsUpDown, X,
} from 'lucide-react';

interface CompanyRow {
  id: string;
  name: string | null;
  rank: number | null;
  website: string | null;
  description1: string | null;
  crunchbaseLink: string | null;
  city: string | null;
  state: string | null;
  foundedYear: number | null;
  fundingStage: string | null;
  fundingTotalUsd: number | null;
  lastFundingAt: string | null;
  lastFundingType: string | null;
  categoryGroups: string | null;
  operatingStatus: string | null;
}

interface FacetOption { value: string; count: number }
interface Facets { categoryGroups: FacetOption[]; states: FacetOption[]; stages: FacetOption[] }

type SortCol = 'rank' | 'name' | 'website' | 'founded' | 'lastFunding' | 'fundingTotal';
type SortDir = 'asc' | 'desc';
type SearchScope = 'all' | 'name' | 'description' | 'website';
type StatusFilter = 'active' | 'closed' | 'all';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DESC_FIRST: SortCol[] = ['founded', 'lastFunding', 'fundingTotal'];

const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All fields',
  name: 'Name',
  description: 'Description',
  website: 'Website',
};

const STAGE_LABELS: Record<string, string> = {
  seed: 'Seed',
  early_stage_venture: 'Early Stage',
  late_stage_venture: 'Late Stage',
  private_equity: 'Private Equity',
  ipo: 'IPO',
  m_and_a: 'M&A',
};

const FUNDED_WITHIN_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
];

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ');
}

function fmtMoney(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${esc})`, 'ig'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase()
          ? <mark key={i} className="bg-amber-200/70 dark:bg-amber-400/30 text-inherit rounded-[2px]">{p}</mark>
          : p
      )}
    </>
  );
}

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (col !== sortBy) return <ChevronsUpDown className="h-3 w-3 text-gray-300 dark:text-zinc-600 ml-1 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-indigo-500 dark:text-indigo-400 ml-1 shrink-0" />
    : <ChevronDown className="h-3 w-3 text-indigo-500 dark:text-indigo-400 ml-1 shrink-0" />;
}

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}

function MultiSelect({ label, options, selected, onChange, searchable }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const shown = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
          selected.length
            ? 'border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10'
            : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c21] shadow-lg">
          {searchable && (
            <div className="p-2 border-b border-gray-100 dark:border-white/[0.07]">
              <input
                type="text"
                autoFocus
                placeholder={`Filter ${label.toLowerCase()}…`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-transparent"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">No matches</div>
            ) : (
              shown.map(o => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count != null && (
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 tabular-nums">{o.count.toLocaleString()}</span>
                  )}
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="p-1.5 border-t border-gray-100 dark:border-white/[0.07]">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full text-xs text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 py-1"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
    <div className={`flex items-center justify-between px-4 py-2.5 ${borderClass} border-gray-100 dark:border-white/[0.07] flex-wrap gap-2`}>
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 shrink-0 flex-wrap">
        {position === 'top' && (
          <span className="text-gray-400 dark:text-zinc-500 pr-2 border-r border-gray-200 dark:border-white/10 mr-1">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/[0.06] rounded font-mono text-gray-500 dark:text-zinc-400">Shift+Ctrl+←/→</kbd> to navigate
          </span>
        )}
        <span>Companies per page:</span>
        <select
          value={limit}
          onChange={e => onLimitChange(Number(e.target.value))}
          className="border border-gray-200 dark:border-white/10 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-2 hidden sm:inline">
          {((page - 1) * limit + 1).toLocaleString()}–{Math.min(page * limit, total).toLocaleString()} of {total.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1}
          className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-white/10 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed">«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-white/10 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed">‹ Prev</button>
        <span className="px-3 py-1 text-xs text-gray-500 dark:text-zinc-400 select-none">{page} / {totalPages.toLocaleString()}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-white/10 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed">Next ›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}
          className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-white/10 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed">»</button>
      </div>
    </div>
  );
}

// Debounced (text-input) filter values applied to the query as one unit.
interface AppliedInputs {
  q: string;
  foundedFrom: string;
  foundedTo: string;
  minFundingM: string;
  maxFundingM: string;
}

export default function NewsCompanies() {
  const [, setSearchParams] = useSearchParams();
  // Read the initial state from the URL once so filtered views survive
  // refresh and can be shared as links.
  const [init] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search).entries()));

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets>({ categoryGroups: [], states: [], stages: [] });

  // Text inputs (debounced before querying)
  const [search, setSearch] = useState(init.q ?? '');
  const [foundedFromInput, setFoundedFromInput] = useState(init.ff ?? '');
  const [foundedToInput, setFoundedToInput] = useState(init.ft ?? '');
  const [minFundingInput, setMinFundingInput] = useState(init.minf ?? '');
  const [maxFundingInput, setMaxFundingInput] = useState(init.maxf ?? '');
  const [applied, setApplied] = useState<AppliedInputs>({
    q: init.q ?? '',
    foundedFrom: init.ff ?? '',
    foundedTo: init.ft ?? '',
    minFundingM: init.minf ?? '',
    maxFundingM: init.maxf ?? '',
  });

  // Instant filters
  const [searchIn, setSearchIn] = useState<SearchScope>((init.in as SearchScope) ?? 'all');
  const [status, setStatus] = useState<StatusFilter>((init.status as StatusFilter) ?? 'active');
  const [stages, setStages] = useState<string[]>(init.stages ? init.stages.split(',') : []);
  const [cats, setCats] = useState<string[]>(init.cats ? init.cats.split(',') : []);
  const [statesSel, setStatesSel] = useState<string[]>(init.states ? init.states.split(',') : []);
  const [fundedWithin, setFundedWithin] = useState(init.fw ?? '');

  const [page, setPage] = useState(parseInt(init.page) || 1);
  const [limit, setLimit] = useState(parseInt(init.limit) || 50);
  const [sortBy, setSortBy] = useState<SortCol>((init.sort as SortCol) ?? 'rank');
  const [sortDir, setSortDir] = useState<SortDir>((init.dir as SortDir) ?? 'asc');

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);
  const appliedRef = useRef(applied);
  appliedRef.current = applied;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Debounce text inputs → apply together and reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      const next: AppliedInputs = {
        q: search,
        foundedFrom: foundedFromInput,
        foundedTo: foundedToInput,
        minFundingM: minFundingInput,
        maxFundingM: maxFundingInput,
      };
      if (JSON.stringify(next) !== JSON.stringify(appliedRef.current)) {
        setApplied(next);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, foundedFromInput, foundedToInput, minFundingInput, maxFundingInput]);

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

  // Facet values for the dropdowns (cached server-side)
  useEffect(() => {
    fetchNewsCompanyFacets().then(setFacets).catch(() => {});
  }, []);

  // Keep the URL in sync so any filtered view is shareable
  useEffect(() => {
    const qp: Record<string, string> = {};
    if (applied.q) qp.q = applied.q;
    if (searchIn !== 'all') qp.in = searchIn;
    if (status !== 'active') qp.status = status;
    if (stages.length) qp.stages = stages.join(',');
    if (cats.length) qp.cats = cats.join(',');
    if (statesSel.length) qp.states = statesSel.join(',');
    if (applied.foundedFrom) qp.ff = applied.foundedFrom;
    if (applied.foundedTo) qp.ft = applied.foundedTo;
    if (fundedWithin) qp.fw = fundedWithin;
    if (applied.minFundingM) qp.minf = applied.minFundingM;
    if (applied.maxFundingM) qp.maxf = applied.maxFundingM;
    if (page !== 1) qp.page = String(page);
    if (limit !== 50) qp.limit = String(limit);
    if (sortBy !== 'rank') qp.sort = sortBy;
    if (sortDir !== 'asc') qp.dir = sortDir;
    setSearchParams(qp, { replace: true });
  }, [applied, searchIn, status, stages, cats, statesSel, fundedWithin, page, limit, sortBy, sortDir, setSearchParams]);

  const load = useCallback(async () => {
    if (!isFirstLoad.current) setFetching(true);
    try {
      const params: Record<string, string | number> = { page, limit, sortBy, sortDir, status };
      if (applied.q) {
        params.search = applied.q;
        params.searchIn = searchIn;
      }
      if (stages.length) params.stages = stages.join(',');
      if (cats.length) params.categories = cats.join(',');
      if (statesSel.length) params.states = statesSel.join(',');
      if (applied.foundedFrom) params.foundedFrom = applied.foundedFrom;
      if (applied.foundedTo) params.foundedTo = applied.foundedTo;
      if (fundedWithin) params.fundedWithinDays = fundedWithin;
      const minF = parseFloat(applied.minFundingM);
      if (!isNaN(minF)) params.minFunding = String(minF * 1e6);
      const maxF = parseFloat(applied.maxFundingM);
      if (!isNaN(maxF)) params.maxFunding = String(maxF * 1e6);

      const data = await fetchNewsCompanies(params);
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
  }, [applied, searchIn, status, stages, cats, statesSel, fundedWithin, page, limit, sortBy, sortDir]);

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
      setSortDir(DESC_FIRST.includes(col) ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handlePageChange = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));
  const handleLimitChange = (l: number) => { setLimit(l); setPage(1); };
  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const clearAll = () => {
    setSearch(''); setFoundedFromInput(''); setFoundedToInput('');
    setMinFundingInput(''); setMaxFundingInput('');
    setApplied({ q: '', foundedFrom: '', foundedTo: '', minFundingM: '', maxFundingM: '' });
    setSearchIn('all'); setStatus('active'); setStages([]); setCats([]); setStatesSel([]);
    setFundedWithin('');
    setPage(1);
  };

  // Active filter chips (search shown in its own input, so not repeated here)
  const chips: { label: string; onClear: () => void }[] = [];
  if (status !== 'active') chips.push({ label: `Status: ${status}`, onClear: () => resetPage(setStatus)('active') });
  stages.forEach(s => chips.push({ label: stageLabel(s), onClear: () => resetPage(setStages)(stages.filter(v => v !== s)) }));
  cats.forEach(c => chips.push({ label: c, onClear: () => resetPage(setCats)(cats.filter(v => v !== c)) }));
  statesSel.forEach(s => chips.push({ label: s, onClear: () => resetPage(setStatesSel)(statesSel.filter(v => v !== s)) }));
  if (applied.foundedFrom || applied.foundedTo) {
    chips.push({
      label: `Founded ${applied.foundedFrom || '…'}–${applied.foundedTo || '…'}`,
      onClear: () => {
        setFoundedFromInput(''); setFoundedToInput('');
        setApplied(a => ({ ...a, foundedFrom: '', foundedTo: '' }));
        setPage(1);
      },
    });
  }
  if (fundedWithin) {
    chips.push({
      label: FUNDED_WITHIN_OPTIONS.find(o => o.value === fundedWithin)?.label ?? 'Recently funded',
      onClear: () => resetPage(setFundedWithin)(''),
    });
  }
  if (applied.minFundingM || applied.maxFundingM) {
    chips.push({
      label: `Funding ${applied.minFundingM ? `$${applied.minFundingM}M` : '…'}–${applied.maxFundingM ? `$${applied.maxFundingM}M` : '…'}`,
      onClear: () => {
        setMinFundingInput(''); setMaxFundingInput('');
        setApplied(a => ({ ...a, minFundingM: '', maxFundingM: '' }));
        setPage(1);
      },
    });
  }
  const hasFilters = chips.length > 0 || applied.q !== '';

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500 dark:text-red-400 text-sm">{error}</div>;
  }

  const colHeaders: { key: SortCol | null; label: string }[] = [
    { key: 'rank', label: 'Rank' },
    { key: 'name', label: 'Company' },
    { key: null, label: 'Description' },
    { key: null, label: 'Location' },
    { key: 'founded', label: 'Founded' },
    { key: 'fundingTotal', label: 'Funding' },
    { key: 'lastFunding', label: 'Last Funded' },
  ];

  const highlightName = applied.q && (searchIn === 'all' || searchIn === 'name') ? applied.q : '';
  const highlightDesc = applied.q && (searchIn === 'all' || searchIn === 'description') ? applied.q : '';

  const paginationProps = { page, totalPages, total, limit, onPageChange: handlePageChange, onLimitChange: handleLimitChange };

  const inputClass = 'border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">News Companies</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Crunchbase companies directory</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-zinc-500 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-zinc-400 bg-white dark:bg-[#16161a] border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 px-5 py-4 flex items-center gap-3 max-w-xs">
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
          <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">{hasFilters ? 'Matching Companies' : 'Total Companies'}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-3">

        {/* Row 1: search + scope + status */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search companies…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
            <span className="hidden sm:inline">in</span>
            <select
              value={searchIn}
              onChange={e => resetPage(setSearchIn)(e.target.value as SearchScope)}
              className={inputClass}
            >
              {(Object.keys(SCOPE_LABELS) as SearchScope[]).map(s => (
                <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
            {(['active', 'closed', 'all'] as StatusFilter[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => resetPage(setStatus)(s)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  status === s
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <MultiSelect
            label="Stage"
            options={facets.stages.map(s => ({ value: s.value, label: stageLabel(s.value), count: s.count }))}
            selected={stages}
            onChange={resetPage(setStages)}
          />
          <MultiSelect
            label="Industry"
            options={facets.categoryGroups.map(c => ({ value: c.value, label: c.value, count: c.count }))}
            selected={cats}
            onChange={resetPage(setCats)}
            searchable
          />
          <MultiSelect
            label="State"
            options={facets.states.map(s => ({ value: s.value, label: s.value, count: s.count }))}
            selected={statesSel}
            onChange={resetPage(setStatesSel)}
            searchable
          />
          <select
            value={fundedWithin}
            onChange={e => resetPage(setFundedWithin)(e.target.value)}
            className={`${inputClass} ${fundedWithin ? 'border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-zinc-400'}`}
            title="Last funding round within"
          >
            {FUNDED_WITHIN_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.value ? `Funded: ${o.label.toLowerCase()}` : 'Funded: any time'}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
            <span>Founded</span>
            <input type="number" placeholder="from" min={1600} max={2100} value={foundedFromInput}
              onChange={e => setFoundedFromInput(e.target.value)} className={`${inputClass} w-[70px]`} />
            <span>–</span>
            <input type="number" placeholder="to" min={1600} max={2100} value={foundedToInput}
              onChange={e => setFoundedToInput(e.target.value)} className={`${inputClass} w-[70px]`} />
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
            <span>Funding $M</span>
            <input type="number" placeholder="min" min={0} value={minFundingInput}
              onChange={e => setMinFundingInput(e.target.value)} className={`${inputClass} w-[70px]`} />
            <span>–</span>
            <input type="number" placeholder="max" min={0} value={maxFundingInput}
              onChange={e => setMaxFundingInput(e.target.value)} className={`${inputClass} w-[70px]`} />
          </div>
        </div>

        {/* Row 3: active filter chips */}
        {chips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-gray-100 dark:border-white/[0.07]">
            {chips.map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
              >
                {chip.label}
                <button type="button" onClick={chip.onClear} className="hover:text-indigo-900 dark:hover:text-indigo-100" aria-label={`Remove ${chip.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table card */}
      <div className={`bg-white dark:bg-[#16161a] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden transition-opacity ${fetching ? 'opacity-60' : 'opacity-100'}`}>

        {/* Top pagination */}
        {!loading && (
          <PaginationBar {...paginationProps} position="top" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.04]">
                {colHeaders.map(col => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => handleSort(col.key as SortCol) : undefined}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-gray-700 dark:hover:text-zinc-200 select-none' : ''}`}
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
                  <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                    {Array.from({ length: colHeaders.length }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" style={{ width: `${40 + (j * 12) % 45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={colHeaders.length} className="px-4 py-16 text-center text-gray-400 dark:text-zinc-500 text-sm">
                    No companies match your filters.
                  </td>
                </tr>
              ) : (
                companies.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors ${idx % 2 !== 0 ? 'bg-gray-50/40 dark:bg-white/[0.03]' : ''}`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3 text-gray-400 dark:text-zinc-500 font-mono text-xs tabular-nums w-14 shrink-0">
                      {c.rank ?? '—'}
                    </td>

                    {/* Company: name linked to the website, URL + categories underneath */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {c.website ? (
                          <a
                            href={normalizeUrl(c.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {c.name ? <Highlight text={c.name} term={highlightName} /> : '—'}
                          </a>
                        ) : (
                          c.name ? <Highlight text={c.name} term={highlightName} /> : '—'
                        )}
                        {c.operatingStatus === 'closed' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">Closed</span>
                        )}
                      </div>
                      {c.website && (
                        <a
                          href={normalizeUrl(c.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-normal text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors text-xs truncate max-w-[220px]"
                          title={c.website}
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{displayUrl(c.website)}</span>
                        </a>
                      )}
                      {c.categoryGroups && (
                        <div className="text-[11px] font-normal text-gray-400 dark:text-zinc-500 truncate max-w-[220px]">
                          {c.categoryGroups.split(', ').slice(0, 2).join(' · ')}
                        </div>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 max-w-xs">
                      {c.description1
                        ? <span className="line-clamp-2 text-xs leading-relaxed"><Highlight text={c.description1} term={highlightDesc} /></span>
                        : <span className="text-gray-300 dark:text-zinc-600">—</span>
                      }
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                      {c.city || c.state
                        ? [c.city, c.state].filter(Boolean).join(', ')
                        : <span className="text-gray-300 dark:text-zinc-600">—</span>
                      }
                    </td>

                    {/* Founded */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      {c.foundedYear ?? <span className="text-gray-300 dark:text-zinc-600">—</span>}
                    </td>

                    {/* Funding: total + stage */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {c.fundingTotalUsd != null || c.fundingStage ? (
                        <div className="flex items-center gap-1.5">
                          {c.fundingTotalUsd != null && (
                            <span className="font-medium text-gray-700 dark:text-zinc-300 tabular-nums">{fmtMoney(c.fundingTotalUsd)}</span>
                          )}
                          {c.fundingStage && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                              {stageLabel(c.fundingStage)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Last funded */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                      {c.lastFundingAt ? (
                        <>
                          {c.lastFundingAt}
                          {c.lastFundingType && (
                            <div className="text-[10px] text-gray-400 dark:text-zinc-500 capitalize">{c.lastFundingType.replace(/_/g, ' ')}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300 dark:text-zinc-600">—</span>
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
