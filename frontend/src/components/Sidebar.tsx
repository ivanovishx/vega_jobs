import { Link, useLocation } from 'react-router-dom';
import { Home, Briefcase, FileSearch, User, Bookmark, X } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  const links = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Applications', path: '/applications', icon: Briefcase },
    { name: 'Positions to Apply', path: '/saved-jobs', icon: Bookmark },
    { name: 'Job Analyzer', path: '/analyzer', icon: FileSearch },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed on lg, slide-in drawer on mobile */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r flex flex-col transform transition-transform duration-200 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between h-16 border-b px-4">
          <h1 className="text-xl font-bold text-indigo-600 tracking-tight">Vega</h1>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={onClose}
                className={clsx(
                  "flex items-center px-4 py-2 text-sm font-medium rounded-md",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className={clsx("mr-3 h-5 w-5", isActive ? "text-indigo-700" : "text-gray-400")} />
                {link.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="text-xs text-gray-500">Vega 2.0 Chief of Staff</div>
        </div>
      </aside>
    </>
  );
}
