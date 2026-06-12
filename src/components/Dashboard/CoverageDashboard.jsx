import { useState, useEffect, useMemo } from 'react';
import { useBible } from '../../context/BibleContext';
import { useSystematic } from '../../context/SystematicContext';
import { books } from '../../utils/bibleBooks';
import { coverageService } from '../../services/coverageService';
import styles from './CoverageDashboard.module.css';

const OT_COUNT = 39;

const PART_NAMES = {
  1: 'The Word of God',
  2: 'God',
  3: 'Man',
  4: 'Christ & the Holy Spirit',
  5: 'Redemption',
  6: 'The Church',
  7: 'The Future'
};

// Heat intensity class from total notes touching a chapter
const heatClass = (cell) => {
  if (!cell) return styles.heat0;
  const total = cell.note + cell.commentary + cell.sermon;
  if (total >= 4) return styles.heat4;
  if (total >= 3) return styles.heat3;
  if (total >= 2) return styles.heat2;
  if (total >= 1) return styles.heat1;
  return styles.heat0;
};

const cellTitle = (book, ch, cell) => {
  if (!cell) return `${book.name} ${ch} — no notes`;
  const parts = [];
  if (cell.sermon) parts.push(`${cell.sermon} sermon${cell.sermon > 1 ? 's' : ''}`);
  if (cell.commentary) parts.push(`${cell.commentary} commentary`);
  if (cell.note) parts.push(`${cell.note} note${cell.note > 1 ? 's' : ''}`);
  return `${book.name} ${ch} — ${parts.join(', ')}`;
};

const formatMonth = (ym) => {
  const [y, m] = ym.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

function StatCard({ value, label, sublabel }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sublabel && <div className={styles.statSublabel}>{sublabel}</div>}
    </div>
  );
}

function BookRow({ book, chapters, onNavigate }) {
  const cells = [];
  for (let ch = 1; ch <= book.chapters; ch++) {
    const cell = chapters?.[ch];
    cells.push(
      <button
        key={ch}
        className={`${styles.heatCell} ${heatClass(cell)} ${cell?.sermon ? styles.hasSermon : ''}`}
        title={cellTitle(book, ch, cell)}
        onClick={() => onNavigate(book.id, ch)}
        aria-label={cellTitle(book, ch, cell)}
      />
    );
  }
  const hasAny = chapters && Object.keys(chapters).length > 0;
  return (
    <div className={`${styles.bookRow} ${hasAny ? '' : styles.bookRowEmpty}`}>
      <span className={styles.bookLabel}>{book.id}</span>
      <div className={styles.heatCells}>{cells}</div>
    </div>
  );
}

export function CoverageDashboard({ onNavigateToReader }) {
  const { navigate } = useBible();
  const { openChapter } = useSystematic();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    coverageService
      .get()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const handleNavigate = (bookId, chapter) => {
    navigate(bookId, chapter);
    onNavigateToReader?.();
  };

  const doctrineParts = useMemo(() => {
    if (!data) return [];
    const byPart = new Map();
    for (const d of data.doctrines) {
      if (!byPart.has(d.partNumber)) byPart.set(d.partNumber, []);
      byPart.get(d.partNumber).push(d);
    }
    return [...byPart.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  const maxActivity = useMemo(
    () => (data ? Math.max(1, ...data.activity.map((a) => a.total)) : 1),
    [data]
  );

  const topTopics = useMemo(
    () => (data ? data.topics.filter((t) => t.noteCount > 0).slice(0, 12) : []),
    [data]
  );
  const maxTopic = Math.max(1, ...topTopics.map((t) => t.noteCount));

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>Couldn't load coverage statistics: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>Loading coverage…</div>
      </div>
    );
  }

  const otBooks = books.slice(0, OT_COUNT);
  const ntBooks = books.slice(OT_COUNT);

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Pulpit Coverage</h2>
        <p className={styles.pageSubtitle}>
          What you've taught, where you've been, and what's still waiting.
        </p>
      </header>

      <section className={styles.statsRow}>
        <StatCard value={data.totals.sermons} label="Sermons" />
        <StatCard value={data.totals.notes} label="Notes" />
        <StatCard value={data.totals.commentary} label="Commentary" />
        <StatCard
          value={`${data.totals.booksWithNotes}/66`}
          label="Books touched"
        />
        <StatCard
          value={`${data.totals.doctrinesCovered}/${data.totals.doctrinesTotal}`}
          label="Doctrines covered"
        />
        <StatCard
          value={data.illustrations.unique}
          label="Illustrations"
          sublabel={
            data.illustrations.total > data.illustrations.unique
              ? `${data.illustrations.total - data.illustrations.unique} reused`
              : 'all unique'
          }
        />
      </section>

      {data.activity.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Activity</h3>
          <div className={styles.activityChart}>
            {data.activity.map((a) => (
              <div
                key={a.month}
                className={styles.activityCol}
                title={`${formatMonth(a.month)}: ${a.total} notes (${a.sermons} sermons)`}
              >
                <div className={styles.activityBarWrap}>
                  <div
                    className={styles.activityBar}
                    style={{ height: `${Math.max(4, (a.total / maxActivity) * 100)}%` }}
                  />
                </div>
                <span className={styles.activityLabel}>{formatMonth(a.month)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Scripture coverage</h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.heatCell} ${styles.heat0}`} /> none
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.heatCell} ${styles.heat1}`} /> 1
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.heatCell} ${styles.heat2}`} /> 2
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.heatCell} ${styles.heat4}`} /> 4+
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.heatCell} ${styles.heat1} ${styles.hasSermon}`} /> sermon
          </span>
        </div>
        <div className={styles.testaments}>
          <div className={styles.testament}>
            <h4 className={styles.testamentTitle}>Old Testament</h4>
            {otBooks.map((b) => (
              <BookRow key={b.id} book={b} chapters={data.heatmap[b.id]} onNavigate={handleNavigate} />
            ))}
          </div>
          <div className={styles.testament}>
            <h4 className={styles.testamentTitle}>New Testament</h4>
            {ntBooks.map((b) => (
              <BookRow key={b.id} book={b} chapters={data.heatmap[b.id]} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Doctrine coverage</h3>
        <div className={styles.doctrineParts}>
          {doctrineParts.map(([partNumber, chapters]) => (
            <div key={partNumber} className={styles.doctrinePart}>
              <h4 className={styles.doctrinePartTitle}>
                {PART_NAMES[partNumber] || `Part ${partNumber}`}
              </h4>
              <div className={styles.doctrineChips}>
                {chapters.map((d) => (
                  <button
                    key={d.chapterNumber}
                    className={`${styles.doctrineChip} ${d.noteCount > 0 ? styles.doctrineCovered : ''} ${d.sermonCount > 0 ? styles.doctrinePreached : ''}`}
                    title={
                      d.noteCount > 0
                        ? `${d.title} — ${d.noteCount} note${d.noteCount > 1 ? 's' : ''}${d.sermonCount ? `, ${d.sermonCount} sermon${d.sermonCount > 1 ? 's' : ''}` : ''}${d.lastTouched ? ` (last: ${formatDate(d.lastTouched)})` : ''}`
                        : `${d.title} — never referenced`
                    }
                    onClick={() => {
                      // SystematicPanel lives in the reader view, so switch back first
                      openChapter(d.chapterNumber);
                      onNavigateToReader?.();
                    }}
                  >
                    <span className={styles.doctrineNum}>{d.chapterNumber}</span>
                    <span className={styles.doctrineTitle}>{d.title}</span>
                    {d.noteCount > 0 && (
                      <span className={styles.doctrineCount}>{d.noteCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        {topTopics.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Topics</h3>
            <div className={styles.topicBars}>
              {topTopics.map((t) => (
                <div key={t.id} className={styles.topicRow}>
                  <span className={styles.topicName}>{t.name}</span>
                  <div className={styles.topicBarTrack}>
                    <div
                      className={styles.topicBar}
                      style={{ width: `${(t.noteCount / maxTopic) * 100}%` }}
                    />
                  </div>
                  <span className={styles.topicCount}>{t.noteCount}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.series.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Sermon series</h3>
            <div className={styles.seriesList}>
              {data.series.map((s) => (
                <div key={s.id} className={styles.seriesItem}>
                  <div className={styles.seriesName}>{s.name}</div>
                  <div className={styles.seriesMeta}>
                    {s.sermonCount} sermon{s.sermonCount !== 1 ? 's' : ''}
                    {s.firstDate && (
                      <>
                        {' · '}
                        {formatDate(s.firstDate)}
                        {s.lastDate && s.lastDate !== s.firstDate ? ` – ${formatDate(s.lastDate)}` : ''}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {data.illustrations.duplicates.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Reused illustrations</h3>
          <div className={styles.dupeList}>
            {data.illustrations.duplicates.map((d) => (
              <div key={d.signature} className={styles.dupeItem}>
                <div className={styles.dupeText}>"{d.text.length > 140 ? `${d.text.slice(0, 140)}…` : d.text}"</div>
                <div className={styles.dupeMeta}>
                  Used {d.useCount}× in:{' '}
                  {d.notes.map((n, i) => (
                    <span key={n.id}>
                      {i > 0 && ', '}
                      <em>{n.title || 'Untitled'}</em>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default CoverageDashboard;
