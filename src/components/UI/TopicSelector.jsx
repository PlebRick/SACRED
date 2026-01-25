import { useState, useRef, useEffect } from 'react';
import { useTopics } from '../../context/TopicsContext';
import styles from './TopicSelector.module.css';

export const TopicSelector = ({
  value,
  onChange,
  placeholder = 'Select topic...',
  allowCreate = true,
  multiSelect = false,
  selectedValues = [],
  onMultiChange,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const { flatTopics, createTopic, getTopicPath } = useTopics();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter topics based on search
  const filteredTopics = flatTopics.filter(topic =>
    topic.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get display name with parent path
  const getDisplayName = (topic) => {
    const path = getTopicPath(topic.id);
    if (path.length <= 1) return topic.name;
    return path.map(t => t.name).join(' / ');
  };

  // Handle single selection
  const handleSelect = (topicId) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(topicId)
        ? selectedValues.filter(id => id !== topicId)
        : [...selectedValues, topicId];
      onMultiChange?.(newValues);
    } else {
      onChange?.(topicId);
      setIsOpen(false);
    }
    setSearch('');
  };

  // Handle creating new topic
  const handleCreate = async () => {
    if (!newTopicName.trim()) return;

    try {
      const topic = await createTopic({ name: newTopicName.trim() });
      if (multiSelect) {
        onMultiChange?.([...selectedValues, topic.id]);
      } else {
        onChange?.(topic.id);
        setIsOpen(false);
      }
      setNewTopicName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create topic:', error);
    }
  };

  // Get selected topic display
  const selectedTopic = value ? flatTopics.find(t => t.id === value) : null;

  // Get selected topics for multi-select
  const selectedTopics = multiSelect
    ? selectedValues.map(id => flatTopics.find(t => t.id === id)).filter(Boolean)
    : [];

  return (
    <div className={styles.container} ref={containerRef}>
      {label && <label className={styles.label}>{label}</label>}

      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        {multiSelect ? (
          selectedTopics.length > 0 ? (
            <span className={styles.multiValue}>
              {selectedTopics.map(t => (
                <span key={t.id} className={styles.tagChip}>
                  {t.name}
                  <button
                    type="button"
                    className={styles.removeChip}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMultiChange(selectedValues.filter(id => id !== t.id));
                    }}
                    title="Remove tag"
                  >×</button>
                </span>
              ))}
            </span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )
        ) : (
          selectedTopic ? (
            <span className={styles.value}>
              {selectedTopic.name}
              <button
                type="button"
                className={styles.inlineClearButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(null);
                }}
                title="Clear topic"
              >×</button>
            </span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )
        )}
        <svg
          className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrapper}>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.options}>
            {filteredTopics.length === 0 && !isCreating ? (
              <div className={styles.empty}>
                No topics found
              </div>
            ) : (
              filteredTopics.map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  className={`${styles.option} ${
                    multiSelect
                      ? selectedValues.includes(topic.id) ? styles.selected : ''
                      : value === topic.id ? styles.selected : ''
                  }`}
                  onClick={() => handleSelect(topic.id)}
                >
                  <span className={styles.optionPath}>
                    {getDisplayName(topic)}
                  </span>
                  {(multiSelect ? selectedValues.includes(topic.id) : value === topic.id) && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {allowCreate && (
            <div className={styles.createSection}>
              {isCreating ? (
                <div className={styles.createForm}>
                  <input
                    type="text"
                    className={styles.createInput}
                    placeholder="New topic name..."
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                      } else if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewTopicName('');
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.createButton}
                    onClick={handleCreate}
                    disabled={!newTopicName.trim()}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.createTrigger}
                  onClick={() => setIsCreating(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create new topic
                </button>
              )}
            </div>
          )}

          {!multiSelect && value && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                onChange?.(null);
                setIsOpen(false);
              }}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicSelector;
