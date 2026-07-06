import { useAuth } from '../context/AuthContext';

export default function ImpersonationBanner() {
  const { user, endImpersonation } = useAuth();

  if (!user?.impersonating) return null;

  return (
    <div className="bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-between sticky top-0 z-30">
      <span>
        🎭 You are browsing as <strong>{user.name || user.email}</strong> (impersonation mode)
      </span>
      <button
        onClick={() => endImpersonation()}
        className="bg-white text-red-600 px-3 py-1 rounded text-xs font-semibold hover:bg-red-50"
      >
        End impersonation session
      </button>
    </div>
  );
}
