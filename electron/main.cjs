const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

// Database path - production uses userData, dev uses local
function getDbPath() {
  if (app.isPackaged) {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'sacred.db');
  }
  return path.join(__dirname, '../data/sacred.db');
}

// Set DB_PATH before loading server modules
process.env.DB_PATH = getDbPath();

const PORT = 3847;
let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (app.isPackaged) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

function startServer() {
  const serverApp = express();
  serverApp.use(express.json());

  // Load existing routes (works from asar)
  const notesRoutes = require('../server/routes/notes.cjs');
  const backupRoutes = require('../server/routes/backup.cjs');
  serverApp.use('/api/notes', backupRoutes);
  serverApp.use('/api/notes', notesRoutes);

  // Serve frontend in production
  if (app.isPackaged) {
    // dist is inside the asar archive, use path relative to this file
    const distPath = path.join(__dirname, '../dist');
    console.log('Serving static files from:', distPath);

    serverApp.use(express.static(distPath));

    // SPA fallback - must not match /api routes
    serverApp.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise((resolve, reject) => {
    server = serverApp.listen(PORT, () => {
      console.log(`SACRED running on port ${PORT}`);
      console.log(`Database: ${process.env.DB_PATH}`);
      resolve();
    });
    server.on('error', reject);
  });
}

app.whenReady().then(async () => {
  // Only start embedded server in production
  // In dev, Vite proxies API calls to the separate dev:server on port 3001
  if (app.isPackaged) {
    try {
      await startServer();
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  } else {
    console.log('Development mode: using Vite dev server on port 3000');
    console.log('Make sure dev:server is running on port 3001');
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (server) server.close();
});
