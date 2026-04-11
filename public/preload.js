const { contextBridge, ipcRenderer } = require('electron');

const authConfig = Object.freeze(ipcRenderer.sendSync('matrix:security:get-auth-config') || {});
const securityStatus = Object.freeze(ipcRenderer.sendSync('matrix:security:get-status') || {});

contextBridge.exposeInMainWorld('electronAPI', Object.freeze({
  version: process.versions.electron,
  authConfig,
  authStatus: Object.freeze({
    isConfigured: Boolean(authConfig && authConfig.isConfigured),
    loadedFrom: authConfig && typeof authConfig.loadedFrom === 'string' ? authConfig.loadedFrom : ''
  }),
  security: Object.freeze({
    encryptedAtRest: Boolean(securityStatus && securityStatus.encryptedAtRest),
    sealString: (value) => ipcRenderer.sendSync('matrix:security:seal-string', String(value ?? '')),
    openString: (value) => ipcRenderer.sendSync('matrix:security:open-string', String(value ?? ''))
  })
}));
