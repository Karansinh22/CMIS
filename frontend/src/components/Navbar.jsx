import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Brain, Upload, FolderKanban, List, CheckSquare, TrendingUp, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logout } from '../auth';

const links = [
  { to: '/',         label: 'Upload',       icon: Upload        },
  { to: '/projects', label: 'Projects',     icon: FolderKanban  },
  { to: '/meetings', label: 'Meetings',     icon: List          },
  { to: '/actions',  label: 'Action Items', icon: CheckSquare   },
  { to: '/insights', label: 'Insights',     icon: TrendingUp    },
];

export default function Navbar() {
  const { user, doLogout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    doLogout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface-50 border-r border-white/5 min-h-screen px-4 py-6 gap-8">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
          <Brain size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">CMIS</p>
          <p className="text-white/30 text-[10px] leading-tight">Meeting Intelligence</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1">
        <p className="section-title px-3 mb-2">Navigation</p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
               ${isActive
                 ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                 : 'text-white/50 hover:text-white hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-brand-400' : ''} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer — user account */}
      <div className="mt-auto space-y-3 px-1">
        <div className="glass p-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/40">Backend connected</span>
        </div>

        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5
                         border border-transparent hover:border-white/10 transition-all duration-200 group"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600
                              flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-white text-xs font-medium truncate">{user.name}</p>
                <p className="text-white/30 text-[10px] truncate">{user.email}</p>
              </div>
              <ChevronDown
                size={14}
                className={`text-white/30 shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 glass p-1 rounded-xl shadow-card-hover z-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                             text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-white/20 text-[10px] text-center">CMIS v0.1 · 4IT31</p>
      </div>
    </aside>
  );
}
