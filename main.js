const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    icon: path.join(__dirname, 'build/icon.ico'),
    title: 'ChatGPT',                    // ← Título que vai aparecer imediatamente
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile('index.html');

  // Remove o menu superior
  Menu.setApplicationMenu(null);

  // Atalho para DevTools (Ctrl + Shift + I)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Força o título assim que a página carregar (evita flash do nome do pacote)
  win.webContents.once('did-finish-load', () => {
    win.setTitle('ChatGPT');   // ou o nome que você quiser
  });

  // === SOLUÇÃO PARA O ÍCONE NAS JANELAS ABERTAS PELO SITE ===
  win.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        icon: path.join(__dirname, 'build/icon.ico'),
        title: 'ChatGPT',                    // também define título nas janelas secundárias
        fullscreen: false,
      }
    };
  });
}

// ====================== APLICAÇÃO PRINCIPAL ======================

app.whenReady().then(() => {
  createWindow();

  // Backup: força o ícone e título em TODAS as janelas criadas
  app.on('browser-window-created', (event, newWindow) => {
    const iconPath = path.join(__dirname, 'build/icon.ico');
    
    if (newWindow.setIcon) newWindow.setIcon(iconPath);
    if (newWindow.setTitle) newWindow.setTitle('ChatGPT');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});