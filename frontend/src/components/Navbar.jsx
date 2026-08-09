/**
 * Navbar.jsx — Premium side navigation with Framer Motion micro-interactions,
 * Dark/Light theme toggle, active indicators, and click-to-home logo.
 */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Home, Upload, FolderKanban, List, CheckSquare,
  TrendingUp, LogOut, ChevronDown, Settings, Zap, X, Menu, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { logout } from '../auth';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    links: [
      { to: '/',         label: 'Home',         icon: Home,         desc: 'Landing & Dashboard' },
      { to: '/upload',   label: 'Upload',       icon: Upload,       desc: 'Add new meeting' },
      { to: '/meetings', label: 'Meetings',      icon: List,         desc: 'All recordings'  },
      { to: '/projects', label: 'Projects',      icon: FolderKanban, desc: 'Grouped context' },
    ],
  },
  {
    label: 'Intelligence',
    links: [
      { to: '/actions',  label: 'Action Items',  icon: CheckSquare,  desc: 'Tasks & owners'  },
      { to: '/insights', label: 'Insights',       icon: TrendingUp,   desc: 'Trends & analytics' },
    ],
  },
];

function NavItem({ to, label, icon: Icon, desc }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={desc}
      className={({ isActive }) =>
        isActive ? 'nav-item-active group' : 'nav-item-inactive group'
      }
    >
      {({ isActive }) => (
        <motion.div
          className="flex items-center gap-3 w-full"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15 }}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
            isActive
              ? 'bg-brand-500/20 text-brand-300'
              : 'text-white/35 group-hover:text-white/70 group-hover:bg-white/[0.05]'
          }`}>
            <Icon size={15} />
          </div>
          <span className="flex-1 truncate">{label}</span>
          {isActive && (
            <motion.div
              layoutId="activeNavDot"
              className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </motion.div>
      )}
    </NavLink>
  );
}

export default function Navbar() {
  const { user, doLogout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    doLogout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const avatarColor = user?.name
    ? `hsl(${(user.name.charCodeAt(0) * 37) % 360}, 65%, 55%)`
    : '#6366f1';

  const sidebarContent = (
    <div className="flex flex-col h-full gap-6">

      {/* ── Logo (Clickable -> Home Page) ── */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        onClick={() => navigate('/')}
        className="flex items-center gap-3 px-2 pt-1 cursor-pointer group"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand shrink-0 group-hover:shadow-glow-cyan transition-all">
            <Brain size={20} className="text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface-50" />
        </div>
        <div>
          <p className="font-extrabold text-white text-base tracking-tight leading-none font-display group-hover:text-brand-300 transition-colors">CMIS</p>
          <p className="text-white/40 text-xs mt-0.5 leading-none">Meeting Intelligence</p>
        </div>
      </motion.div>

      {/* ── Navigation groups ── */}
      <nav className="flex flex-col gap-5 flex-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="section-title px-3 mb-2">{group.label}</p>
            <div className="flex flex-col gap-1">
              {group.links.map((link) => (
                <NavItem key={link.to} {...link} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer / Actions ── */}
      <div className="space-y-3">

        {/* Dark / Light Theme Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl
                     glass hover:border-brand-500/30 text-white/70 hover:text-white transition-all text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon size={14} className="text-brand-300" />
            ) : (
              <Sun size={14} className="text-amber-400" />
            )}
            <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/60">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </motion.button>

        {/* Quick upload CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/upload')}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                     bg-gradient-brand/15 border border-brand-500/30 text-brand-300
                     hover:bg-brand-600/25 hover:border-brand-500/45 transition-all
                     text-xs font-bold group"
        >
          <Zap size={14} className="group-hover:scale-110 transition-transform" />
          Quick Upload
          <span className="ml-auto opacity-50 text-[10px] font-mono">⌘ U</span>
        </motion.button>

        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl
                         hover:bg-white/[0.06] border border-transparent
                         hover:border-white/[0.1] transition-all group"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center
                           text-white text-xs font-bold shrink-0 shadow-glow-sm"
                style={{ background: `linear-gradient(135deg, ${avatarColor}, #6366f1)` }}
              >
                {initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-white text-xs font-bold truncate leading-tight">{user.name}</p>
                <p className="text-white/40 text-[11px] truncate leading-tight mt-0.5">{user.email}</p>
              </div>
              <ChevronDown
                size={14}
                className={`text-white/40 shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 mb-2 glass p-1.5
                             rounded-2xl shadow-card-hover z-50 space-y-0.5"
                >
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs
                               text-white/80 hover:bg-white/[0.08] hover:text-white font-semibold transition-colors"
                  >
                    <Settings size={13} className="text-brand-400" />
                    Account Settings
                  </button>
                  <div className="divider my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs
                               text-red-400 hover:bg-red-500/[0.1] font-semibold transition-colors"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <p className="text-white/20 text-[10px] text-center font-mono">CMIS Enterprise Platform v1.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 min-h-screen px-4 py-6
                        border-r border-white/[0.08] bg-surface-50/50 backdrop-blur-xl">
        {sidebarContent}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between
                      px-4 py-3 bg-surface/90 border-b border-white/[0.08] backdrop-blur-xl">
        <div onClick={() => navigate('/')} className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <span className="font-bold text-base text-white font-display">CMIS</span>
        </div>
        <button
          onClick={() => setMobileOpen((p) => !p)}
          className="btn-icon p-2"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface-50
                         border-r border-white/[0.08] px-4 py-6 overflow-y-auto"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile content spacer ── */}
      <div className="md:hidden h-14 shrink-0" />
    </>
  );
}
