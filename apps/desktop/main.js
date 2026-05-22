const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
const terminals = new Map();
let nextTermId = 1;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 600,
    title: 'Problocks Studio',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.STUDIO_URL || 'http://localhost:4000';
  mainWindow.loadURL(devUrl);
}

// ── Project root ─────────────────────────────────────────────────────

ipcMain.handle('app:projectRoot', () => {
  return path.resolve(__dirname, '..', '..');
});

// ── Terminal via out-of-process PTY host ──────────────────────────────
// Spawns pty-host.js as a regular Node.js process (not Electron),
// avoiding all native module ABI issues.

ipcMain.handle('terminal:create', (event, options = {}) => {
  const id = nextTermId++;
  const cwd = options.cwd || path.resolve(__dirname, '..', '..');
  const cols = options.cols || 80;
  const rows = options.rows || 24;

  const hostScript = path.join(__dirname, 'pty-host.py');

  const child = spawn('python3', [hostScript, cwd, String(cols), String(rows)], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'data' && mainWindow && !mainWindow.isDestroyed()) {
          const decoded = Buffer.from(msg.data, 'base64').toString();
          mainWindow.webContents.send('terminal:data', { id, data: decoded });
        } else if (msg.type === 'exit') {
          terminals.delete(id);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal:exit', { id, exitCode: msg.code });
          }
        }
      } catch {}
    }
  });

  child.stderr.on('data', (data) => {
    // Forward stderr as terminal output too (for error messages)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', { id, data: data.toString() });
    }
  });

  child.on('exit', () => {
    terminals.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', { id, exitCode: 0 });
    }
  });

  terminals.set(id, child);
  return id;
});

ipcMain.on('terminal:input', (event, { id, data }) => {
  const term = terminals.get(id);
  if (term && term.stdin.writable) {
    const msg = JSON.stringify({ type: 'input', data: Buffer.from(data).toString('base64') });
    term.stdin.write(msg + '\n');
  }
});

ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
  const term = terminals.get(id);
  if (term && term.stdin.writable) {
    const msg = JSON.stringify({ type: 'resize', cols, rows });
    term.stdin.write(msg + '\n');
  }
});

ipcMain.on('terminal:kill', (event, { id }) => {
  const term = terminals.get(id);
  if (term) {
    const msg = JSON.stringify({ type: 'kill' });
    try { term.stdin.write(msg + '\n'); } catch {}
    setTimeout(() => {
      try { term.kill('SIGTERM'); } catch {}
    }, 500);
    terminals.delete(id);
  }
});

// ── App lifecycle ────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  for (const [, term] of terminals) {
    try { term.kill('SIGTERM'); } catch {}
  }
  terminals.clear();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
