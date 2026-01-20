import { useState } from 'react';
import { useSystematic } from '../../context/SystematicContext';
import styles from './RelatedDoctrines.module.css';

export const RelatedDoctrines = () => {
  const {
    relatedDoctrines,
    relatedDoctrinesLoading,
    selectEntry,
    openChapter
  } = useSystematic();

  const [isExpanded, setIsExpanded] = useState(true);

  if (relatedDoctrinesLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading related doctrines...</div>
      </div>
    );
  }

  // Don't show if no related doctrines
  if (relatedDoctrines.length === 0) {
    return null;
  }

  // Group by chapter for cleaner display
  const groupedByChapter = relatedDoctrines.reduce((acc, doctrine) => {
    const key = doctrine.chapterNumber;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(doctrine);
    return acc;
  }, {});

  const handleDoctrineClick = (doctrine) => {
    if (doctrine.entryType === 'chapter') {
      openChapter(doctrine.chapterNumber);
    } else {
      selectEntry(doctrine.id);
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles.headerLeft}>
          <svg
            className={styles.icon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className={styles.title}>Related Doctrines</span>
          <span className={styles.badge}>{relatedDoctrines.length}</span>
        </div>
        <svg
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
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

      {isExpanded && (
        <div className={styles.content}>
          {Object.entries(groupedByChapter).map(([chapterNum, doctrines]) => {
            // Find the chapter-level doctrine or use first
            const chapterDoctrine = doctrines.find(d => d.entryType === 'chapter') || doctrines[0];
            const isPrimary = doctrines.some(d => d.isPrimary);

            return (
              <button
                key={chapterNum}
                className={`${styles.doctrineItem} ${isPrimary ? styles.primary : ''}`}
                onClick={() => handleDoctrineClick(chapterDoctrine)}
              >
                <div className={styles.doctrineMain}>
                  <span className={styles.chapterNum}>Ch {chapterNum}</span>
                  <span className={styles.doctrineTitle}>{chapterDoctrine.title}</span>
                </div>
                {isPrimary && (
                  <span className={styles.primaryBadge}>Key</span>
                )}
                {chapterDoctrine.contextSnippet && (
                  <span className={styles.contextSnippet}>
                    {chapterDoctrine.contextSnippet}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RelatedDoctrines;
