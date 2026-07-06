import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

/** Light/dark theme switch. Persisted via cookie in ThemeContext. */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={clsx(
        'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
        'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
        'dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100',
        className
      )}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}
