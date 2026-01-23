import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSystematic } from '../../context/SystematicContext';
import styles from './SystematicLinkTooltip.module.css';

/**
 * Parse a reference string like "Ch32", "Ch32:A", "Ch32:B.1"
 * into structured data for lookup.
 */
const parseReference = (ref) => {
  if (!ref) return null;

  // Match: Ch32, Ch32:A, Ch32:A.1
  const match = ref.match(/^Ch(\d+)(?::([A-Z])(?:\.(\d+))?)?$/i);
  if (!match) return null;

  const [, chapterNum, sectionLetter, subsectionNum] = match;

  return {
    chapterNumber: parseInt(chapterNum, 10),
    sectionLetter: sectionLetter?.toUpperCase() || null,
    subsectionNumber: subsectionNum ? parseInt(subsectionNum, 10) : null,
  };
};

/**
 * Build a flat lookup map from the hierarchical tree.
 * Keys are formatted like "32", "32:A", "32:A.1"
 */
const buildLookupMap = (tree) => {
  const map = new Map();

  for (const part of tree) {
    if (!part.children) continue;

    for (const chapter of part.children) {
      if (chapter.entryType !== 'chapter') continue;

      // Add chapter entry
      const chapterKey = `${chapter.chapterNumber}`;
      map.set(chapterKey, {
        title: chapter.title,
        summary: chapter.summary,
        reference: `Ch${chapter.chapterNumber}`,
      });

      // Add sections and subsections
      if (chapter.children) {
        for (const section of chapter.children) {
          if (section.entryType === 'section') {
            const sectionKey = `${chapter.chapterNumber}:${section.sectionLetter}`;
            map.set(sectionKey, {
              title: section.title,
              summary: section.summary,
              reference: `Ch${chapter.chapterNumber}:${section.sectionLetter}`,
            });

            // Add subsections
            if (section.children) {
              for (const subsection of section.children) {
                if (subsection.entryType === 'subsection') {
                  const subsectionKey = `${chapter.chapterNumber}:${section.sectionLetter}.${subsection.subsectionNumber}`;
                  map.set(subsectionKey, {
                    title: subsection.title,
                    summary: subsection.summary,
                    reference: `Ch${chapter.chapterNumber}:${section.sectionLetter}.${subsection.subsectionNumber}`,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return map;
};

/**
 * Calculate tooltip position relative to the link element.
 * Returns position and placement (above or below).
 */
const calculatePosition = (element) => {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipWidth = 320; // Max width of tooltip
  const tooltipHeight = 120; // Estimated height
  const spacing = 8;

  // Default: center below the link
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  let top = rect.bottom + spacing;
  let placement = 'below';

  // Check if tooltip would go off-screen at bottom
  if (top + tooltipHeight > viewportHeight - spacing) {
    top = rect.top - spacing;
    placement = 'above';
  }

  // Horizontal clamping
  const horizontalPadding = 8;
  if (left < horizontalPadding) {
    left = horizontalPadding;
  } else if (left + tooltipWidth > viewportWidth - horizontalPadding) {
    left = viewportWidth - tooltipWidth - horizontalPadding;
  }

  // Calculate arrow position relative to tooltip
  const arrowLeft = Math.max(
    12,
    Math.min(rect.left + rect.width / 2 - left, tooltipWidth - 12)
  );

  return { left, top, placement, arrowLeft };
};

export const SystematicLinkTooltip = ({ editorContainerRef }) => {
  const { tree } = useSystematic();
  const [tooltip, setTooltip] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const currentElementRef = useRef(null);
  const tooltipRef = useRef(null);

  // Build lookup map from tree (memoized)
  const lookupMap = useMemo(() => buildLookupMap(tree), [tree]);

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Show tooltip for an element
  const showTooltip = useCallback((element) => {
    const ref = element.getAttribute('data-st-ref');
    if (!ref) return;

    const parsed = parseReference(ref);
    if (!parsed) return;

    // Build lookup key
    let key = `${parsed.chapterNumber}`;
    if (parsed.sectionLetter) {
      key += `:${parsed.sectionLetter}`;
      if (parsed.subsectionNumber) {
        key += `.${parsed.subsectionNumber}`;
      }
    }

    const entry = lookupMap.get(key);
    if (!entry) return;

    const position = calculatePosition(element);

    setTooltip({
      ...entry,
      ...position,
    });
  }, [lookupMap]);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    clearTimeouts();
    setTooltip(null);
    currentElementRef.current = null;
  }, [clearTimeouts]);

  // Handle mouse entering a link
  const handleLinkEnter = useCallback((element) => {
    clearTimeouts();
    currentElementRef.current = element;

    // 150ms delay before showing
    hoverTimeoutRef.current = setTimeout(() => {
      if (currentElementRef.current === element) {
        showTooltip(element);
      }
    }, 150);
  }, [clearTimeouts, showTooltip]);

  // Handle mouse leaving a link
  const handleLinkLeave = useCallback(() => {
    clearTimeouts();

    // 50ms grace period to move to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
      currentElementRef.current = null;
    }, 50);
  }, [clearTimeouts]);

  // Handle mouse entering tooltip
  const handleTooltipEnter = useCallback(() => {
    clearTimeouts();
  }, [clearTimeouts]);

  // Handle mouse leaving tooltip
  const handleTooltipLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  // Set up event delegation on the editor container
  useEffect(() => {
    const container = editorContainerRef?.current;
    if (!container) return;

    const handleMouseOver = (e) => {
      const link = e.target.closest('[data-st-ref]');
      if (link && container.contains(link)) {
        handleLinkEnter(link);
      }
    };

    const handleMouseOut = (e) => {
      const link = e.target.closest('[data-st-ref]');
      if (link) {
        // Check if we're moving to the tooltip
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && tooltipRef.current?.contains(relatedTarget)) {
          return;
        }
        handleLinkLeave();
      }
    };

    // Hide on scroll
    const handleScroll = () => {
      hideTooltip();
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimeouts();
    };
  }, [editorContainerRef, handleLinkEnter, handleLinkLeave, hideTooltip, clearTimeouts]);

  // Don't render on touch devices
  if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
    return null;
  }

  if (!tooltip) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={`${styles.tooltip} ${styles[tooltip.placement]}`}
      style={{
        left: `${tooltip.left}px`,
        top: tooltip.placement === 'above' ? 'auto' : `${tooltip.top}px`,
        bottom: tooltip.placement === 'above' ? `${window.innerHeight - tooltip.top}px` : 'auto',
        '--arrow-left': `${tooltip.arrowLeft}px`,
      }}
      onMouseEnter={handleTooltipEnter}
      onMouseLeave={handleTooltipLeave}
    >
      <div className={styles.content}>
        <span className={styles.reference}>{tooltip.reference}</span>
        <h4 className={styles.title}>{tooltip.title}</h4>
        {tooltip.summary ? (
          <p className={styles.summary}>{tooltip.summary}</p>
        ) : (
          <p className={styles.noSummary}>No summary available</p>
        )}
      </div>
      <div className={styles.arrow} />
    </div>,
    document.body
  );
};

export default SystematicLinkTooltip;
