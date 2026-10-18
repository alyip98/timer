const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const hotkey = require('./hotkey');

const DEFAULT_HOTKEY = 'Ctrl+Alt+Shift+T';
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const loadSettings = () => { try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch { return {}; } };
const saveSettings = s => { try { fs.writeFileSync(settingsPath(), JSON.stringify(s)); } catch {} };
let shortcut;

const FULL = { width: 420, height: 640 };
const MINI = { width: 200, height: 56 };
let win;
let savedBounds = null;

function create() {
  win = new BrowserWindow({
    ...FULL,
    minWidth: 320,
    minHeight: 200,
    frame: false,
    backgroundColor: '#111827',
    icon: path.join(__dirname, 'app', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

ipcMain.on('set-mini', (_e, mini) => {
  if (!win) return;
  if (mini) {
    savedBounds = win.getBounds();
    win.setMinimumSize(MINI.width, MINI.height);
    win.setSize(MINI.width, MINI.height);
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces(false);
    win.setMinimumSize(320, 200);
    win.setBounds(savedBounds || { ...win.getBounds(), ...FULL });
  }
});
ipcMain.on('window-minimize', () => win && win.minimize());
ipcMain.on('window-close', () => win && win.close());

ipcMain.handle('get-hotkey', () => ({ accelerator: shortcut.current(), holdSupported: shortcut.holdSupported() }));
ipcMain.handle('set-hotkey', (_e, accelerator) => {
  const res = shortcut.set(accelerator);
  if (res.ok) saveSettings({ ...loadSettings(), hotkey: accelerator });
  return { ...res, holdSupported: shortcut.holdSupported() };
});

app.whenReady().then(() => {
  create();
  shortcut = hotkey.create({
    isVisible: () => win.isVisible(),
    show: () => { win.showInactive(); },
    hide: () => { win.hide(); },
  });
  const saved = loadSettings().hotkey || DEFAULT_HOTKEY;
  if (!shortcut.set(saved).ok) shortcut.set(DEFAULT_HOTKEY);
});
app.on('will-quit', () => shortcut && shortcut.dispose());
app.on('window-all-closed', () => app.quit());
