import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCompanies } from '../api/client';
import { Search, Building2, RefreshCw, ExternalLink } from 'lucide-react';

interface CompanyRow {
  companyName: string;
  website: string | null;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function Companies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    try {
      const data = await fetchCompanies();
      setCompanies(data.companies ?? []);
      setLastUpdated(new Date());
      if (initial) setLoading(false);
    } catch (err: any) {
      if (initial) {
        setError(err.message ?? 'Failed to load companies');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c => c.companyName.toLowerCase().includes(q));
  }, [companies, search]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">Companies in the scrape queue</p>
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

      {/* ── Stats ── */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-3 max-w-xs">
        <div className="p-2 rounded-lg bg-emerald-50">
          <Building2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Total Companies</p>
          <p className="text-xl font-bold text-gray-900">{filtered.length.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Search ── */}
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

      {/* ── List ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Company Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Website
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 2 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + (j * 15) % 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-16 text-center text-gray-400 text-sm">
                    No companies match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c.companyName}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
                    <td className="px-4 py-3">
                      {c.website ? (
                        <a
                          href={normalizeUrl(c.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Visit Website
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
      </div>
    </div>
  );
}
