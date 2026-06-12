import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Menu, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import JobAnalyzer from './pages/JobAnalyzer';
import CandidateProfile from './pages/CandidateProfile';
import SavedJobs from './pages/SavedJobs';
import ApplicationDetail from './pages/ApplicationDetail';

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile header */}
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

          {/* User button — mobile */}
          <button
            type="button"
            onClick={() => !user && setAuthModalOpen(true)}
            aria-label="Cuenta"
            className="flex items-center justify-center"
          >
            {user ? (
              user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name ?? ''}
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                  {user.name?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-indigo-500 hover:text-indigo-500 transition-colors">
                <User className="h-4 w-4" />
              </div>
            )}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </div>
  );
}

function AppRoutes() {
  return (
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
