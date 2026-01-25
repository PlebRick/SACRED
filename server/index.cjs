require('dotenv').config();
const express = require('express');
const path = require('path');

// Import database first to ensure tables are created
const db = require('./db.cjs');

// Load bundled data (systematic theology) if database is empty
const { loadSystematicTheologyIfNeeded } = require('./utils/dataLoader.cjs');
loadSystematicTheologyIfNeeded(db);

// Import routes
const notesRoutes = require('./routes/notes.cjs');
const backupRoutes = require('./routes/backup.cjs');
const topicsRoutes = require('./routes/topics.cjs');
const inlineTagsRoutes = require('./routes/inlineTags.cjs');
const systematicRoutes = require('./routes/systematic.cjs');
const sessionsRoutes = require('./routes/sessions.cjs');
const bibleRoutes = require('./routes/bible.cjs');
const seriesRoutes = require('./routes/series.cjs');
const authRoutes = require('./routes/auth.cjs');

// Import auth middleware
const { authMiddleware, cleanupExpiredSessions } = require('./middleware/auth.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '100mb' }));

// Auth routes (must be before auth middleware)
app.use('/api/auth', authRoutes);

// Auth middleware (protects all API routes except /api/auth/*)
app.use('/api', authMiddleware);

// API routes - backup routes first to handle /export, /import, /count before /:id
app.use('/api/notes', backupRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/inline-tags', inlineTagsRoutes);
app.use('/api/systematic', systematicRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/series', seriesRoutes);

// Cleanup expired sessions periodically (every hour)
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for non-API routes
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Sacred server running on port ${PORT}`);
});
