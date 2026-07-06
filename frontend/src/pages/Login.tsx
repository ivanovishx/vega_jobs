import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3001';

type Tab = 'login' | 'register';

export default function Login() {
  const [tab, setTab] = useState<Tab>('login');
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b0e] flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-[#16161a] rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 pt-6 pb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Vega</h1>
          <p className="text-indigo-200 text-sm">
            {tab === 'login' ? 'Welcome back' : 'Create your free account'}
          </p>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-white dark:bg-[#16161a]'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 bg-gray-50 dark:bg-white/[0.04]'
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'register'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 bg-white dark:bg-[#16161a]'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 bg-gray-50 dark:bg-white/[0.04]'
            }`}
          >
            Create account
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
              <span className="text-red-500 dark:text-red-400 text-xs mt-0.5">⚠</span>
              <p className="text-red-600 dark:text-red-400 text-xs">Sign in failed. Please try again.</p>
            </div>
          )}

          {tab === 'login' ? <LoginForm /> : <RegisterForm onSwitchTab={() => setTab('login')} />}
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true });
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <GoogleButton />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={<Mail className="h-4 w-4" />} label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="input-field"
          />
        </Field>

        <Field icon={<Lock className="h-4 w-4" />} label="Password">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? <Spinner /> : 'Sign in'}
        </button>
      </form>
    </>
  );
}

function RegisterForm({ onSwitchTab }: { onSwitchTab: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/register`, { email, password, name }, { withCredentials: true });
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <GoogleButton />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={<Mail className="h-4 w-4" />} label="Full name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="input-field"
          />
        </Field>

        <Field icon={<Mail className="h-4 w-4" />} label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="input-field"
          />
        </Field>

        <Field icon={<Lock className="h-4 w-4" />} label="Password">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? <Spinner /> : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-zinc-400 mt-4">
        Already have an account?{' '}
        <button onClick={onSwitchTab} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
          Sign in
        </button>
      </p>
    </>
  );
}

function GoogleButton() {
  return (
    <a
      href={`${API_BASE}/auth/google`}
      className="flex items-center justify-center gap-3 w-full border border-gray-300 dark:border-white/15 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
    >
      <GoogleIcon />
      Continue with Google
    </a>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.09]" />
      <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium">or with your email</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.09]" />
    </div>
  );
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1.5">
        {icon && <span className="text-gray-400 dark:text-zinc-500">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
      <span className="text-red-500 dark:text-red-400 text-xs mt-0.5">⚠</span>
      <p className="text-red-600 dark:text-red-400 text-xs">{children}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      Loading...
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
