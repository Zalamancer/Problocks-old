const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:input', { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.send('terminal:kill', { id }),
  onTerminalData: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onTerminalExit: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },

  // Project root — fetched from main process to avoid require('path') in sandbox
  getProjectRoot: () => ipcRenderer.invoke('app:projectRoot'),

  // Platform info
  platform: process.platform,
  isDesktop: true,
});
