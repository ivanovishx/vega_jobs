import { useEffect, useState } from 'react';
import { fetchApplications, createApplication, autofillApplication } from '../api/client';
import { Link } from 'react-router-dom';

const CATEGORY_OPTIONS = ['Job', 'Careers', 'Company'] as const;
type CategoryFilter = 'All' | typeof CATEGORY_OPTIONS[number] | 'Uncategorized';

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  Job: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  Careers: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  Company: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

export default function SavedJobs() {
  const [applications, setApplications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const loadSavedJobs = async () => {
    try {
      const res = await fetchApplications('To Apply');
      setApplications(res.applications);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSavedJobs();
  }, []);

  const handleManualScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl) return;
    setIsScraping(true);
    
    try {
      const formData = new FormData();
      formData.append('url', scrapeUrl);
      
      const parsedData = await autofillApplication(formData);
      
      if (!parsedData.companyName || !parsedData.jobTitle || parsedData.jobTitle === 'Unknown Title') {
        alert("Could not identify a valid job position at this URL.");
        setIsScraping(false);
        return;
      }

      await createApplication({
        companyName: parsedData.companyName,
        jobTitle: parsedData.jobTitle,
        jobUrl: scrapeUrl,
        location: parsedData.location,
        salaryRange: parsedData.salaryRange,
        notes: parsedData.notes,
        status: 'To Apply',
        dateApplied: new Date().toISOString()
      });

      setScrapeUrl('');
      await loadSavedJobs();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to scrape URL');
    } finally {
      setIsScraping(false);
    }
  };

  const filteredApplications = applications.filter(app => {
    if (categoryFilter !== 'All') {
      const cat = app.category || 'Uncategorized';
      if (cat !== categoryFilter) return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (app.companyName && app.companyName.toLowerCase().includes(query)) ||
      (app.jobTitle && app.jobTitle.toLowerCase().includes(query)) ||
      (app.location && app.location.toLowerCase().includes(query)) ||
      (app.salaryRange && app.salaryRange.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Positions to Apply
          </h2>
          <p className="mt-2 text-sm text-gray-700">A pipeline of job opportunities to apply to — scraped from the web or entered manually.</p>
        </div>
      </div>
      
      {/* Manual URL Scrape Section */}
      <div className="bg-white p-4 shadow rounded-lg mb-6 border border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Manually Add a Position</h3>
        <form onSubmit={handleManualScrape} className="flex space-x-3">
          <input 
            type="url" 
            placeholder="https://company.com/job/123..." 
            className="block w-full max-w-lg rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={scrapeUrl}
            onChange={e => setScrapeUrl(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={isScraping}
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isScraping ? 'Scanning...' : 'Extract & Save'}
          </button>
        </form>
      </div>

      {/* Search + Category Filter */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
        <input
          type="text"
          placeholder="Search by company, title, location, or salary..."
          className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select
          className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {CATEGORY_OPTIONS.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
          <option value="Uncategorized">Uncategorized</option>
        </select>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Company</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Category</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">City / Location</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Payrate</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Link</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredApplications.map((app) => (
                    <tr key={app.applicationId}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {app.companyName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{app.jobTitle}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {app.category ? (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CATEGORY_BADGE_CLASSES[app.category] || 'bg-gray-100 text-gray-700 ring-gray-500/20'}`}>
                            {app.category}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{app.location || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{app.salaryRange || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {app.jobUrl ? (
                          <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 hover:underline">
                            Open Job
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <Link to={`/applications/${app.applicationId}`} className="text-indigo-600 hover:text-indigo-900">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredApplications.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-sm text-gray-500">
                        No positions to apply found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
