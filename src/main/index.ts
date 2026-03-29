/**
 * CRA AI Assistant - Main Process Entry Point
 * Clinical Research Assistant powered by GLM-4 AI
 */

import { app, BrowserWindow, session, net } from 'electron';
import * as path from 'path';

// Disable GPU acceleration (fixes Windows GPU errors)
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

/**
 * Check if webpack dev server is running on localhost:8080
 */
async function isDevServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = net.request('http://localhost:8080');
    request.on('response', () => {
      resolve(true);
      request.abort();
    });
    request.on('error', () => {
      resolve(false);
    });
    // Set a short timeout
    setTimeout(() => {
      resolve(false);
      request.abort();
    }, 2000);
    request.end();
  });
}

function createWindow() {
  console.log('Creating main window...');

  // Determine preload path
  const possiblePaths = [
    path.join(__dirname, 'dist', 'main', 'preload.js'),
    path.join(__dirname, 'preload.js'),
    path.join(process.cwd(), 'dist', 'main', 'preload.js'),
  ];
  const preloadPath = possiblePaths.find(p => {
    try {
      return require('fs').existsSync(p);
    } catch {
      return false;
    }
  }) || path.join(__dirname, 'preload.js');
  console.log('Using preload path:', preloadPath);

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

  // Load the app: try dev server first, fall back to built files
  const loadApp = async () => {
    if (!app.isPackaged) {
      // Running from source - check if dev server is available
      const devUrl = 'http://localhost:8080';
      const serverRunning = await isDevServerRunning();
      if (serverRunning) {
        console.log('Loading dev URL:', devUrl);
        mainWindow?.loadURL(devUrl).catch((err) => {
          console.error('Failed to load dev URL:', err);
        });
        mainWindow?.webContents.openDevTools();
        return;
      }
    }

    // Packaged app or dev server not running - load built files
    const filePath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading local file:', filePath);
    mainWindow?.loadFile(filePath).catch((err) => {
      console.error('Failed to load file:', err);
    });
  };

  loadApp();

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
  const csp = app.isPackaged
    ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://open.bigmodel.cn; object-src 'none';"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:8080 ws://localhost:8080 https://open.bigmodel.cn; object-src 'none';";

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