import { useState, useRef, useEffect } from 'react';
import { useSeries } from '../../context/SeriesContext';
import styles from './SeriesSelector.module.css';

export const SeriesSelector = ({
  value,
  onChange,
  placeholder = 'Select series...',
  allowCreate = true,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const { series, createSeries, getSeriesById } = useSeries();

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

  // Filter series based on search
  const filteredSeries = series.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Handle selection
  const handleSelect = (seriesId) => {
    onChange?.(seriesId);
    setIsOpen(false);
    setSearch('');
  };

  // Handle creating new series
  const handleCreate = async () => {
    if (!newSeriesName.trim()) return;

    try {
      const newSeries = await createSeries({ name: newSeriesName.trim() });
      onChange?.(newSeries.id);
      setNewSeriesName('');
      setIsCreating(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create series:', error);
    }
  };

  // Get selected series display
  const selectedSeries = value ? getSeriesById(value) : null;

  return (
    <div className={styles.container} ref={containerRef}>
      {label && <label className={styles.label}>{label}</label>}

      <div
        role="button"
        tabIndex={0}
        className={styles.trigger}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        {selectedSeries ? (
          <span className={styles.value}>
            {selectedSeries.name}
            {selectedSeries.sermonCount > 0 && (
              <span className={styles.count}>({selectedSeries.sermonCount})</span>
            )}
            <button
              type="button"
              className={styles.inlineClearButton}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.(null);
              }}
              title="Remove from series"
            >×</button>
          </span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
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
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrapper}>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search series..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.options}>
            {filteredSeries.length === 0 && !isCreating ? (
              <div className={styles.empty}>
                No series found
              </div>
            ) : (
              filteredSeries.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.option} ${value === s.id ? styles.selected : ''}`}
                  onClick={() => handleSelect(s.id)}
                >
                  <span className={styles.optionName}>{s.name}</span>
                  {s.sermonCount > 0 && (
                    <span className={styles.optionCount}>{s.sermonCount}</span>
                  )}
                  {value === s.id && (
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
                    placeholder="New series name..."
                    value={newSeriesName}
                    onChange={(e) => setNewSeriesName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                      } else if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewSeriesName('');
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.createButton}
                    onClick={handleCreate}
                    disabled={!newSeriesName.trim()}
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
                  Create new series
                </button>
              )}
            </div>
          )}

          {value && (
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

export default SeriesSelector;
