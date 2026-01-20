import { useState, useMemo } from 'react';
import { useSystematic } from '../../context/SystematicContext';
import styles from './SystematicTree.module.css';

// Map tag IDs to part numbers for filtering
const TAG_TO_PART_MAP = {
  'doctrine-word': 1,
  'doctrine-god': 2,
  'doctrine-man': 3,
  'doctrine-christ-spirit': 4,
  'doctrine-salvation': 5,
  'doctrine-church': 6,
  'doctrine-future': 7
};

export const SystematicTree = () => {
  const {
    tree,
    loading,
    error,
    tags,
    selectEntry,
    openChapter,
    search,
    searchResults,
    searchQuery,
    clearSearch
  } = useSystematic();

  const [expandedParts, setExpandedParts] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [selectedTag, setSelectedTag] = useState(null);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handlePartClick = (partId) => {
    setExpandedParts(prev => ({
      ...prev,
      [partId]: !prev[partId]
    }));
  };

  const handleChapterToggle = (e, chapterId) => {
    e.stopPropagation();
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  const handleExpandAll = () => {
    const allChapterIds = {};
    tree.forEach(part => {
      part.children?.forEach(child => {
        if (child.entryType === 'chapter') {
          allChapterIds[child.id] = true;
        }
      });
    });
    setExpandedChapters(allChapterIds);
  };

  const handleCollapseAll = () => {
    setExpandedChapters({});
  };

  const handleChapterClick = (chapter) => {
    openChapter(chapter.chapterNumber);
  };

  const handleSectionClick = (section) => {
    selectEntry(section.id);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (localSearchQuery.trim().length >= 2) {
      search(localSearchQuery.trim());
    }
  };

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    clearSearch();
  };

  const handleTagFilter = (tagId) => {
    setSelectedTag(selectedTag === tagId ? null : tagId);
  };

  // Filter tree by selected tag
  const filteredTree = useMemo(() => {
    if (!selectedTag) return tree;

    // Filter tree to show only matching parts
    return tree.filter(part => TAG_TO_PART_MAP[selectedTag] === part.partNumber);
  }, [tree, selectedTag]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading systematic theology...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No systematic theology content imported yet.</p>
          <p className={styles.hint}>
            Run the import script to add content:
            <code>node scripts/import-systematic-theology.cjs</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Search */}
      <form className={styles.searchForm} onSubmit={handleSearch}>
        <div className={styles.searchInputWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search doctrines..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
          />
          {localSearchQuery && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClearSearch}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Tag filters */}
      <div className={styles.tagFilters}>
        {tags.map(tag => (
          <button
            key={tag.id}
            className={`${styles.tagChip} ${selectedTag === tag.id ? styles.active : ''}`}
            onClick={() => handleTagFilter(tag.id)}
            style={{ '--tag-color': tag.color }}
          >
            {tag.name.replace('Doctrine of ', '').replace('Doctrines of ', '')}
          </button>
        ))}
      </div>

      {/* Expand/Collapse All - only show when not searching */}
      {!searchQuery && tree.length > 0 && (
        <div className={styles.treeControls}>
          <button
            type="button"
            className={styles.expandCollapseBtn}
            onClick={handleExpandAll}
          >
            Expand All
          </button>
          <span className={styles.controlsDivider}>|</span>
          <button
            type="button"
            className={styles.expandCollapseBtn}
            onClick={handleCollapseAll}
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Search results */}
      {searchQuery && searchResults.length > 0 && (
        <div className={styles.searchResults}>
          <div className={styles.searchResultsHeader}>
            <span>Results for "{searchQuery}"</span>
            <button onClick={handleClearSearch} className={styles.clearSearchBtn}>
              Clear
            </button>
          </div>
          {searchResults.map(result => (
            <button
              key={result.id}
              className={styles.searchResultItem}
              onClick={() => selectEntry(result.id)}
            >
              <span className={styles.resultType}>{result.entryType}</span>
              <span className={styles.resultTitle}>{result.title}</span>
              {result.snippet && (
                <span
                  className={styles.resultSnippet}
                  dangerouslySetInnerHTML={{ __html: result.snippet }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tree view */}
      {!searchQuery && (
        <div className={styles.tree}>
          {filteredTree.map(part => (
            <div key={part.id} className={styles.partItem}>
              <button
                className={styles.partButton}
                onClick={() => handlePartClick(part.id)}
              >
                <span className={styles.partTitle}>{part.title}</span>
                <svg
                  className={`${styles.chevron} ${expandedParts[part.id] ? styles.expanded : ''}`}
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

              {expandedParts[part.id] && part.children && (
                <div className={styles.chapters}>
                  {part.children
                    .filter(child => child.entryType === 'chapter')
                    .map(chapter => (
                      <div key={chapter.id} className={styles.chapterItem}>
                        <div className={styles.chapterRow}>
                          {/* Chevron toggle - only show if chapter has sections */}
                          {chapter.children?.some(c => c.entryType === 'section') ? (
                            <button
                              type="button"
                              className={styles.chapterChevron}
                              onClick={(e) => handleChapterToggle(e, chapter.id)}
                              aria-label={expandedChapters[chapter.id] ? 'Collapse sections' : 'Expand sections'}
                            >
                              <svg
                                className={`${styles.chevron} ${expandedChapters[chapter.id] ? styles.expanded : ''}`}
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          ) : (
                            <span className={styles.chapterChevronSpacer} />
                          )}
                          <button
                            className={styles.chapterButton}
                            onClick={() => handleChapterClick(chapter)}
                          >
                            <span className={styles.chapterNumber}>Ch {chapter.chapterNumber}</span>
                            <span className={styles.chapterTitle}>{chapter.title}</span>
                          </button>
                        </div>

                        {/* Sections - only show when expanded */}
                        {expandedChapters[chapter.id] && chapter.children && chapter.children.length > 0 && (
                          <div className={styles.sections}>
                            {chapter.children
                              .filter(child => child.entryType === 'section')
                              .map(section => (
                                <button
                                  key={section.id}
                                  className={styles.sectionButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSectionClick(section);
                                  }}
                                >
                                  <span className={styles.sectionLetter}>{section.sectionLetter}.</span>
                                  <span className={styles.sectionTitle}>{section.title}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystematicTree;
