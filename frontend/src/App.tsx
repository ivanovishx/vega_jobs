import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import JobAnalyzer from './pages/JobAnalyzer';
import CandidateProfile from './pages/CandidateProfile';
import SavedJobs from './pages/SavedJobs';
import ApplicationDetail from './pages/ApplicationDetail';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 overflow-auto">
        <main className="p-8">
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
