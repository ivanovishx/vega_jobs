import { useState } from 'react';
import { X, Eye, EyeOff, User, Mail, Lock, Phone } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3001';

interface Props {
  onClose: () => void;
}

type Tab = 'login' | 'register';

export default function AuthModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('login');
  const { refreshUser } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 pt-6 pb-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-indigo-200 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-white font-semibold">Vega</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-3">
            {tab === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            {tab === 'login'
              ? 'Ingresa para continuar con tu búsqueda'
              : 'Regístrate gratis y empieza a organizar tu búsqueda'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b -mt-px">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'register'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <div className="p-6">
          {tab === 'login' ? (
            <LoginForm onClose={onClose} refreshUser={refreshUser} onSwitchTab={() => setTab('register')} />
          ) : (
            <RegisterForm onClose={onClose} refreshUser={refreshUser} onSwitchTab={() => setTab('login')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginForm({ onClose, refreshUser, onSwitchTab }: {
  onClose: () => void;
  refreshUser: () => Promise<void>;
  onSwitchTab: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true });
      await refreshUser();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <GoogleButton />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={<Mail className="h-4 w-4" />} label="Correo electrónico">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="input-field"
          />
        </Field>

        <Field icon={<Lock className="h-4 w-4" />} label="Contraseña">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? <Spinner /> : 'Iniciar sesión'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        ¿No tienes cuenta?{' '}
        <button onClick={onSwitchTab} className="text-indigo-600 font-medium hover:underline">
          Regístrate gratis
        </button>
      </p>
    </>
  );
}

// ── Register ──────────────────────────────────────────────────────────────────

function RegisterForm({ onClose, refreshUser, onSwitchTab }: {
  onClose: () => void;
  refreshUser: () => Promise<void>;
  onSwitchTab: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      await axios.post(
        `${API_BASE}/auth/register`,
        { email, password, name, phone: phone || undefined },
        { withCredentials: true }
      );
      await refreshUser();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength = getPasswordStrength(password);

  return (
    <>
      <GoogleButton />
      <Divider />
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<User className="h-4 w-4" />} label="Nombre">
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Juan"
              className="input-field"
            />
          </Field>
          <Field label="Apellido">
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Pérez"
              className="input-field"
            />
          </Field>
        </div>

        <Field icon={<Mail className="h-4 w-4" />} label="Correo electrónico">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="input-field"
          />
        </Field>

        <Field icon={<Phone className="h-4 w-4" />} label="Teléfono (opcional)">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+52 55 1234 5678"
            className="input-field"
          />
        </Field>

        <Field icon={<Lock className="h-4 w-4" />} label="Contraseña">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="input-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= passwordStrength.score
                        ? passwordStrength.color
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">{passwordStrength.label}</span>
            </div>
          )}
        </Field>

        <Field icon={<Lock className="h-4 w-4" />} label="Confirmar contraseña">
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              className={`input-field pr-10 ${
                confirmPassword && confirmPassword !== password
                  ? 'border-red-300 focus:ring-red-400'
                  : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? <Spinner /> : 'Crear cuenta'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Al registrarte aceptas nuestros términos de uso y política de privacidad.
        </p>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        ¿Ya tienes cuenta?{' '}
        <button onClick={onSwitchTab} className="text-indigo-600 font-medium hover:underline">
          Inicia sesión
        </button>
      </p>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function GoogleButton() {
  return (
    <a
      href={`${API_BASE}/auth/google`}
      className="flex items-center justify-center gap-3 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <GoogleIcon />
      Continuar con Google
    </a>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">o con tu correo</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <span className="text-red-500 text-xs mt-0.5">⚠</span>
      <p className="text-red-600 text-xs">{children}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      Cargando...
    </span>
  );
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Muy débil', color: 'bg-red-400' },
    { label: 'Débil', color: 'bg-orange-400' },
    { label: 'Regular', color: 'bg-yellow-400' },
    { label: 'Fuerte', color: 'bg-green-400' },
    { label: 'Muy fuerte', color: 'bg-emerald-500' },
  ];
  return { score, ...levels[score] };
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
