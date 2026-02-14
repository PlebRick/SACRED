import { useState, useEffect, useCallback } from 'react';
import { doctrineMatchingService } from '../../services/doctrineMatchingService';
import styles from './DoctrineReviewModal.module.css';

export const DoctrineReviewModal = ({ isOpen, noteId, noteTitle, noteType, notePassage, onClose, onApplied }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(new Set());

  // Analyze note when opened
  useEffect(() => {
    if (!isOpen || !noteId) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const result = await doctrineMatchingService.analyze(noteId);
        setSuggestions(result.suggestions || []);

        // Pre-select suggestions with confidence >= 0.5
        const preSelected = new Set();
        (result.suggestions || []).forEach(s => {
          if (s.confidence >= 0.5) preSelected.add(s.id);
        });
        setSelected(preSelected);
      } catch (err) {
        console.error('Failed to analyze doctrine links:', err);
      }
      setLoading(false);
    };

    analyze();
  }, [isOpen, noteId]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      setSelected(new Set());
    }
  }, [isOpen]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Group suggestions by chapter number
  const grouped = {};
  for (const s of suggestions) {
    const ch = s.chapterNumber;
    if (!grouped[ch]) grouped[ch] = [];
    grouped[ch].push(s);
  }
  // Sort chapter groups by highest confidence in group
  const chapterOrder = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => {
      const maxA = Math.max(...grouped[a].map(s => s.confidence));
      const maxB = Math.max(...grouped[b].map(s => s.confidence));
      return maxB - maxA;
    });

  const handleApply = useCallback(async () => {
    const accepted = [];
    const rejected = [];

    for (const s of suggestions) {
      if (selected.has(s.id)) {
        accepted.push(s.id);
      } else {
        rejected.push(s.id);
      }
    }

    if (accepted.length === 0 && rejected.length === 0) {
      onClose();
      return;
    }

    try {
      await doctrineMatchingService.apply(accepted, rejected);
      if (onApplied) onApplied();
      onClose();
    } catch (err) {
      console.error('Failed to apply doctrine suggestions:', err);
    }
  }, [suggestions, selected, onClose, onApplied]);

  const handleSkip = useCallback(() => {
    const allIds = suggestions.map(s => s.id);
    if (allIds.length > 0) {
      doctrineMatchingService.apply([], allIds).catch(console.error);
    }
    onClose();
  }, [suggestions, onClose]);

  const toggleSelected = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confidenceClass = (c) => {
    if (c >= 0.7) return styles.confidenceHigh;
    if (c >= 0.4) return styles.confidenceMedium;
    return styles.confidenceLow;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Doctrine Link Suggestions</h3>
            <span className={styles.subtitle}>Review and apply systematic theology links</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Note info */}
        <div className={styles.noteInfo}>
          <span className={styles.typeBadge}>{noteType || 'note'}</span>
          <span className={styles.noteTitle}>{noteTitle || 'Untitled'}</span>
          <span className={styles.notePassage}>{notePassage}</span>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              Analyzing doctrine connections...
            </div>
          ) : suggestions.length === 0 ? (
            <div className={styles.emptyState}>
              No doctrine link suggestions found for this note.
            </div>
          ) : (
            chapterOrder.map(chNum => {
              const group = grouped[chNum];
              // Find the chapter-level entry (no section letter)
              const chapterEntry = group.find(s => !s.sectionLetter);
              const sectionEntries = group.filter(s => s.sectionLetter);

              return (
                <div key={chNum} className={styles.chapterGroup}>
                  <div className={styles.chapterHeader}>Ch{chNum}</div>

                  {/* Chapter-level suggestion */}
                  {chapterEntry && (
                    <div
                      className={`${styles.suggestionItem} ${selected.has(chapterEntry.id) ? styles.selected : ''}`}
                      onClick={() => toggleSelected(chapterEntry.id)}
                    >
                      <div className={styles.checkbox}>
                        <svg className={styles.checkmark} viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className={styles.suggestionContent}>
                        <div className={styles.linkSyntax}>{chapterEntry.linkSyntax}</div>
                        <div className={styles.suggestionTitle}>{chapterEntry.title}</div>
                        <div className={styles.suggestionSignals}>
                          {(chapterEntry.signals || []).slice(0, 3).join(' | ')}
                        </div>
                      </div>
                      <span className={`${styles.confidenceBadge} ${confidenceClass(chapterEntry.confidence)}`}>
                        {Math.round(chapterEntry.confidence * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Section-level suggestions (indented) */}
                  {sectionEntries.map(s => (
                    <div
                      key={s.id}
                      className={`${styles.suggestionItem} ${styles.sectionItem} ${selected.has(s.id) ? styles.selected : ''}`}
                      onClick={() => toggleSelected(s.id)}
                    >
                      <div className={styles.checkbox}>
                        <svg className={styles.checkmark} viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className={styles.suggestionContent}>
                        <div className={styles.linkSyntax}>{s.linkSyntax}</div>
                        <div className={styles.suggestionTitle}>{s.title}</div>
                        {s.summary && (
                          <div className={styles.summaryPreview}>
                            {s.summary.length > 100 ? s.summary.substring(0, 100) + '...' : s.summary}
                          </div>
                        )}
                        <div className={styles.suggestionSignals}>
                          {(s.signals || []).slice(0, 3).join(' | ')}
                        </div>
                      </div>
                      <span className={`${styles.confidenceBadge} ${confidenceClass(s.confidence)}`}>
                        {Math.round(s.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.skipButton} onClick={handleSkip}>
            Skip
          </button>
          <button
            className={styles.applyButton}
            onClick={handleApply}
            disabled={selected.size === 0}
          >
            Apply Selected ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctrineReviewModal;
