const express = require('express');
const path = require('path');
const notesRoutes = require('./routes/notes.cjs');
const backupRoutes = require('./routes/backup.cjs');
const topicsRoutes = require('./routes/topics.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API routes - backup routes first to handle /export, /import, /count before /:id
app.use('/api/notes', backupRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/topics', topicsRoutes);

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
