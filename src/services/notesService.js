// Notes Service - localStorage implementation (backend-ready interface)
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'sacred_notes';

const loadNotes = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load notes:', e);
    return [];
  }
};

const saveNotes = (notes) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes:', e);
  }
};

export const notesService = {
  getAll: async () => {
    return loadNotes();
  },

  getById: async (id) => {
    const notes = loadNotes();
    return notes.find(note => note.id === id) || null;
  },

  getByReference: async (book, chapter) => {
    const notes = loadNotes();
    return notes.filter(note =>
      note.book === book &&
      ((note.startChapter <= chapter && note.endChapter >= chapter) ||
       note.startChapter === chapter ||
       note.endChapter === chapter)
    );
  },

  create: async (noteData) => {
    const notes = loadNotes();
    const now = new Date().toISOString();

    const note = {
      id: uuidv4(),
      ...noteData,
      createdAt: now,
      updatedAt: now
    };

    notes.push(note);
    saveNotes(notes);
    return note;
  },

  update: async (id, updates) => {
    const notes = loadNotes();
    const index = notes.findIndex(note => note.id === id);

    if (index === -1) {
      throw new Error(`Note not found: ${id}`);
    }

    const updatedNote = {
      ...notes[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    notes[index] = updatedNote;
    saveNotes(notes);
    return updatedNote;
  },

  delete: async (id) => {
    const notes = loadNotes();
    const filtered = notes.filter(note => note.id !== id);

    if (filtered.length === notes.length) {
      throw new Error(`Note not found: ${id}`);
    }

    saveNotes(filtered);
  }
};

export default notesService;
