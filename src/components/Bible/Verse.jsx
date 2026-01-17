import { forwardRef } from 'react';
import styles from './Bible.module.css';

export const Verse = forwardRef(({
  number,
  text,
  isHighlighted,
  isFirstInRange,
  isLastInRange,
  onClick
}, ref) => {
  const classNames = [
    styles.verse,
    isHighlighted ? styles.highlighted : '',
    isFirstInRange ? styles.rangeStart : '',
    isLastInRange ? styles.rangeEnd : ''
  ].filter(Boolean).join(' ');

  return (
    <span
      ref={ref}
      className={classNames}
      onClick={onClick}
      data-verse={number}
    >
      <sup className={styles.verseNumber}>{number}</sup>
      <span className={styles.verseText}>{text}</span>
    </span>
  );
});

Verse.displayName = 'Verse';

export default Verse;
