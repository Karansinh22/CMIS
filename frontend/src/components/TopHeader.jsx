/**
 * TopHeader.jsx — Enterprise monochrome top navigation bar.
 * Provides breadcrumb trail, quick action, theme toggle, and user controls.
 */
import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Sun, Moon, Upload, User, Settings, LogOut, ChevronDown,
  Brain, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { logout } from '../auth';

function getBreadcrumbs(pathname) {
  if (pathname === '/') return [{ label: 'Dashboard', to: '/' }];
  if (pathname.startsWith('/meetings')) {
    const parts = [{ label: 'Meetings', to: '/meetings' }];
    if (pathname.split('/')[2]) {
      parts.push({ label: 'Meeting Intelligence Report', to: pathname });
    }
    return parts;
  }
  if (pathname.startsWith('/projects')) {
    const parts = [{ label: 'Projects', to: '/projects' }];
    if (pathname.split('/')[2]) {
      parts.push({ label: 'Workspace Overview', to: pathname });
    }
    return parts;
  }
  if (pathname === '/upload') return [{ label: 'Upload Recording', to: '/upload' }];
  if (pathname === '/actions') return [{ label: 'Action Tracker', to: '/actions' }];
  if (pathname === '/insights') return [{ label: 'Insights & Analytics', to: '/insights' }];
  if (pathname === '/settings') return [{ label: 'Account Settings', to: '/settings' }];
  return [{ label: 'Workspace', to: '/' }];
}

export default function TopHeader() {
  const { user, doLogout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const breadcrumbs = getBreadcrumbs(location.pathname);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    doLogout();
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface border-b border-border-default px-4 sm:px-6 flex items-center justify-between transition-colors duration-150">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium min-w-0">
        <div className="md:hidden flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded bg-text-primary text-surface flex items-center justify-center font-bold">
            <Brain size={13} className="text-canvas" />
          </div>
          <span className="font-bold text-text-primary">CMIS</span>
          <ChevronRight size={12} className="text-text-muted" />
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.to} className="flex items-center gap-1.5">
                {idx > 0 && <ChevronRight size={12} className="text-text-muted shrink-0" />}
                {isLast ? (
                  <span className="font-semibold text-text-primary truncate">{crumb.label}</span>
                ) : (
                  <Link to={crumb.to} className="text-text-secondary hover:text-text-primary transition-colors truncate">
                    {crumb.label}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Actions, Theme Switcher & User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Quick Upload CTA (Desktop) */}
        {location.pathname !== '/upload' && (
          <button
            onClick={() => navigate('/upload')}
            className="hidden sm:inline-flex btn-secondary py-1.5 px-3 text-xs"
            title="Upload audio recording"
          >
            <Upload size={13} />
            <span>Upload</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={16} className="text-text-secondary hover:text-text-primary" />
          ) : (
            <Moon size={16} className="text-text-secondary hover:text-text-primary" />
          )}
        </button>

        {/* User Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg hover:bg-surface-hover border border-transparent hover:border-border-default transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-text-primary text-canvas text-[11px] font-bold flex items-center justify-center">
                {initials}
              </div>
              <span className="hidden md:inline text-xs font-medium text-text-primary max-w-[120px] truncate">
                {user.name}
              </span>
              <ChevronDown size={12} className={`text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-56 rounded-lg bg-surface border border-border-default shadow-dropdown z-50 p-1 divide-y divide-border-subtle animate-fade-in-fast">
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-text-primary truncate">{user.name}</p>
                    <p className="text-[11px] text-text-muted truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
                    >
                      <Settings size={13} />
                      <span>Account Settings</span>
                    </button>
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/projects'); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
                    >
                      <User size={13} />
                      <span>My Projects</span>
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setDropdownOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-semantic-error hover:bg-semantic-error/10 rounded transition-colors"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
