import { Link, useLocation } from 'react-router-dom';
import { Home, Briefcase, FileSearch, User, Bookmark, X, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export default function Sidebar({ isOpen, onClose, onOpenAuth }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const links = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Applications', path: '/applications', icon: Briefcase },
    { name: 'Positions to Apply', path: '/saved-jobs', icon: Bookmark },
    { name: 'Job Analyzer', path: '/analyzer', icon: FileSearch },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r flex flex-col transform transition-transform duration-200 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between h-16 border-b px-4">
          <h1 className="text-xl font-bold text-indigo-600 tracking-tight">Vega</h1>
          <div className="flex items-center gap-2">
            {/* User avatar / login button */}
            <button
              type="button"
              onClick={user ? undefined : onOpenAuth}
              aria-label="Cuenta de usuario"
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
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 hover:border-indigo-500 flex items-center justify-center transition-colors group">
                  <User className="h-3.5 w-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden text-gray-500 hover:text-gray-700"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              location.pathname === link.path ||
              (link.path !== '/' && location.pathname.startsWith(link.path));
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={onClose}
                className={clsx(
                  'flex items-center px-4 py-2 text-sm font-medium rounded-md',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-indigo-700' : 'text-gray-400')} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-2 border-t">
          <p className="text-xs text-gray-400">Vega v2.0 — Chief of Staff</p>
        </div>

        {user && (
          <div className="px-4 py-3 border-t flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{user.name ?? user.email}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
