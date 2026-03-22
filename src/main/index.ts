/**
 * CRA AI Assistant - Main Process Entry Point
 * Clinical Research Assistant powered by GLM-4 AI
 */

import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';

// Disable GPU acceleration (fixes Windows GPU errors)
app.disableHardwareAcceleration();

const isDev = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  console.log('Creating main window...');

  // Determine preload path
  // In development, __dirname might be the project root due to webpack's __dirname: false
  // We need to find the correct path to preload.js
  let preloadPath: string;
  if (isDev) {
    // In development, try to find preload.js in dist/main
    const possiblePaths = [
      path.join(__dirname, 'dist', 'main', 'preload.js'),
      path.join(__dirname, 'preload.js'),
      path.join(process.cwd(), 'dist', 'main', 'preload.js'),
    ];
    preloadPath = possiblePaths.find(p => {
      try {
        return require('fs').existsSync(p);
      } catch {
        return false;
      }
    }) || path.join(__dirname, 'preload.js');
    console.log('Using preload path:', preloadPath);
  } else {
    preloadPath = path.join(__dirname, 'preload.js');
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  // Load the app
  if (isDev) {
    const devUrl = 'http://localhost:8080';
    console.log('Loading dev URL:', devUrl);
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error('Failed to load dev URL:', err);
    });
    mainWindow.webContents.openDevTools();
  } else {
    const filePath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading production file:', filePath);
    mainWindow.loadFile(filePath).catch((err) => {
      console.error('Failed to load file:', err);
    });
  }

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });

  // Log web contents errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  // Set CSP via session for additional security
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:8080 ws://localhost:8080 https://open.bigmodel.cn; object-src 'none';"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://open.bigmodel.cn; object-src 'none';";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Register IPC handlers FIRST, before creating window
  try {
    require('./ipc/handlers').registerIPCHandlers();
    console.log('IPC handlers registered successfully');
  } catch (error) {
    console.error('Failed to register IPC handlers:', error);
  }

  // Create window after handlers are registered
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});