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
  const [activeTab, setActiveTab] = useState('note');
  const notesListRef = useRef(null);

  // Filter notes by type (default to 'note' for backward compatibility)
  const chapterNotes = getNotesForChapter(bookId, chapter)
    .filter(note => (note.type || 'note') === activeTab);
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
        <h2 className={styles.panelTitle}>{activeTab === 'note' ? 'Notes' : activeTab === 'commentary' ? 'Commentary' : 'Sermons'}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={styles.noteCount}>
            {chapterNotes.length} {activeTab === 'note'
              ? (chapterNotes.length === 1 ? 'note' : 'notes')
              : activeTab === 'commentary'
              ? (chapterNotes.length === 1 ? 'commentary' : 'commentaries')
              : (chapterNotes.length === 1 ? 'sermon' : 'sermons')}
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

      <div className={styles.sectionTabs}>
        <button
          className={`${styles.sectionTab} ${activeTab === 'note' ? styles.active : ''}`}
          onClick={() => setActiveTab('note')}
        >
          Notes
        </button>
        <button
          className={`${styles.sectionTab} ${activeTab === 'commentary' ? styles.active : ''}`}
          onClick={() => setActiveTab('commentary')}
        >
          Commentary
        </button>
        <button
          className={`${styles.sectionTab} ${activeTab === 'sermon' ? styles.active : ''}`}
          onClick={() => setActiveTab('sermon')}
        >
          Sermons
        </button>
      </div>

      <div className={styles.notesList} ref={notesListRef}>
        {chapterNotes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No {activeTab === 'note' ? 'notes' : activeTab === 'commentary' ? 'commentaries' : 'sermons'} for this chapter yet.</p>
            <p className={styles.hint}>
              Click the + button to create {activeTab === 'note' ? 'a note' : activeTab === 'commentary' ? 'a commentary' : 'a sermon'} for a verse range.
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
        noteType={activeTab}
      />
    </div>
  );
};

export default NotesPanel;
