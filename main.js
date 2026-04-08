const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    icon: path.join(__dirname, 'build/icon.ico'),
    title: 'ChatGPT',
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile('login.html');

  Menu.setApplicationMenu(null);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.webContents.once('did-finish-load', () => {
    win.setTitle('ChatGPT');
  });

  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      icon: path.join(__dirname, 'build/icon.ico'),
      title: 'ChatGPT',
      fullscreen: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      }
    }
  }));
}

app.whenReady().then(() => {
  createWindow();

  app.on('browser-window-created', (_event, newWindow) => {
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
