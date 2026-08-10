/**
 * CrossIntelligence.jsx — Reusable cross-meeting intelligence component with "Show More" interaction.
 * Caps initial view at 7 items and expands smoothly.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RepeatIcon, Tag, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

const INITIAL_LIMIT = 7;

export default function CrossIntelligence({ items = [], title = "Cross-Meeting Discussion Intelligence" }) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) {
    return (
      <div className="empty-state py-12 text-center space-y-2">
        <RepeatIcon size={24} className="text-text-muted mx-auto mb-1" />
        <p className="text-sm font-bold text-text-primary">No cross-meeting patterns detected yet</p>
        <p className="text-xs text-text-secondary max-w-sm mx-auto">
          Upload multiple meeting recordings across sessions to trigger cumulative MinHash/LSH pattern detection.
        </p>
      </div>
    );
  }

  const visibleItems = expanded ? items : items.slice(0, INITIAL_LIMIT);
  const hasMore = items.length > INITIAL_LIMIT;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 font-display">
          <Cpu size={16} className="text-text-primary" />
          <span>{title}</span>
          <span className="badge badge-gray text-xs ml-1 font-mono">{items.length}</span>
        </h2>
        {hasMore && (
          <span className="text-xs text-text-muted font-mono">
            Showing {visibleItems.length} of {items.length}
          </span>
        )}
      </div>

      {/* List with Framer Motion layout animation */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {visibleItems.map((topic, idx) => (
            <motion.div
              key={topic.id || idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="card card-hover p-4 space-y-2 transition-all border border-border-default hover:border-border-strong"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-surface-hover border border-border-default flex items-center justify-center text-text-primary shrink-0 mt-0.5">
                  <RepeatIcon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-text-primary text-sm sm:text-base font-display truncate">
                      {topic.title}
                    </h3>
                    <span className="badge badge-warning text-[11px] font-mono">
                      Recurring Theme
                    </span>
                  </div>

                  {topic.summary && (
                    <p className="text-text-secondary text-xs sm:text-sm leading-relaxed mt-1.5 line-clamp-2">
                      {topic.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted flex-wrap">
                    {topic.occurrence_count && (
                      <span>Discussed in {topic.occurrence_count} sessions</span>
                    )}
                    {topic.previous_topic_id && (
                      <span className="flex items-center gap-1">
                        <Tag size={11} /> Linked across meeting timeline
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Show More / Show Less Button */}
      {hasMore && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-secondary text-xs sm:text-sm font-semibold px-5 py-2.5 flex items-center gap-2 rounded-xl"
          >
            <span>{expanded ? 'Show Less' : `Show More (${items.length - INITIAL_LIMIT} remaining)`}</span>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}
