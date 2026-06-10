import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import JobAnalyzer from './pages/JobAnalyzer';
import CandidateProfile from './pages/CandidateProfile';
import SavedJobs from './pages/SavedJobs';
import ApplicationDetail from './pages/ApplicationDetail';

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar — visible only below lg */}
        <header className="lg:hidden sticky top-0 z-20 flex h-14 items-center justify-between bg-white border-b px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-indigo-600 tracking-tight">Vega</h1>
          <span className="w-6" aria-hidden="true" />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/saved-jobs" element={<SavedJobs />} />
          <Route path="/analyzer" element={<JobAnalyzer />} />
          <Route path="/profile" element={<CandidateProfile />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
