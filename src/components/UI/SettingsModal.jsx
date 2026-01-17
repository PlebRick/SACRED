import { useState, useRef } from 'react';
import { useNotes } from '../../context/NotesContext';
import styles from './Settings.module.css';

const API_BASE = '/api/notes';

export const SettingsModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [noteCount, setNoteCount] = useState(0);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { refreshNotes } = useNotes();

  const openModal = () => {
    setIsOpen(true);
    setStatus({ type: null, message: '' });
  };

  const closeModal = () => {
    setIsOpen(false);
    setStatus({ type: null, message: '' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
      } else {
        closeModal();
      }
    }
  };

  // Export backup
  const handleExport = async () => {
    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const res = await fetch(`${API_BASE}/export`);
      if (!res.ok) throw new Error('Failed to export notes');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sacred-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({ type: 'success', message: `Exported ${data.notes.length} notes successfully` });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Import backup
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.notes || !Array.isArray(data.notes)) {
        throw new Error('Invalid backup file format');
      }

      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error('Failed to import notes');

      const result = await res.json();
      await refreshNotes();

      setStatus({
        type: 'success',
        message: `Imported ${result.inserted} new, updated ${result.updated} existing notes`
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Delete all - show confirmation
  const handleDeleteClick = async () => {
    try {
      const res = await fetch(`${API_BASE}/count`);
      if (!res.ok) throw new Error('Failed to get note count');
      const { count } = await res.json();
      setNoteCount(count);
      setShowDeleteConfirm(true);
      setDeleteConfirmText('');
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const res = await fetch(API_BASE, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notes');

      const result = await res.json();
      await refreshNotes();

      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setStatus({ type: 'success', message: `Deleted ${result.deleted} notes` });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Gear button for header
  const GearButton = (
    <button
      className={styles.settingsButton}
      onClick={openModal}
      aria-label="Open settings"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  // Delete confirmation modal
  if (showDeleteConfirm) {
    return (
      <>
        {GearButton}
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div
            className={`${styles.modal} ${styles.confirmModal}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className={styles.confirmBody}>
              <div className={styles.confirmIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <h3 className={styles.confirmTitle}>Delete All Notes?</h3>
              <p className={styles.confirmText}>
                This will permanently delete <strong>{noteCount}</strong> note{noteCount !== 1 ? 's' : ''}.
                This action cannot be undone.
              </p>
              <p className={styles.confirmText}>
                Type <strong>DELETE</strong> to confirm:
              </p>
              <input
                type="text"
                className={styles.confirmInput}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                autoFocus
              />
            </div>
            <div className={styles.confirmFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </button>
              <button
                className={styles.deleteButton}
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'DELETE' || loading}
              >
                {loading ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Main settings modal
  if (!isOpen) {
    return GearButton;
  }

  return (
    <>
      {GearButton}
      <div className={styles.modalOverlay} onClick={closeModal}>
        <div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Settings</h2>
            <button
              className={styles.modalCloseButton}
              onClick={closeModal}
              aria-label="Close settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className={styles.modalBody}>
            {status.type && (
              <div className={`${styles.statusMessage} ${status.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
                {status.type === 'success' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                {status.message}
              </div>
            )}

            {/* Backup & Restore Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </span>
                Backup & Restore
              </h3>

              <button
                className={styles.actionButton}
                onClick={handleExport}
                disabled={loading}
              >
                <div className={styles.actionIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className={styles.actionContent}>
                  <div className={styles.actionTitle}>Export Backup</div>
                  <div className={styles.actionDescription}>Download all notes as JSON</div>
                </div>
              </button>

              <button
                className={styles.actionButton}
                onClick={handleImportClick}
                disabled={loading}
              >
                <div className={styles.actionIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className={styles.actionContent}>
                  <div className={styles.actionTitle}>Import Backup</div>
                  <div className={styles.actionDescription}>Restore from JSON file (merges with existing)</div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className={styles.fileInput}
                onChange={handleFileChange}
              />
            </div>

            <div className={styles.divider} />

            {/* Danger Zone */}
            <div className={`${styles.section} ${styles.dangerSection}`}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                Danger Zone
              </h3>

              <button
                className={`${styles.actionButton} ${styles.dangerButton}`}
                onClick={handleDeleteClick}
                disabled={loading}
              >
                <div className={styles.actionIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
                <div className={styles.actionContent}>
                  <div className={styles.actionTitle}>Delete All Notes</div>
                  <div className={styles.actionDescription}>Permanently remove all notes</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsModal;
