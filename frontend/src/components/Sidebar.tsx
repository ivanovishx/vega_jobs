import { Link, useLocation } from 'react-router-dom';
import { Home, Briefcase, FileSearch, User, Bookmark } from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar() {
  const location = useLocation();

  const links = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Applications', path: '/applications', icon: Briefcase },
    { name: 'Saved Positions', path: '/saved-jobs', icon: Bookmark },
    { name: 'Job Analyzer', path: '/analyzer', icon: FileSearch },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="w-64 bg-white border-r h-screen flex flex-col fixed inset-y-0">
      <div className="flex items-center justify-center h-16 border-b">
        <h1 className="text-xl font-bold text-indigo-600 tracking-tight">Vega</h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
          return (
            <Link
              key={link.name}
              to={link.path}
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
        <div className="text-xs text-gray-500">Vega Chief of Staff</div>
      </div>
    </div>
  );
}
