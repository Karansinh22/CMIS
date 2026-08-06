/**
 * MeetingsPage.jsx — Searchable list of all meetings with status, date, and
 * quick navigation to the meeting detail page.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  List, Search, Calendar, ArrowRight, RefreshCw, Loader, Mic,
} from 'lucide-react';
import { listMeetings } from '../api';
import StatusBadge from '../components/StatusBadge';

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MeetingsPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [query,    setQuery]    = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMeetings();
      setMeetings(res.data);
    } catch {
      setError('Could not reach the backend. Is it running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = meetings.filter((m) =>
    m.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/15 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-2">
            <List size={12} /> All Meetings
          </div>
          <h1 className="text-3xl font-bold text-white">Meetings</h1>
          <p className="text-white/40 text-sm mt-1">{meetings.length} recording{meetings.length !== 1 ? 's' : ''} in the context store</p>
        </div>
        <button onClick={load} className="btn-icon" title="Refresh">
          <RefreshCw size={16} className={loading ? 'animate-spin-slow text-brand-400' : 'text-white/50'} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9"
          placeholder="Search meetings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-white/30 gap-2">
          <Loader size={18} className="animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="glass p-5 border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="glass p-12 text-center">
          <Mic size={32} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            {query ? 'No meetings match your search.' : 'No meetings yet — upload one to get started.'}
          </p>
          {!query && (
            <button onClick={() => navigate('/')} className="btn-primary mt-4 mx-auto">
              Upload a Recording
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => navigate(`/meetings/${m.id}`)}
                className="card card-hover w-full text-left p-5 flex items-center gap-4 group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-brand-600/10 border border-brand-500/15 flex items-center justify-center shrink-0">
                  <Mic size={16} className="text-brand-400" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{m.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/30 text-xs flex items-center gap-1">
                      <Calendar size={11} /> {fmtDate(m.date)}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight
                  size={16}
                  className="text-white/20 shrink-0 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
