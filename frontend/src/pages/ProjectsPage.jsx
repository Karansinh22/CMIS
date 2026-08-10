/**
 * ProjectsPage.jsx — Multi-session Project Workspaces.
 * Strict monochrome enterprise styling with modal creation and workspace cards.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, Plus, Building2, Layers, Clock, ArrowRight, Trash2, Sparkles, X, Loader
} from 'lucide-react';
import { listProjects, createProject, deleteProject } from '../api';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showModal, setShowModal] = useState(false);

  // New project form state
  const [form, setForm] = useState({ name: '', company: '', category: 'Engineering', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const { data } = await listProjects();
      setProjects(data || []);
    } catch {
      setError('Failed to load projects from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await createProject(form);
      setShowModal(false);
      setForm({ name: '', company: '', category: 'Engineering', description: '' });
      navigate(`/projects/${data.id}`);
    } catch {
      alert('Failed to create project workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project workspace?')) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('Failed to delete project.');
    }
  };

  return (
    <div className="page-wrapper-wide space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-extrabold">Project Workspaces</h1>
          <p className="page-subtitle text-xs">
            Group meeting recordings across sessions to build expanding, cumulative intelligence.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary text-xs py-2 px-3.5"
        >
          <Plus size={14} />
          <span>New Project Workspace</span>
        </button>
      </div>

      {/* ── States: Loading / Empty / Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-text-muted">
          <Loader size={20} className="animate-spin text-text-primary" />
          <span className="text-xs">Loading project workspaces...</span>
        </div>
      ) : error ? (
        <div className="card p-4 text-semantic-error border-semantic-error/30 bg-semantic-error/5 text-xs">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state py-16">
          <div className="w-12 h-12 rounded-lg bg-surface border border-border-default flex items-center justify-center text-text-muted mb-1">
            <FolderKanban size={20} />
          </div>
          <p className="text-sm font-semibold text-text-primary">No Project Workspaces</p>
          <p className="text-xs text-text-secondary max-w-sm">
            Create a workspace to group related meeting recordings and synthesize cumulative knowledge over time.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary text-xs mt-2"
          >
            <Plus size={13} />
            <span>Create Workspace</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="card card-hover p-5 flex flex-col justify-between group"
            >
              <div className="space-y-3.5">
                {/* Header Tags & Delete Action */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.company && (
                      <span className="badge badge-gray text-[10px] font-medium">
                        <Building2 size={10} />
                        {p.company}
                      </span>
                    )}
                    {p.category && (
                      <span className="badge badge-gray text-[10px] font-semibold">
                        {p.category}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="text-text-muted hover:text-semantic-error p-1 rounded transition-colors"
                    title="Delete project workspace"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Name & Description */}
                <div>
                  <h3 className="text-base font-bold text-text-primary group-hover:underline line-clamp-1">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-text-secondary text-xs mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                  )}
                </div>

                {/* Summary Preview */}
                <div className="p-3 rounded-lg bg-surface-hover border border-border-subtle">
                  <p className="text-text-secondary text-xs line-clamp-3 leading-relaxed">
                    {p.overall_summary || 'Upload meeting audio to start synthesizing cumulative context.'}
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Layers size={12} />
                    <strong className="text-text-primary">{p.meeting_count || 0}</strong> {p.meeting_count === 1 ? 'meeting' : 'meetings'}
                  </span>
                  {p.total_duration_minutes > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {p.total_duration_minutes}m audio
                    </span>
                  )}
                </div>
                <ArrowRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Create Workspace ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in-fast">
          <div className="card max-w-md w-full p-6 space-y-5 shadow-modal">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-text-primary" />
                <h2 className="text-base font-bold text-text-primary">New Project Workspace</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="btn-icon p-1 text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Workspace Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Android Architecture Viva, Acme Corp Sync"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input text-xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Company / Client</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme, Internal"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input text-xs"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Viva / Defense">Viva / Defense</option>
                    <option value="Product">Product</option>
                    <option value="Sales & Clients">Sales &amp; Clients</option>
                    <option value="General Sync">General Sync</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Briefly state the goal or scope of this project..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input resize-none py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  {submitting ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
