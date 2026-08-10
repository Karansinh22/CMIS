/**
 * DeleteConfirmModal.jsx — Reusable destructive confirmation modal.
 * Follows strict enterprise monochrome design system with restrained semantic red.
 */
import { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  title = 'Delete Item',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete Permanently',
  loading = false,
  error = null,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-fast">
      <div
        className="fixed inset-0"
        onClick={() => !loading && onClose()}
      />

      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 z-10 animate-scale-in">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-semantic-error/10 border border-semantic-error/20 flex items-center justify-center text-semantic-error shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">{title}</h3>
              <p className="text-xs text-text-muted font-mono uppercase tracking-wider mt-0.5">DESTRUCTIVE ACTION</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="btn-icon text-text-muted hover:text-text-primary"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Description Message */}
        <p className="text-sm text-text-secondary leading-relaxed">
          {message}
        </p>

        {/* Error Alert if any */}
        {error && (
          <div className="p-3 rounded-xl bg-semantic-error/10 border border-semantic-error/20 text-xs text-semantic-error font-medium flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary text-sm py-2.5 px-4 font-semibold"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn-danger text-sm py-2.5 px-5 font-bold flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
