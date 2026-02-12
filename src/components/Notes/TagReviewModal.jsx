import { useState, useEffect, useCallback } from 'react';
import { taggingService } from '../../services/taggingService';
import styles from './TagReviewModal.module.css';

export const TagReviewModal = ({ isOpen, noteId, noteTitle, noteType, notePassage, onClose, onApplied }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPrimary, setSelectedPrimary] = useState(null);
  const [selectedSecondary, setSelectedSecondary] = useState(new Set());
  const [selectedInline, setSelectedInline] = useState(new Set());

  // Analyze note when opened
  useEffect(() => {
    if (!isOpen || !noteId) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const result = await taggingService.analyze(noteId);
        setSuggestions(result.suggestions || []);

        // Pre-select high-confidence items
        const topics = (result.suggestions || []).filter(s => s.suggestionType !== 'inline_tag');
        if (topics.length > 0 && topics[0].confidence >= 0.5) {
          setSelectedPrimary(topics[0].id);
        }
        const secondary = new Set();
        topics.slice(1).forEach(s => {
          if (s.confidence >= 0.6) secondary.add(s.id);
        });
        setSelectedSecondary(secondary);

        const inline = new Set();
        (result.suggestions || []).filter(s => s.suggestionType === 'inline_tag').forEach(s => {
          if (s.confidence >= 0.6) inline.add(s.id);
        });
        setSelectedInline(inline);
      } catch (err) {
        console.error('Failed to analyze note:', err);
      }
      setLoading(false);
    };

    analyze();
  }, [isOpen, noteId]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      setSelectedPrimary(null);
      setSelectedSecondary(new Set());
      setSelectedInline(new Set());
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

  const topicSuggestions = suggestions.filter(s => s.suggestionType !== 'inline_tag');
  const inlineSuggestions = suggestions.filter(s => s.suggestionType === 'inline_tag');

  const handleApply = useCallback(async () => {
    const accepted = [];
    const rejected = [];

    // Process topic suggestions
    for (const s of topicSuggestions) {
      if (s.id === selectedPrimary || selectedSecondary.has(s.id)) {
        accepted.push(s.id);
      } else {
        rejected.push(s.id);
      }
    }

    // Process inline suggestions
    for (const s of inlineSuggestions) {
      if (selectedInline.has(s.id)) {
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
      await taggingService.apply(accepted, rejected);
      if (onApplied) onApplied();
      onClose();
    } catch (err) {
      console.error('Failed to apply suggestions:', err);
    }
  }, [topicSuggestions, inlineSuggestions, selectedPrimary, selectedSecondary, selectedInline, onClose, onApplied]);

  const handleSkip = useCallback(() => {
    // Reject all pending suggestions
    const allIds = suggestions.map(s => s.id);
    if (allIds.length > 0) {
      taggingService.apply([], allIds).catch(console.error);
    }
    onClose();
  }, [suggestions, onClose]);

  const toggleSecondary = (id) => {
    setSelectedSecondary(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInline = (id) => {
    setSelectedInline(prev => {
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

  const hasSelections = selectedPrimary || selectedSecondary.size > 0 || selectedInline.size > 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Tag Suggestions</h3>
            <span className={styles.subtitle}>Review and apply AI-suggested tags</span>
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
              Analyzing note...
            </div>
          ) : suggestions.length === 0 ? (
            <div className={styles.emptyState}>
              No suggestions found for this note.
            </div>
          ) : (
            <>
              {/* Primary Topic */}
              {topicSuggestions.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Primary Topic</div>
                  <div className={styles.suggestionList}>
                    {topicSuggestions.slice(0, 3).map(s => (
                      <div
                        key={s.id}
                        className={`${styles.suggestionItem} ${selectedPrimary === s.id ? styles.selected : ''}`}
                        onClick={() => setSelectedPrimary(selectedPrimary === s.id ? null : s.id)}
                      >
                        <div className={styles.radioCircle}>
                          <div className={styles.radioInner} />
                        </div>
                        <div className={styles.suggestionContent}>
                          <div className={styles.suggestionName}>{s.topicName}</div>
                          <div className={styles.suggestionSignals}>
                            {(s.signals || []).slice(0, 2).join(', ')}
                          </div>
                        </div>
                        <span className={`${styles.confidenceBadge} ${confidenceClass(s.confidence)}`}>
                          {Math.round(s.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary Tags */}
              {topicSuggestions.length > 1 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Secondary Tags</div>
                  <div className={styles.suggestionList}>
                    {topicSuggestions.slice(1).map(s => (
                      <div
                        key={s.id}
                        className={`${styles.suggestionItem} ${selectedSecondary.has(s.id) ? styles.selected : ''}`}
                        onClick={() => toggleSecondary(s.id)}
                      >
                        <div className={styles.checkbox}>
                          <svg className={styles.checkmark} viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className={styles.suggestionContent}>
                          <div className={styles.suggestionName}>{s.topicName}</div>
                          <div className={styles.suggestionSignals}>
                            {(s.signals || []).slice(0, 2).join(', ')}
                          </div>
                        </div>
                        <span className={`${styles.confidenceBadge} ${confidenceClass(s.confidence)}`}>
                          {Math.round(s.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline Tags */}
              {inlineSuggestions.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    Inline Tags ({inlineSuggestions.length})
                  </div>
                  <div className={styles.suggestionList}>
                    {inlineSuggestions.map(s => (
                      <div
                        key={s.id}
                        className={`${styles.inlineItem} ${selectedInline.has(s.id) ? styles.selected : ''}`}
                        onClick={() => toggleInline(s.id)}
                      >
                        <div className={styles.checkbox}>
                          <svg className={styles.checkmark} viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className={styles.suggestionContent}>
                          <div className={styles.tagTypeName}>{s.tagType}</div>
                          <div className={styles.inlinePreview}>
                            {s.textContent ? (s.textContent.length > 120 ? s.textContent.substring(0, 120) + '...' : s.textContent) : ''}
                          </div>
                        </div>
                        <span className={`${styles.confidenceBadge} ${confidenceClass(s.confidence)}`}>
                          {Math.round(s.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
            disabled={!hasSelections}
          >
            Apply Selected
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagReviewModal;
