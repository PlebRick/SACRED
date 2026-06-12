import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useBible } from '../../context/BibleContext';
import { useNotes } from '../../context/NotesContext';
import { useSystematic } from '../../context/SystematicContext';
import { useTheme } from '../../context/ThemeContext';
import { notesService } from '../../services/notesService';
import { systematicService } from '../../services/systematicService';
import { parseReference } from '../../utils/parseReference';
import { getBookById } from '../../utils/bibleBooks';
import styles from './CommandPalette.module.css';

const stripHtml = (html) => (html ? html.replace(/<[^>]*>/g, '') : '');

export const CommandPalette = ({ onClose, view, onSetView, onToggleSidebar }) => {
  const { navigate } = useBible();
  const { setEditingNote, setSelectedNote, setHighlightQuery } = useNotes();
  const { openChapter } = useSystematic();
  const { toggleTheme, toggleHighlights } = useTheme();

  const [query, setQuery] = useState('');
  const [noteResults, setNoteResults] = useState([]);
  const [doctrineResults, setDoctrineResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Static actions, filtered by query
  const actions = useMemo(() => {
    const all = [
      {
        id: 'action-dashboard',
        label: view === 'dashboard' ? 'Back to Reader' : 'Open Coverage Dashboard',
        keywords: 'dashboard coverage pulpit stats reader',
        run: () => onSetView(view === 'dashboard' ? 'reader' : 'dashboard')
      },
      {
        id: 'action-new-note',
        label: 'New Note…',
        keywords: 'new note create add sermon commentary',
        run: () => {
          onSetView('reader');
          // NotesPanel listens for this and opens its AddNoteModal
          window.dispatchEvent(new CustomEvent('sacred:new-note'));
        }
      },
      {
        id: 'action-theme',
        label: 'Toggle Theme',
        keywords: 'theme dark light mode',
        run: () => toggleTheme()
      },
      {
        id: 'action-highlights',
        label: 'Toggle Note Highlights',
        keywords: 'highlights show hide verses',
        run: () => toggleHighlights()
      },
      {
        id: 'action-sidebar',
        label: 'Toggle Sidebar',
        keywords: 'sidebar panel navigation',
        run: () => onToggleSidebar()
      }
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q)
    );
  }, [query, view, onSetView, onToggleSidebar, toggleTheme, toggleHighlights]);

  // Bible reference navigation ("rom 8", "john 3:16")
  const gotoItem = useMemo(() => {
    const parsed = parseReference(query.trim());
    if (!parsed) return null;
    const verse = parsed.startVerse ? `:${parsed.startVerse}` : '';
    return {
      id: 'goto',
      label: `Go to ${parsed.bookName} ${parsed.startChapter}${verse}`,
      run: () => {
        navigate(parsed.bookId, parsed.startChapter);
        onSetView('reader');
      }
    };
  }, [query, navigate, onSetView]);

  // Debounced note + doctrine search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setNoteResults([]);
      setDoctrineResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const [notes, doctrines] = await Promise.all([
        notesService.search(q, 5).catch(() => []),
        systematicService.search(q, 5).catch(() => [])
      ]);
      setNoteResults(notes);
      setDoctrineResults(doctrines.filter((d) => d.chapterNumber));
      setSelectedIndex(0);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Flatten everything into one navigable list with section markers
  const items = useMemo(() => {
    const list = [];
    if (gotoItem) list.push({ section: 'Navigation', ...gotoItem });
    for (const a of actions) list.push({ section: 'Actions', ...a });
    for (const n of noteResults) {
      const book = getBookById(n.book);
      list.push({
        section: 'Notes',
        id: `note-${n.id}`,
        label: n.title || 'Untitled',
        sublabel: `${book?.name || n.book} ${n.startChapter} · ${n.type}`,
        snippet: n.contentSnippet,
        run: () => {
          navigate(n.book, n.startChapter);
          setSelectedNote(n.id);
          setEditingNote(n.id);
          setHighlightQuery(query.trim());
          onSetView('reader');
        }
      });
    }
    for (const d of doctrineResults) {
      list.push({
        section: 'Doctrine',
        id: `doctrine-${d.id}`,
        label: d.title,
        sublabel: `Chapter ${d.chapterNumber}${d.entryType !== 'chapter' ? ` · ${d.entryType}` : ''}`,
        snippet: d.snippet,
        run: () => {
          openChapter(d.chapterNumber);
          onSetView('reader');
        }
      });
    }
    return list;
  }, [gotoItem, actions, noteResults, doctrineResults, navigate, setSelectedNote, setEditingNote, setHighlightQuery, openChapter, onSetView, query]);

  const clampedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));

  const runItem = useCallback(
    (item) => {
      if (!item) return;
      item.run();
      onClose();
    },
    [onClose]
  );

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        runItem(items[clampedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Keep the selected row in view while arrowing through results
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${clampedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [clampedIndex]);

  let lastSection = null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Jump to a passage, search notes & doctrine, or run a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </div>

        <div className={styles.results} ref={listRef}>
          {items.length === 0 && (
            <div className={styles.empty}>Nothing matches "{query}"</div>
          )}
          {items.map((item, index) => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            return (
              <div key={item.id}>
                {showSection && (
                  <div className={styles.sectionLabel}>{item.section}</div>
                )}
                <button
                  data-index={index}
                  className={`${styles.item} ${index === clampedIndex ? styles.selected : ''}`}
                  onClick={() => runItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.sublabel && (
                      <span className={styles.itemSublabel}>{item.sublabel}</span>
                    )}
                  </div>
                  {item.snippet && (
                    <div className={styles.itemSnippet}>
                      {stripHtml(item.snippet).slice(0, 120)}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <span><kbd className={styles.kbd}>↑↓</kbd> navigate</span>
          <span><kbd className={styles.kbd}>↵</kbd> select</span>
          <span>Try "rom 8", a doctrine, or a note title</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
