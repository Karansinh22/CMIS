import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Building2, Layers, Clock, ArrowRight, Trash2, Sparkles } from 'lucide-react';
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
      setProjects(data);
    } catch (err) {
      setError('Failed to load projects.');
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
    } catch (err) {
      alert('Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project and all its meetings?')) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert('Failed to delete project.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <FolderKanban size={22} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Projects & Workstreams</h1>
          </div>
          <p className="text-white/40 text-sm">
            Group meeting recordings by company, client, or topic to build expanding cumulative context.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary shrink-0 gap-2 text-sm py-2.5 px-4 shadow-glow-brand"
        >
          <Plus size={18} />
          New Project Workspace
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="glass p-12 text-center max-w-lg mx-auto rounded-2xl border border-white/10 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/10 text-brand-400 flex items-center justify-center mx-auto">
            <Layers size={32} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No Projects Created Yet</h3>
            <p className="text-white/40 text-sm mt-1">
              Create your first project workspace to start accumulating multi-meeting intelligence across sessions.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary mx-auto text-sm py-2.5 px-5 gap-2"
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="glass p-6 rounded-2xl border border-white/10 hover:border-brand-500/40
                         transition-all duration-300 hover:shadow-card-hover cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Badges & Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.company && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-300 border border-brand-500/20">
                        <Building2 size={12} />
                        {p.company}
                      </span>
                    )}
                    {p.category && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/60 border border-white/10">
                        {p.category}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="text-white/20 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-1">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-white/40 text-xs mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>

                {/* Cumulative summary preview */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-white/60 text-xs line-clamp-3 leading-relaxed">
                    {p.overall_summary || 'Upload meeting audio to start generating cumulative context.'}
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Layers size={14} className="text-brand-400" />
                    <strong className="text-white">{p.meeting_count}</strong> {p.meeting_count === 1 ? 'meeting' : 'meetings'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {p.total_duration_minutes} mins audio
                  </span>
                </div>
                <ArrowRight size={16} className="text-white/20 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal — Create Project */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-white/10 space-y-6 shadow-card-hover">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-brand-400" />
                <h2 className="text-lg font-bold text-white">Create New Project</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/40 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Android Architecture Viva, Acme Corp Sync"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Company / Client</label>
                  <input
                    type="text"
                    placeholder="e.g. Google, Acme"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input bg-surface-50 text-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Viva / Defense">Viva / Defense</option>
                    <option value="Product">Product</option>
                    <option value="Sales & Clients">Sales & Clients</option>
                    <option value="General Sync">General Sync</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="What is the objective or scope of this project?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input resize-none py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-sm py-2 px-5"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
