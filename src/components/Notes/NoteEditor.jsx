import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { formatVerseRange } from '../../utils/verseRange';
import styles from './Notes.module.css';

const MenuBar = ({ editor }) => {
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
    </div>
  );
};

export const NoteEditor = ({ note, onUpdate, onClose }) => {
  const [title, setTitle] = useState(note.title || '');
  const [isSaving, setIsSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your sermon notes here...',
      }),
    ],
    content: note.content || '',
    editorProps: {
      attributes: {
        class: styles.proseMirror,
      },
    },
  });

  // Debounced save
  const saveNote = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      await onUpdate(note.id, {
        title,
        content: editor.getHTML(),
      });
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editor, note.id, title, onUpdate]);

  // Auto-save on changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (editor && (title !== note.title || editor.getHTML() !== note.content)) {
        saveNote();
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [title, editor?.getHTML(), saveNote]);

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <span className={styles.editorReference}>{formatVerseRange(note)}</span>
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

      <MenuBar editor={editor} />

      <div className={styles.editorContent}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default NoteEditor;
