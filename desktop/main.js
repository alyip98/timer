const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
