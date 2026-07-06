import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Target, BarChart3, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const FEATURES = [
  {
    icon: <Briefcase className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
    title: 'Track your applications',
    desc: 'Keep a record of all your applications in one place. Never lose track of an opportunity.',
  },
  {
    icon: <Target className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
    title: 'Match with job offers',
    desc: 'Compare your profile against any job opening and get a detailed compatibility score.',
  },
  {
    icon: <Zap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
    title: 'Analyze offers instantly',
    desc: 'Paste the text of any job posting and get a smart summary: requirements, salary, culture and more.',
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
    title: 'Dashboard for your search',
    desc: 'Visualize your progress, response rates, and which stages you are at with each company.',
  },
];

const BENEFITS = [
  'Free forever on the basic plan',
  'No complicated spreadsheets',
  'Import offers from any source',
  'Complete history of your search',
];

export default function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  function handleCTA() {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0b0b0e] flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-100 dark:border-white/[0.07] sticky top-0 z-10 bg-white/90 dark:bg-[#0b0b0e]/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">Vega</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Create free account
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-28 bg-gradient-to-b from-indigo-50/60 to-white dark:from-indigo-500/10 dark:to-[#0b0b0e]">
        <div className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="h-3.5 w-3.5" /> Smart job search
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-zinc-100 leading-tight max-w-3xl">
          Your job search,{' '}
          <span className="text-indigo-600 dark:text-indigo-400">organized and focused</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 dark:text-zinc-400 max-w-xl">
          Vega helps you track applications, analyze offers, and compare your profile with any job opening — all in one place.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleCTA}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-base shadow-sm"
          >
            {user ? 'Go to dashboard' : 'Start for free'} <ArrowRight className="h-5 w-5" />
          </button>
          {!user && (
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-zinc-300 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-base"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Benefits list */}
        <ul className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-x-6 gap-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400">
              <CheckCircle className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-white dark:bg-[#0b0b0e]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-zinc-100 text-center mb-12">
            Everything you need to land that job
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-3 p-6 rounded-2xl border border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.04] hover:shadow-sm transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="py-20 px-4 bg-indigo-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to take control of your search?
          </h2>
          <p className="text-indigo-200 mb-8">
            Join and start organizing your job search today.
          </p>
          <button
            onClick={handleCTA}
            className="inline-flex items-center gap-2 bg-white text-indigo-600 font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors text-base shadow-sm"
          >
            {user ? 'Go to dashboard' : 'Create free account'} <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      <footer className="border-t border-gray-100 dark:border-white/[0.07] py-6 text-center text-xs text-gray-400 dark:text-zinc-500">
        © {new Date().getFullYear()} Vega. All rights reserved.
      </footer>
    </div>
  );
}
