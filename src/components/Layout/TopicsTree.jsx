import { useState, useEffect } from 'react';
import { useTopics } from '../../context/TopicsContext';
import { useBible } from '../../context/BibleContext';
import { useNotes } from '../../context/NotesContext';
import { topicsService } from '../../services/topicsService';
import { formatVerseRange } from '../../utils/verseRange';
import styles from './TopicsTree.module.css';

// Recursive topic node component
const TopicNode = ({
  topic,
  depth,
  expandedTopics,
  toggleExpand,
  onEdit,
  onDelete,
  onAddChild,
  onSelectTopic,
  selectedTopicId
}) => {
  const hasChildren = topic.children && topic.children.length > 0;
  const isExpanded = expandedTopics[topic.id];
  const isSelected = selectedTopicId === topic.id;

  const handleClick = () => {
    if (hasChildren) {
      toggleExpand(topic.id);
    } else {
      onSelectTopic(topic.id);
    }
  };

  return (
    <div className={styles.topicNode}>
      <div
        className={`${styles.topicRow} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${depth * 1}rem` }}
      >
        <button
          className={styles.topicButton}
          onClick={handleClick}
        >
          {hasChildren && (
            <svg
              className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
          {!hasChildren && <span className={styles.spacer} />}
          <span className={styles.topicName}>{topic.name}</span>
          {topic.noteCount > 0 && (
            <span className={styles.noteCount}>{topic.noteCount}</span>
          )}
        </button>

        <div className={styles.topicActions}>
          <button
            className={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(topic.id);
            }}
            title="Add sub-topic"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(topic);
            }}
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(topic);
            }}
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className={styles.children}>
          {topic.children.map(child => (
            <TopicNode
              key={child.id}
              topic={child}
              depth={depth + 1}
              expandedTopics={expandedTopics}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onSelectTopic={onSelectTopic}
              selectedTopicId={selectedTopicId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TopicsTree = () => {
  const [expandedTopics, setExpandedTopics] = useState({});
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [topicNotes, setTopicNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [editName, setEditName] = useState('');
  const [addingToParent, setAddingToParent] = useState(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [showAddRoot, setShowAddRoot] = useState(false);

  const { topics, loading, createTopic, updateTopic, deleteTopic, seedDefaultTopics, refreshTopics } = useTopics();
  const { navigate } = useBible();
  const { setSelectedNote, setEditingNote } = useNotes();

  const toggleExpand = (topicId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  const handleSelectTopic = async (topicId) => {
    setSelectedTopicId(topicId);
    setLoadingNotes(true);
    try {
      const notes = await topicsService.getNotes(topicId);
      setTopicNotes(notes);
    } catch (error) {
      console.error('Failed to load topic notes:', error);
      setTopicNotes([]);
    }
    setLoadingNotes(false);
  };

  const handleNoteClick = (note) => {
    navigate(note.book, note.startChapter);
    setSelectedNote(note.id);
    setEditingNote(note.id);
  };

  const handleEdit = (topic) => {
    setEditingTopic(topic);
    setEditName(topic.name);
  };

  const handleSaveEdit = async () => {
    if (!editingTopic || !editName.trim()) return;
    try {
      await updateTopic(editingTopic.id, { name: editName.trim() });
      setEditingTopic(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update topic:', error);
    }
  };

  const handleDelete = async (topic) => {
    if (!confirm(`Delete "${topic.name}"? This will also delete all sub-topics.`)) return;
    try {
      await deleteTopic(topic.id);
      if (selectedTopicId === topic.id) {
        setSelectedTopicId(null);
        setTopicNotes([]);
      }
    } catch (error) {
      console.error('Failed to delete topic:', error);
    }
  };

  const handleAddChild = (parentId) => {
    setAddingToParent(parentId);
    setNewTopicName('');
  };

  const handleCreateTopic = async (parentId = null) => {
    if (!newTopicName.trim()) return;
    try {
      await createTopic({
        name: newTopicName.trim(),
        parentId
      });
      setAddingToParent(null);
      setShowAddRoot(false);
      setNewTopicName('');
      // Expand parent to show new child
      if (parentId) {
        setExpandedTopics(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (error) {
      console.error('Failed to create topic:', error);
    }
  };

  const handleSeedTopics = async () => {
    try {
      await seedDefaultTopics();
    } catch (error) {
      console.error('Failed to seed topics:', error);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading topics...</div>;
  }

  if (topics.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No topics yet.</p>
        <button className={styles.seedButton} onClick={handleSeedTopics}>
          Add default topics
        </button>
        <p className={styles.orText}>or</p>
        <button
          className={styles.createButton}
          onClick={() => setShowAddRoot(true)}
        >
          Create your first topic
        </button>
        {showAddRoot && (
          <div className={styles.inlineForm}>
            <input
              type="text"
              className={styles.inlineInput}
              placeholder="Topic name..."
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTopic(null);
                if (e.key === 'Escape') {
                  setShowAddRoot(false);
                  setNewTopicName('');
                }
              }}
              autoFocus
            />
            <button
              className={styles.inlineButton}
              onClick={() => handleCreateTopic(null)}
              disabled={!newTopicName.trim()}
            >
              Add
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Topic tree */}
      <div className={styles.treeContainer}>
        {topics.map(topic => (
          <TopicNode
            key={topic.id}
            topic={topic}
            depth={0}
            expandedTopics={expandedTopics}
            toggleExpand={toggleExpand}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
            onSelectTopic={handleSelectTopic}
            selectedTopicId={selectedTopicId}
          />
        ))}

        {/* Add root topic button */}
        <button
          className={styles.addRootButton}
          onClick={() => setShowAddRoot(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Topic
        </button>

        {showAddRoot && (
          <div className={styles.inlineForm}>
            <input
              type="text"
              className={styles.inlineInput}
              placeholder="Topic name..."
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTopic(null);
                if (e.key === 'Escape') {
                  setShowAddRoot(false);
                  setNewTopicName('');
                }
              }}
              autoFocus
            />
            <button
              className={styles.inlineButton}
              onClick={() => handleCreateTopic(null)}
              disabled={!newTopicName.trim()}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Inline add child form */}
      {addingToParent && (
        <div className={styles.modalOverlay} onClick={() => setAddingToParent(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Add Sub-topic</h3>
            <input
              type="text"
              className={styles.modalInput}
              placeholder="Topic name..."
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTopic(addingToParent);
                if (e.key === 'Escape') {
                  setAddingToParent(null);
                  setNewTopicName('');
                }
              }}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setAddingToParent(null);
                  setNewTopicName('');
                }}
              >
                Cancel
              </button>
              <button
                className={styles.submitButton}
                onClick={() => handleCreateTopic(addingToParent)}
                disabled={!newTopicName.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit topic modal */}
      {editingTopic && (
        <div className={styles.modalOverlay} onClick={() => setEditingTopic(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Edit Topic</h3>
            <input
              type="text"
              className={styles.modalInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') {
                  setEditingTopic(null);
                  setEditName('');
                }
              }}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setEditingTopic(null);
                  setEditName('');
                }}
              >
                Cancel
              </button>
              <button
                className={styles.submitButton}
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected topic notes */}
      {selectedTopicId && (
        <div className={styles.notesPanel}>
          <div className={styles.notesPanelHeader}>
            <button
              className={styles.backButton}
              onClick={() => {
                setSelectedTopicId(null);
                setTopicNotes([]);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>

          {loadingNotes ? (
            <div className={styles.loadingNotes}>Loading notes...</div>
          ) : topicNotes.length === 0 ? (
            <div className={styles.noNotes}>No notes with this topic</div>
          ) : (
            <div className={styles.notesList}>
              {topicNotes.map(note => (
                <button
                  key={note.id}
                  className={styles.noteItem}
                  onClick={() => handleNoteClick(note)}
                >
                  <span className={styles.noteReference}>
                    {formatVerseRange(note)}
                  </span>
                  <span className={styles.noteTitle}>
                    {note.title || 'Untitled'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicsTree;
