/**
 * Electron Main Process
 * - Spawns the Python FastAPI backend subprocess
 * - Waits for backend health check before showing the window
 * - Handles all native dialogs (file open/save)
 * - Kills backend cleanly on app exit
 */

const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 8765;
const BACKEND_HOST = '127.0.0.1';

// ─── Backend Management ──────────────────────────────────────────────────────

function getBackendPath() {
  if (app.isPackaged) {
    // In production: backend.exe is in resources/
    return path.join(process.resourcesPath, 'backend.exe');
  } else {
    // In development: run via Python
    return null;
  }
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendExe = getBackendPath();

    if (backendExe) {
      // Production: run compiled backend.exe
      backendProcess = spawn(backendExe, [], {
        windowsHide: true,
        detached: false,
      });
    } else {
      // Development: run via Python
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const backendDir = path.join(__dirname, '..', 'backend');
      backendProcess = spawn(pythonCmd, ['main.py'], {
        cwd: backendDir,
        windowsHide: true,
        env: { ...process.env },
      });
    }

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data}`);
    });
    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend ERR] ${data}`);
    });
    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      reject(err);
    });

    // Poll health endpoint until backend is ready
    let attempts = 0;
    const maxAttempts = 30;
    const poll = setInterval(() => {
      attempts++;
      const req = http.get(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(poll);
          resolve();
        }
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          reject(new Error('Backend failed to start after 30 attempts'));
        }
      });
      req.setTimeout(500, () => req.destroy());
    }, 1000);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  const savedTheme = store.get('theme', 'dark');
  nativeTheme.themeSource = savedTheme;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: savedTheme === 'dark' ? '#0D1117' : '#F6F8FA',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: savedTheme === 'dark' ? '#161B22' : '#FFFFFF',
      symbolColor: savedTheme === 'dark' ? '#E6EDF3' : '#1F2328',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Open File',
    filters: options.filters || [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-file-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath || '',
    filters: options.filters || [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('open-image-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Stamp Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-store', (event, key) => store.get(key));
ipcMain.handle('set-store', (event, key, value) => { store.set(key, value); });

ipcMain.handle('set-theme', (event, theme) => {
  store.set('theme', theme);
  nativeTheme.themeSource = theme;
  mainWindow.setTitleBarOverlay({
    color: theme === 'dark' ? '#161B22' : '#FFFFFF',
    symbolColor: theme === 'dark' ? '#E6EDF3' : '#1F2328',
  });
});

ipcMain.handle('get-backend-url', () => `http://${BACKEND_HOST}:${BACKEND_PORT}`);

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    console.error('Startup error:', err);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the PDF processing backend.\n\n${err.message}\n\nEnsure Python 3 is installed (development mode) or try reinstalling the app.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});
