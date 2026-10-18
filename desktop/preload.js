const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  setMini: mini => ipcRenderer.send('set-mini', mini),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  getHotkey: () => ipcRenderer.invoke('get-hotkey'),
  setHotkey: accelerator => ipcRenderer.invoke('set-hotkey', accelerator),
});
