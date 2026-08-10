/**
 * Navbar.jsx — Enterprise monochrome sidebar navigation.
 */
import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Brain, LayoutDashboard, Upload, FolderKanban, ListOrdered, CheckSquare,
  TrendingUp, Settings, LogOut, X, Menu, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logout } from '../auth';

const NAV_ITEMS = [
  {
    group: 'Workspace',
    items: [
      { to: '/',         label: 'Dashboard',    icon: LayoutDashboard },
      { to: '/meetings', label: 'Meetings',     icon: ListOrdered },
      { to: '/projects', label: 'Projects',     icon: FolderKanban },
      { to: '/upload',   label: 'Upload Audio', icon: Upload },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { to: '/actions',  label: 'Action Tracker', icon: CheckSquare },
      { to: '/insights', label: 'Insights',       icon: TrendingUp },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Navbar() {
  const { user, executeSignOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await executeSignOut();
    navigate('/', { replace: true });
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 bg-surface text-text-primary">
      {/* Top: Logo & Navigation */}
      <div className="space-y-6">
        {/* Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-2 py-2 cursor-pointer rounded-xl hover:bg-surface-hover transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-text-primary text-canvas flex items-center justify-center font-bold shadow-subtle shrink-0 group-hover:scale-105 transition-transform">
            <Brain size={20} className="text-canvas" />
          </div>
          <div>
            <span className="font-extrabold text-base text-text-primary tracking-tight block font-display">CMIS</span>
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider block">MEETING INTELLIGENCE</span>
          </div>
        </div>

        {/* Upload Action Button */}
        <div className="px-1">
          <button
            onClick={() => navigate('/upload')}
            className="w-full btn-primary py-2 text-xs font-semibold justify-center"
          >
            <Upload size={13} />
            <span>Upload Recording</span>
          </button>
        </div>

        {/* Nav links */}
        <div className="space-y-5">
          {NAV_ITEMS.map((section) => (
            <div key={section.group} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                {section.group}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        isActive ? 'nav-item-active' : 'nav-item-inactive'
                      }
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: System Status & User Info */}
      <div className="pt-4 border-t border-border-subtle space-y-3">
        {/* Engine status indicator */}
        <div className="px-2 py-1.5 rounded-md bg-surface-hover border border-border-subtle flex items-center justify-between text-[11px]">
          <span className="text-text-secondary flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
            Engine Online
          </span>
          <span className="text-text-muted text-[10px] font-mono">v1.0</span>
        </div>

        {/* User profile & quick signout */}
        {user && (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-surface-active border border-border-default flex items-center justify-center text-xs font-bold text-text-primary shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{user.name}</p>
                <p className="text-[10px] text-text-muted truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-icon p-1.5 hover:text-semantic-error"
              title="Sign Out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 min-h-screen border-r border-border-layout bg-surface sticky top-0 h-screen z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Top Navbar with Hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-surface border-b border-border-layout px-4 flex items-center justify-between">
        <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer">
          <div className="w-7 h-7 rounded-md bg-text-primary text-canvas flex items-center justify-center font-bold">
            <Brain size={15} className="text-canvas" />
          </div>
          <span className="font-bold text-sm text-text-primary tracking-tight">CMIS</span>
        </div>

        <button
          onClick={() => setMobileOpen((p) => !p)}
          className="btn-icon p-2"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-fade-in-fast"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed top-0 bottom-0 left-0 z-50 w-64 bg-surface border-r border-border-layout shadow-modal animate-slide-up">
            {sidebarContent}
          </div>
        </>
      )}

      {/* Mobile Spacer */}
      <div className="md:hidden h-14 shrink-0" />
    </>
  );
}
