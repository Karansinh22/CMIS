import { NavLink, useLocation } from 'react-router-dom';
import {
  Brain, Upload, List, CheckSquare, TrendingUp, Wifi,
} from 'lucide-react';

const links = [
  { to: '/',          label: 'Upload',       icon: Upload      },
  { to: '/meetings',  label: 'Meetings',     icon: List        },
  { to: '/actions',   label: 'Action Items', icon: CheckSquare },
  { to: '/insights',  label: 'Insights',     icon: TrendingUp  },
];

export default function Navbar() {
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

      {/* Footer */}
      <div className="mt-auto px-3">
        <div className="glass p-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/40">Backend connected</span>
        </div>
        <p className="text-white/20 text-[10px] mt-3 text-center">CMIS v0.1 · 4IT31</p>
      </div>
    </aside>
  );
}
