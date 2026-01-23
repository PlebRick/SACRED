import { useCallback, useEffect, useState } from 'react';
import styles from './Layout.module.css';

export const ResizableDivider = ({ onResize, minWidth = 300, maxWidth = 600, direction = 'right', className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    let newWidth;
    if (direction === 'left') {
      // Left panel: width = cursor X position
      newWidth = e.clientX;
    } else {
      // Right panel: width = container width - cursor X position
      const containerWidth = window.innerWidth;
      newWidth = containerWidth - e.clientX;
    }
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    onResize(clampedWidth);
  }, [isDragging, minWidth, maxWidth, onResize, direction]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`${styles.resizableDivider} ${isDragging ? styles.dragging : ''} ${className}`}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.dividerHandle} />
    </div>
  );
};

export default ResizableDivider;
