import { useEffect, useState } from 'react';
import { fetchApplications, createApplication, autofillApplication } from '../api/client';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function Applications() {
  const [applications, setApplications] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApp, setNewApp] = useState({ companyName: '', jobTitle: '', jobUrl: '', status: 'Applied', notes: '', dateApplied: '' });
  const [autofillUrl, setAutofillUrl] = useState('');
  const [autofillFile, setAutofillFile] = useState<File | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isModalOpen) {
      const now = new Date();
      const pstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${pstDate.getFullYear()}-${pad(pstDate.getMonth() + 1)}-${pad(pstDate.getDate())}T${pad(pstDate.getHours())}:${pad(pstDate.getMinutes())}`;
      setNewApp(prev => ({...prev, dateApplied: dateStr }));
    }
  }, [isModalOpen]);

  const handleAutofill = async () => {
    if (!autofillUrl && !autofillFile) return alert('Provide a URL or an image');
    setIsAutofilling(true);
    try {
      const formData = new FormData();
      if (autofillUrl) formData.append('url', autofillUrl);
      if (autofillFile) formData.append('screenshot', autofillFile);

      const data = await autofillApplication(formData);
      setNewApp(prev => ({
        ...prev,
        companyName: data.companyName || prev.companyName,
        jobTitle: data.jobTitle || prev.jobTitle,
        notes: data.notes || prev.notes,
        jobUrl: data.jobUrl || autofillUrl || prev.jobUrl
      }));
    } catch (err) {
      console.error(err);
      alert('Autofill failed');
    } finally {
      setIsAutofilling(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        setAutofillFile(file);
        e.preventDefault(); // Prevent default paste action
      }
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createApplication(newApp);
      setIsModalOpen(false);
      setNewApp({ companyName: '', jobTitle: '', jobUrl: '', status: 'Applied', notes: '', dateApplied: '' });
      setAutofillUrl('');
      setAutofillFile(null);
      // Refresh list
      const res = await fetchApplications();
      setApplications(res.applications);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create application');
    }
  };

  useEffect(() => {
    fetchApplications().then(res => setApplications(res.applications)).catch(console.error);
  }, []);

  const filteredApplications = applications.filter(app => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (app.companyName && app.companyName.toLowerCase().includes(query)) ||
      (app.jobTitle && app.jobTitle.toLowerCase().includes(query)) ||
      (app.jobUrl && app.jobUrl.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Applications
          </h2>
          <p className="mt-2 text-sm text-gray-700">A list of all your active job applications.</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add Application
          </button>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="mt-4">
        <input 
          type="text" 
          placeholder="Search by company, role, or URL..." 
          className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Company</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Match Score</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Next Action</th>
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          {app.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className={clsx(
                            "font-semibold",
                            app.matchScore >= 80 ? "text-green-600" : app.matchScore >= 50 ? "text-yellow-600" : "text-red-600"
                          )}>
                            {app.matchScore || 'N/A'}%
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{app.nextAction || '-'}</td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <Link to={`/applications/${app.applicationId}`} className="text-indigo-600 hover:text-indigo-900">
                          View<span className="sr-only">, {app.companyName}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6" onPaste={handlePaste}>
                <div>
                  <h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">Add New Application</h3>
                  
                  {/* Autofill Section */}
                  <div className="mt-4 mb-6 rounded-md bg-indigo-50 p-4 border border-indigo-100">
                    <h4 className="text-sm font-medium text-indigo-800 mb-2">Smart Autofill (Free OCR/Scraping)</h4>
                    <div className="space-y-3">
                      <div>
                        <input type="url" placeholder="Paste Job URL..." className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={autofillUrl} onChange={e => setAutofillUrl(e.target.value)} />
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>OR</span>
                      </div>
                      <div>
                        <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onChange={e => setAutofillFile(e.target.files ? e.target.files[0] : null)} />
                        {autofillFile && (
                          <div className="mt-2 flex items-center space-x-2">
                            <p className="text-xs text-green-600 font-medium">Image attached: {autofillFile.name || 'Pasted image'}</p>
                            <button type="button" onClick={() => setAutofillFile(null)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                              (Remove)
                            </button>
                          </div>
                        )}
                        <p className="mt-1 text-xs text-gray-400">You can also just click anywhere in this window and press ⌘+V to paste an image.</p>
                      </div>
                      <button type="button" onClick={handleAutofill} disabled={isAutofilling || (!autofillUrl && !autofillFile)} className="mt-2 w-full inline-flex justify-center rounded-md bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-200 disabled:opacity-50">
                        {isAutofilling ? 'Scanning...' : 'Autofill Fields'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2">
                    <form onSubmit={handleCreateApplication}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Company Name</label>
                          <input type="text" id="companyName" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={newApp.companyName} onChange={e => setNewApp({...newApp, companyName: e.target.value})} />
                        </div>
                        <div>
                          <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700">Job Title</label>
                          <input type="text" id="jobTitle" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={newApp.jobTitle} onChange={e => setNewApp({...newApp, jobTitle: e.target.value})} />
                        </div>
                        <div>
                          <label htmlFor="jobUrl" className="block text-sm font-medium text-gray-700">Job URL (Optional)</label>
                          <input type="url" id="jobUrl" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={newApp.jobUrl} onChange={e => setNewApp({...newApp, jobUrl: e.target.value})} />
                        </div>
                        <div>
                          <label htmlFor="dateApplied" className="block text-sm font-medium text-gray-700">Date Applied (PST)</label>
                          <input type="datetime-local" id="dateApplied" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={newApp.dateApplied} onChange={e => setNewApp({...newApp, dateApplied: e.target.value})} />
                        </div>
                        <div>
                          <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                          <select id="status" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={newApp.status} onChange={e => setNewApp({...newApp, status: e.target.value})}>
                            <option value="Applied">Applied</option>
                            <option value="Saved">Saved</option>
                            <option value="Recruiter Screen">Recruiter Screen</option>
                            <option value="Hiring Manager Screen">Hiring Manager Screen</option>
                            <option value="Technical Interview">Technical Interview</option>
                            <option value="Onsite">Onsite</option>
                            <option value="Offer">Offer</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Withdrawn">Withdrawn</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                        <button type="submit" className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:col-start-2">Add Application</button>
                        <button type="button" onClick={() => setIsModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0">Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
