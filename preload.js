const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // You can add safe APIs here later (e.g. ipcRenderer)
  version: process.versions.electron
});