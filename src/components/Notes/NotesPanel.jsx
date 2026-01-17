import { useState, useRef, useEffect } from 'react';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { AddNoteModal } from './AddNoteModal';
import { useNotes } from '../../context/NotesContext';
import { useBible } from '../../context/BibleContext';
import styles from './Notes.module.css';

export const NotesPanel = ({ onClose, activeNoteId }) => {
  const {
    notes,
    editingNoteId,
    setEditingNote,
    updateNote,
    deleteNote,
    getNotesForChapter,
    createNote
  } = useNotes();
  const { bookId, chapter } = useBible();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const notesListRef = useRef(null);

  const chapterNotes = getNotesForChapter(bookId, chapter);
  const editingNote = notes.find(n => n.id === editingNoteId);

  // Auto-scroll to active note when it changes
  useEffect(() => {
    if (activeNoteId && notesListRef.current) {
      const activeCard = notesListRef.current.querySelector(`[data-note-id="${activeNoteId}"]`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeNoteId]);

  const handleSelect = (noteId) => {
    setEditingNote(noteId);
  };

  const handleCloseEditor = () => {
    setEditingNote(null);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCreateNote = async (noteData) => {
    const note = await createNote(noteData);
    return note;
  };

  if (editingNote) {
    return (
      <div className={styles.notesPanel}>
        <NoteEditor
          note={editingNote}
          onUpdate={updateNote}
          onClose={handleCloseEditor}
        />
      </div>
    );
  }

  return (
    <div className={styles.notesPanel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Notes</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={styles.noteCount}>
            {chapterNotes.length} {chapterNotes.length === 1 ? 'note' : 'notes'}
          </span>
          <button
            className={styles.addNoteButton}
            onClick={handleOpenModal}
            aria-label="Add new note"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.notesList} ref={notesListRef}>
        {chapterNotes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No notes for this chapter yet.</p>
            <p className={styles.hint}>
              Click the + button to create a note for a verse range.
            </p>
          </div>
        ) : (
          chapterNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isSelected={false}
              isActive={note.id === activeNoteId}
              onSelect={handleSelect}
              onDelete={deleteNote}
            />
          ))
        )}
      </div>

      <AddNoteModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCreateNote={handleCreateNote}
      />
    </div>
  );
};

export default NotesPanel;
