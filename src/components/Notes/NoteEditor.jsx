import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { InlineTagMark } from '../../extensions/InlineTagMark';
import { SystematicLinkMark } from '../../extensions/SystematicLinkMark';
import { InsertDoctrineModal } from './InsertDoctrineModal';
import { SystematicLinkTooltip } from './SystematicLinkTooltip';
import { formatVerseRange } from '../../utils/verseRange';
import { parseReference } from '../../utils/parseReference';
import { TopicSelector } from '../UI/TopicSelector';
import { SeriesSelector } from '../UI/SeriesSelector';
import { NoteTypeIndicator } from '../UI/NoteTypeIndicator';
import { useTopics } from '../../context/TopicsContext';
import { useInlineTags } from '../../context/InlineTagsContext';
import { useSystematic } from '../../context/SystematicContext';
import { useBible } from '../../context/BibleContext';
import { useNotes } from '../../context/NotesContext';
import { useSeries } from '../../context/SeriesContext';
import styles from './Notes.module.css';

const InlineTagDropdown = ({ editor, tagTypes, onAddTagType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Check if any inline tag is active
  const activeTagType = tagTypes.find(t =>
    editor.isActive('inlineTag', { tagType: t.id })
  );

  const handleTagClick = (tagType) => {
    editor.chain().focus().toggleInlineTag(tagType.id).run();
    setIsOpen(false);
  };

  return (
    <div className={styles.tagDropdownWrapper} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${styles.tagDropdownButton} ${activeTagType ? styles.active : ''}`}
        title="Inline Tags"
      >
        <span>{activeTagType?.icon || '🏷️'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.tagDropdown}>
          {tagTypes.map((tagType) => (
            <button
              key={tagType.id}
              className={`${styles.tagDropdownItem} ${editor.isActive('inlineTag', { tagType: tagType.id }) ? styles.selected : ''}`}
              onClick={() => handleTagClick(tagType)}
            >
              <span className={styles.tagItemIcon}>{tagType.icon}</span>
              <span className={styles.tagItemLabel}>{tagType.name}</span>
              {editor.isActive('inlineTag', { tagType: tagType.id }) && (
                <svg className={styles.tagItemCheck} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
          <div className={styles.tagDropdownDivider} />
          <button
            className={`${styles.tagDropdownItem} ${styles.addNew}`}
            onClick={() => {
              setIsOpen(false);
              onAddTagType();
            }}
          >
            <span className={styles.tagItemIcon}>+</span>
            <span className={styles.tagItemLabel}>Add Tag Type</span>
          </button>
        </div>
      )}
    </div>
  );
};

const MenuBar = ({ editor, tagTypes, onAddTagType, onInsertDoctrine }) => {
  if (!editor) return null;

  return (
    <div className={styles.menuBar}>
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${styles.menuButton} ${editor.isActive('bold') ? styles.active : ''}`}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${styles.menuButton} ${editor.isActive('italic') ? styles.active : ''}`}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`${styles.menuButton} ${editor.isActive('strike') ? styles.active : ''}`}
        title="Strikethrough"
      >
        <s>S</s>
      </button>

      <div className={styles.menuDivider} />

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${styles.menuButton} ${editor.isActive('heading', { level: 2 }) ? styles.active : ''}`}
        title="Heading"
      >
        H
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${styles.menuButton} ${editor.isActive('bulletList') ? styles.active : ''}`}
        title="Bullet List"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3" cy="6" r="1" fill="currentColor" />
          <circle cx="3" cy="12" r="1" fill="currentColor" />
          <circle cx="3" cy="18" r="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${styles.menuButton} ${editor.isActive('orderedList') ? styles.active : ''}`}
        title="Numbered List"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <text x="3" y="7" fontSize="8" fill="currentColor">1</text>
          <text x="3" y="13" fontSize="8" fill="currentColor">2</text>
          <text x="3" y="19" fontSize="8" fill="currentColor">3</text>
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`${styles.menuButton} ${editor.isActive('blockquote') ? styles.active : ''}`}
        title="Quote"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 17h3l2-4V7H5v6h3M14 17h3l2-4V7h-6v6h3" />
        </svg>
      </button>

      <div className={styles.menuDivider} />

      <button
        onClick={onInsertDoctrine}
        className={styles.menuButton}
        title="Insert Doctrine Link (Cmd+Shift+D)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </button>

      <InlineTagDropdown
        editor={editor}
        tagTypes={tagTypes}
        onAddTagType={onAddTagType}
      />
    </div>
  );
};

// Add Tag Type Modal
const AddTagTypeModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#60a5fa');
  const [error, setError] = useState('');

  const colorPalette = [
    '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6',
    '#f87171', '#fb923c', '#4ade80', '#22d3d8', '#818cf8'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await onCreate({ name: name.trim(), color, icon: icon || null });
      setName('');
      setIcon('');
      setColor('#60a5fa');
      setError('');
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add Tag Type</h2>
          <button className={styles.modalCloseButton} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <label className={styles.inputLabel}>Name</label>
            <input
              type="text"
              className={`${styles.modalInput} ${error ? styles.inputError : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Definition"
              autoFocus
            />
            {error && <p className={styles.errorMessage}>{error}</p>}

            <label className={styles.inputLabel} style={{ marginTop: '1rem' }}>Icon (emoji)</label>
            <input
              type="text"
              className={`${styles.modalInput} ${styles.iconInput}`}
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 2))}
              placeholder="📝"
            />

            <label className={styles.inputLabel} style={{ marginTop: '1rem' }}>Color</label>
            <div className={styles.colorPicker}>
              {colorPalette.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${color === c ? styles.selected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.createButton}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const NoteEditor = ({ note, onUpdate, onClose }) => {
  const [title, setTitle] = useState(note.title || '');
  const [primaryTopicId, setPrimaryTopicId] = useState(note.primaryTopicId || null);
  const [tags, setTags] = useState(note.tags?.map(t => t.id) || []);
  const [seriesId, setSeriesId] = useState(note.seriesId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showAddTagType, setShowAddTagType] = useState(false);
  const [showDoctrineModal, setShowDoctrineModal] = useState(false);
  const editorContentRef = useRef(null);

  const { getTopicById, refreshTopics } = useTopics();
  const { tagTypes, createTagType, refreshCounts } = useInlineTags();
  const { navigateToLink } = useSystematic();
  const { navigate } = useBible();
  const { highlightQuery, clearHighlightQuery } = useNotes();
  const { addSermonToSeries, removeSermonFromSeries, getSeriesById } = useSeries();

  // Handle cross-ref tag clicks - navigate to Bible passage
  const handleCrossRefClick = useCallback((text) => {
    const parsed = parseReference(text);
    if (parsed) {
      navigate(parsed.bookId, parsed.startChapter);
    }
  }, [navigate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your sermon notes here...',
      }),
      InlineTagMark.configure({
        onCrossRefClick: handleCrossRefClick,
      }),
      SystematicLinkMark.configure({
        onLinkClick: (reference) => {
          // Navigate to the doctrine when clicked
          navigateToLink(`[[ST:${reference}]]`);
        },
      }),
    ],
    content: note.content || '',
    editorProps: {
      attributes: {
        class: styles.proseMirror,
      },
    },
  });

  // Listen for keyboard shortcut to open doctrine modal
  useEffect(() => {
    const handleOpenDoctrine = () => {
      setShowDoctrineModal(true);
    };
    window.addEventListener('openDoctrineModal', handleOpenDoctrine);
    return () => window.removeEventListener('openDoctrineModal', handleOpenDoctrine);
  }, []);

  // Focus editor when opened from search (scroll-to-match)
  useEffect(() => {
    if (highlightQuery && editor) {
      // Focus to start of editor when coming from search
      editor.commands.focus('start');
      clearHighlightQuery();
    }
  }, [highlightQuery, editor, clearHighlightQuery]);

  // Handle inserting doctrine link
  const handleInsertDoctrine = useCallback((reference, title) => {
    if (editor) {
      editor.chain().focus().insertSystematicLink(reference, reference).run();
    }
  }, [editor]);

  // Handle series change for sermons
  const handleSeriesChange = useCallback(async (newSeriesId) => {
    if (note.type !== 'sermon') return;

    try {
      // Remove from old series if exists
      if (seriesId && seriesId !== newSeriesId) {
        await removeSermonFromSeries(seriesId, note.id);
      }
      // Add to new series if selected
      if (newSeriesId && newSeriesId !== seriesId) {
        await addSermonToSeries(newSeriesId, note.id);
      }
      setSeriesId(newSeriesId);
    } catch (err) {
      console.error('Failed to update series:', err);
    }
  }, [note.type, note.id, seriesId, addSermonToSeries, removeSermonFromSeries]);

  // Debounced save
  const saveNote = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      await onUpdate(note.id, {
        title,
        content: editor.getHTML(),
        primaryTopicId,
        tags,
      });
      // Refresh topics to update note counts
      refreshTopics();
      // Refresh inline tag counts
      refreshCounts();
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editor, note.id, title, primaryTopicId, tags, onUpdate, refreshTopics, refreshCounts]);

  // Auto-save on changes
  useEffect(() => {
    const hasContentChanges = editor && (title !== note.title || editor.getHTML() !== note.content);

    // Compare topics (treat undefined/null as equivalent)
    const notePrimaryTopicId = note.primaryTopicId || null;
    const noteTagIds = (note.tags?.map(t => t.id) || []).sort();
    const currentTagIds = [...tags].sort();
    const hasTopicChanges = primaryTopicId !== notePrimaryTopicId ||
      JSON.stringify(currentTagIds) !== JSON.stringify(noteTagIds);

    const timeout = setTimeout(() => {
      if (hasContentChanges || hasTopicChanges) {
        saveNote();
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [title, editor?.getHTML(), primaryTopicId, tags, saveNote]);

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <div className={styles.editorHeaderLeft}>
          <span className={styles.editorReference}>{formatVerseRange(note)}</span>
          <NoteTypeIndicator type={note.type} showLabel size="md" />
        </div>
        <div className={styles.editorActions}>
          {isSaving && <span className={styles.savingIndicator}>Saving...</span>}
          <button className={styles.closeButton} onClick={onClose} aria-label="Close editor">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <input
        type="text"
        className={styles.titleInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
      />

      {/* Series selector for sermons */}
      {note.type === 'sermon' && (
        <div className={styles.editorSeries}>
          <SeriesSelector
            label="Sermon Series"
            value={seriesId}
            onChange={handleSeriesChange}
            placeholder="Select or create series..."
          />
        </div>
      )}

      {/* Topics section */}
      <div className={styles.editorTopics}>
        <div className={styles.topicRow}>
          <button
            className={styles.topicToggle}
            onClick={() => setShowTopics(!showTopics)}
          >
            {showTopics ? 'Hide topics' : 'Edit topics'}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginLeft: '0.25rem', transform: showTopics ? 'rotate(180deg)' : 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {!showTopics && (primaryTopicId || tags.length > 0) && (
            <span className={styles.topicPreview}>
              {primaryTopicId && getTopicById(primaryTopicId)?.name}
              {primaryTopicId && tags.length > 0 && ', '}
              {tags.length > 0 && `+${tags.length} tag${tags.length > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        {showTopics && (
          <div className={styles.topicSelectors}>
            <TopicSelector
              label="Primary Topic"
              value={primaryTopicId}
              onChange={setPrimaryTopicId}
              placeholder="Select topic..."
            />
            <TopicSelector
              label="Additional Tags"
              multiSelect
              selectedValues={tags}
              onMultiChange={setTags}
              placeholder="Add tags..."
            />
          </div>
        )}
      </div>

      <MenuBar
        editor={editor}
        tagTypes={tagTypes}
        onAddTagType={() => setShowAddTagType(true)}
        onInsertDoctrine={() => setShowDoctrineModal(true)}
      />

      <div className={styles.editorContent} ref={editorContentRef}>
        <EditorContent editor={editor} />
      </div>

      <SystematicLinkTooltip editorContainerRef={editorContentRef} />

      <AddTagTypeModal
        isOpen={showAddTagType}
        onClose={() => setShowAddTagType(false)}
        onCreate={async (data) => {
          await createTagType(data);
          refreshCounts();
        }}
      />

      <InsertDoctrineModal
        isOpen={showDoctrineModal}
        onClose={() => setShowDoctrineModal(false)}
        onInsert={handleInsertDoctrine}
      />
    </div>
  );
};

export default NoteEditor;
