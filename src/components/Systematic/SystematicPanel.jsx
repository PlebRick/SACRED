import { useState, useEffect, useRef, useCallback } from 'react';
import { useSystematic } from '../../context/SystematicContext';
import { useBible } from '../../context/BibleContext';
import styles from './Systematic.module.css';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' }
];

/**
 * Apply user highlights to HTML content by wrapping matching text with styled marks.
 * @param {string} htmlContent - The HTML content to apply highlights to
 * @param {Array} annotations - Array of annotation objects with annotationType, textSelection, and color
 * @returns {string} - HTML content with highlights applied
 */
const applyHighlightsToContent = (htmlContent, annotations) => {
  if (!annotations || annotations.length === 0 || !htmlContent) {
    return htmlContent;
  }

  let result = htmlContent;

  // Filter to only highlight annotations and sort by length descending
  // to handle overlapping highlights correctly (longer matches first)
  const highlights = annotations
    .filter(a => a.annotationType === 'highlight' && a.textSelection)
    .sort((a, b) => b.textSelection.length - a.textSelection.length);

  for (const ann of highlights) {
    // Escape special regex characters in the text
    const escapedText = ann.textSelection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match the text but avoid matching inside HTML tags
    // We use a simple approach: find text not inside < > brackets
    // This regex looks for the text preceded and followed by word boundaries
    const regex = new RegExp(`(${escapedText})`, 'g');

    // Replace with marked text, but we need to avoid replacing inside tags
    // Use a more careful approach with a callback
    result = result.replace(regex, (match, text, offset) => {
      // Check if we're inside an HTML tag by looking for unmatched < before offset
      const beforeMatch = result.substring(0, offset);
      const openBrackets = (beforeMatch.match(/</g) || []).length;
      const closeBrackets = (beforeMatch.match(/>/g) || []).length;

      // If we're inside a tag (more < than >), don't replace
      if (openBrackets > closeBrackets) {
        return match;
      }

      // Check if this text is already inside a userHighlight mark
      const lastMarkOpen = beforeMatch.lastIndexOf('<mark class="userHighlight"');
      const lastMarkClose = beforeMatch.lastIndexOf('</mark>');
      if (lastMarkOpen > lastMarkClose) {
        return match;
      }

      return `<mark class="userHighlight" style="background-color: ${ann.color}">${text}</mark>`;
    });
  }

  return result;
};

export const SystematicPanel = () => {
  const {
    isPanelOpen,
    selectedEntry,
    closePanel,
    selectEntry,
    openChapter,
    getReferencingNotes,
    annotations,
    addAnnotation,
    deleteAnnotation
  } = useSystematic();

  const { navigate } = useBible();
  const [referencingNotes, setReferencingNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [selection, setSelection] = useState(null);
  const [colorPickerPosition, setColorPickerPosition] = useState(null);
  const contentRef = useRef(null);

  // Load referencing notes when entry changes
  useEffect(() => {
    if (!selectedEntry?.id) {
      setReferencingNotes([]);
      return;
    }

    const loadNotes = async () => {
      setLoadingNotes(true);
      try {
        const notes = await getReferencingNotes(selectedEntry.id);
        setReferencingNotes(notes);
      } catch (error) {
        console.error('Failed to load referencing notes:', error);
        setReferencingNotes([]);
      }
      setLoadingNotes(false);
    };

    loadNotes();
  }, [selectedEntry?.id, getReferencingNotes]);

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      setColorPickerPosition(null);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      setSelection(null);
      setColorPickerPosition(null);
      return;
    }

    // Check if selection is within our content area
    if (!contentRef.current || !contentRef.current.contains(windowSelection.anchorNode)) {
      return;
    }

    const range = windowSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    setSelection({
      text: selectedText,
      range: range.cloneRange()
    });

    // Position the color picker above the selection
    setColorPickerPosition({
      top: rect.top - contentRect.top - 40,
      left: Math.min(Math.max(rect.left - contentRect.left, 0), contentRect.width - 180)
    });
  }, []);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerPosition && !e.target.closest(`.${styles.colorPicker}`)) {
        // Delay to allow color selection
        setTimeout(() => {
          if (window.getSelection()?.isCollapsed) {
            setColorPickerPosition(null);
            setSelection(null);
          }
        }, 100);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorPickerPosition]);

  // Handle highlight creation
  const handleHighlight = async (color) => {
    if (!selection || !selectedEntry?.id) return;

    try {
      await addAnnotation(selectedEntry.id, {
        annotationType: 'highlight',
        color: color,
        textSelection: selection.text
      });

      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setColorPickerPosition(null);
    } catch (error) {
      console.error('Failed to create highlight:', error);
    }
  };

  // Handle annotation deletion
  const handleDeleteAnnotation = async (annotationId) => {
    try {
      await deleteAnnotation(annotationId);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  if (!isPanelOpen || !selectedEntry) {
    return null;
  }

  // Normalize: API returns 'sections' from /chapter/:num, 'children' from /:id
  const entrySections = selectedEntry.sections || selectedEntry.children || [];

  const handleScriptureClick = (ref) => {
    // Parse data-scripture format: "JHN.1.1" or "JHN.1.1-5"
    const match = ref.match(/^([A-Z0-9]+)\.(\d+)\.(\d+)(?:-(\d+))?$/);
    if (match) {
      const [, book, chapter] = match;
      navigate(book, parseInt(chapter, 10));
    }
  };

  const handleRelatedChapterClick = (chapterNum) => {
    openChapter(chapterNum);
  };

  const handleSectionClick = (sectionId) => {
    selectEntry(sectionId);
  };

  // Build breadcrumb
  const getBreadcrumb = () => {
    const parts = [];

    if (selectedEntry.partNumber) {
      parts.push(`Part ${selectedEntry.partNumber}`);
    }

    if (selectedEntry.chapterNumber) {
      parts.push(`Ch ${selectedEntry.chapterNumber}`);
    }

    if (selectedEntry.sectionLetter) {
      parts.push(selectedEntry.sectionLetter);
    }

    if (selectedEntry.subsectionNumber) {
      parts.push(selectedEntry.subsectionNumber.toString());
    }

    return parts;
  };

  // Get link syntax for this entry
  const getLinkSyntax = () => {
    if (!selectedEntry.chapterNumber) return null;

    if (selectedEntry.subsectionNumber) {
      return `[[ST:Ch${selectedEntry.chapterNumber}:${selectedEntry.sectionLetter}.${selectedEntry.subsectionNumber}]]`;
    }
    if (selectedEntry.sectionLetter) {
      return `[[ST:Ch${selectedEntry.chapterNumber}:${selectedEntry.sectionLetter}]]`;
    }
    return `[[ST:Ch${selectedEntry.chapterNumber}]]`;
  };

  // Navigate to previous/next section
  const handlePrevious = () => {
    if (entrySections && entrySections.length > 0) {
      // If viewing chapter, can't go previous
      return;
    }
    // For sections, would need parent context - simplified for now
  };

  const handleNext = () => {
    if (entrySections && entrySections.length > 0) {
      // Navigate to first section
      selectEntry(entrySections[0].id);
    }
  };

  const breadcrumb = getBreadcrumb();
  const linkSyntax = getLinkSyntax();

  return (
    <div className={`${styles.panel} ${isPanelOpen ? styles.open : ''}`}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <div className={styles.headerTop}>
          <button className={styles.closeButton} onClick={closePanel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className={styles.navButtons}>
            <button
              className={styles.navButton}
              onClick={handlePrevious}
              disabled={selectedEntry.entryType === 'part'}
              title="Previous"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              className={styles.navButton}
              onClick={handleNext}
              disabled={!entrySections || entrySections.length === 0}
              title="Next"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          {breadcrumb.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className={styles.breadcrumbSep}>/</span>}
              <span className={styles.breadcrumbPart}>{part}</span>
            </span>
          ))}
        </div>

        <h2 className={styles.panelTitle}>{selectedEntry.title}</h2>

        {linkSyntax && (
          <div className={styles.linkSyntax}>
            <code>{linkSyntax}</code>
            <button
              className={styles.copyButton}
              onClick={() => navigator.clipboard.writeText(linkSyntax)}
              title="Copy link"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.panelContent}>
        {/* Summary */}
        {selectedEntry.summary && (
          <div className={styles.summary}>
            <p>{selectedEntry.summary}</p>
          </div>
        )}

        {/* Main content - with highlights applied */}
        {selectedEntry.content && (
          <div
            ref={contentRef}
            className={styles.content}
            dangerouslySetInnerHTML={{
              __html: applyHighlightsToContent(selectedEntry.content, annotations)
            }}
            onMouseUp={handleTextSelection}
            onClick={(e) => {
              // Handle scripture link clicks
              const target = e.target;
              if (target.tagName === 'A' && target.dataset.scripture) {
                e.preventDefault();
                handleScriptureClick(target.dataset.scripture);
              }
            }}
          />
        )}

        {/* Color Picker Popup */}
        {colorPickerPosition && selection && (
          <div
            className={styles.colorPicker}
            style={{
              top: colorPickerPosition.top,
              left: colorPickerPosition.left
            }}
          >
            <span className={styles.colorPickerLabel}>Highlight:</span>
            {HIGHLIGHT_COLORS.map(color => (
              <button
                key={color.value}
                className={styles.colorButton}
                style={{ backgroundColor: color.value }}
                onClick={() => handleHighlight(color.value)}
                title={color.name}
              />
            ))}
          </div>
        )}

        {/* Sections - display content inline with headers */}
        {entrySections && entrySections.length > 0 && (
          <div className={styles.subsectionsContent}>
            {entrySections
              .filter(s => s.entryType === 'section') // Only show sections, not subsections (subsection content is aggregated into sections)
              .map(section => (
              <div key={section.id} className={styles.subsectionBlock}>
                {/* Section header */}
                {section.sectionLetter && section.title && (
                  <h3 className={styles.inlineSectionHeader}>
                    {section.sectionLetter}. {section.title}
                  </h3>
                )}
                {section.content && (
                  <div
                    className={styles.content}
                    dangerouslySetInnerHTML={{
                      __html: applyHighlightsToContent(section.content, annotations)
                    }}
                    onClick={(e) => {
                      const target = e.target;
                      if (target.tagName === 'A' && target.dataset.scripture) {
                        e.preventDefault();
                        handleScriptureClick(target.dataset.scripture);
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scripture References */}
        {selectedEntry.scriptureReferences && selectedEntry.scriptureReferences.length > 0 && (
          <div className={styles.scripturesBlock}>
            <h3 className={styles.sectionHeader}>
              Key Scripture References
              <span className={styles.badge}>{selectedEntry.scriptureReferences.filter(r => r.isPrimary).length}</span>
            </h3>
            <div className={styles.scripturesList}>
              {selectedEntry.scriptureReferences
                .filter(ref => ref.isPrimary)
                .map((ref, i) => (
                  <button
                    key={i}
                    className={styles.scriptureRef}
                    onClick={() => handleScriptureClick(`${ref.book}.${ref.chapter}.${ref.startVerse}`)}
                  >
                    {ref.book} {ref.chapter}:{ref.startVerse}
                    {ref.endVerse && `-${ref.endVerse}`}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Related Chapters */}
        {selectedEntry.relatedChapters && selectedEntry.relatedChapters.length > 0 && (
          <div className={styles.relatedBlock}>
            <h3 className={styles.sectionHeader}>See Also</h3>
            <div className={styles.relatedList}>
              {selectedEntry.relatedChapters.map((related, i) => (
                <button
                  key={i}
                  className={styles.relatedItem}
                  onClick={() => handleRelatedChapterClick(related.chapterNumber)}
                >
                  <span className={styles.relatedChapter}>Ch {related.chapterNumber}</span>
                  <span className={styles.relatedTitle}>{related.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {selectedEntry.tags && selectedEntry.tags.length > 0 && (
          <div className={styles.tagsBlock}>
            <div className={styles.tagsList}>
              {selectedEntry.tags.map(tag => (
                <span
                  key={tag.id}
                  className={styles.tag}
                  style={{ '--tag-color': tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Your Highlights */}
        {annotations && annotations.length > 0 && (
          <div className={styles.annotationsBlock}>
            <h3 className={styles.sectionHeader}>
              Your Highlights
              <span className={styles.badge}>{annotations.length}</span>
            </h3>
            <div className={styles.annotationsList}>
              {annotations.map(annotation => (
                <div
                  key={annotation.id}
                  className={styles.annotationItem}
                  style={{ '--highlight-color': annotation.color }}
                >
                  <div className={styles.annotationContent}>
                    <span
                      className={styles.annotationColorDot}
                      style={{ backgroundColor: annotation.color }}
                    />
                    <span className={styles.annotationText}>
                      {annotation.textSelection}
                    </span>
                  </div>
                  <button
                    className={styles.deleteAnnotationBtn}
                    onClick={() => handleDeleteAnnotation(annotation.id)}
                    title="Delete highlight"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referencing Notes */}
        <div className={styles.notesBlock}>
          <h3 className={styles.sectionHeader}>
            Your Notes Referencing This
            {referencingNotes.length > 0 && (
              <span className={styles.badge}>{referencingNotes.length}</span>
            )}
          </h3>
          {loadingNotes ? (
            <div className={styles.loadingNotes}>Loading...</div>
          ) : referencingNotes.length > 0 ? (
            <div className={styles.notesList}>
              {referencingNotes.map(note => (
                <div key={note.id} className={styles.noteItem}>
                  <span className={styles.noteRef}>
                    {note.book} {note.startChapter}
                    {note.startVerse && `:${note.startVerse}`}
                  </span>
                  <span className={styles.noteTitle}>{note.title || 'Untitled'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyNotes}>
              <p>No notes reference this doctrine yet.</p>
              <p className={styles.hint}>Use {linkSyntax} in your notes to link here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystematicPanel;
