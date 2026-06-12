import { useState, useEffect, useCallback } from 'react';
import { suggestionsService } from '../../services/suggestionsService';
import styles from './SuggestionsBar.module.css';

const KIND_LABELS = {
  doctrine: 'Doctrine',
  topic: 'Topic',
  illustration: 'Illustration',
  application: 'Application'
};

// AI enrichment suggestions for the open note. Suggestions are generated
// server-side ~20s after a sermon/commentary save (requires ANTHROPIC_API_KEY);
// this bar polls while the editor is open and shows accept/dismiss chips.
export const SuggestionsBar = ({ noteId, onInsertDoctrine, onTopicAccepted }) => {
  const [suggestions, setSuggestions] = useState([]);

  const refresh = useCallback(async () => {
    try {
      setSuggestions(await suggestionsService.getForNote(noteId));
    } catch {
      // Suggestions are best-effort; stay quiet on failure
    }
  }, [noteId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 25000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAccept = async (s) => {
    try {
      await suggestionsService.accept(s.id);
      if (s.kind === 'doctrine') {
        onInsertDoctrine?.(`Ch${s.chapterNumber}`, s.title);
      } else if (s.kind === 'topic') {
        onTopicAccepted?.(s.topicId);
      }
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      // leave the chip in place on failure
    }
  };

  const handleDismiss = async (s) => {
    try {
      await suggestionsService.dismiss(s.id);
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      // leave the chip in place on failure
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className={styles.bar}>
      <div className={styles.barLabel}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
        </svg>
        Suggestions
      </div>
      <div className={styles.chips}>
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={styles.chip}
            title={s.reason || s.summary || ''}
          >
            <span className={styles.chipKind}>{KIND_LABELS[s.kind]}</span>
            <span className={styles.chipText}>
              {s.kind === 'doctrine' && `Ch${s.chapterNumber} ${s.title}`}
              {s.kind === 'topic' && s.name}
              {(s.kind === 'illustration' || s.kind === 'application') &&
                `Untagged: "${(s.summary || s.excerpt || '').slice(0, 50)}"`}
            </span>
            {(s.kind === 'doctrine' || s.kind === 'topic') && (
              <button
                className={styles.chipAction}
                onClick={() => handleAccept(s)}
                title={s.kind === 'doctrine' ? 'Insert doctrine link' : 'Add topic tag'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
            )}
            <button
              className={`${styles.chipAction} ${styles.chipDismiss}`}
              onClick={() => handleDismiss(s)}
              title="Dismiss"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestionsBar;
