const { app, BrowserWindow, Menu } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const APP_HOST = '127.0.0.1';
const APP_PORT = 3210;
const APP_ORIGIN = `http://${APP_HOST}:${APP_PORT}`;

const MIME_TYPES = {
  '.css': 'text/css; charset=UTF-8',
  '.html': 'text/html; charset=UTF-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=UTF-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

let staticServer = null;

function resolveAppFilePath(requestUrl = '/') {
  const request = new URL(requestUrl, `${APP_ORIGIN}/`);
  const relativePath = request.pathname === '/' ? '/login.html' : request.pathname;
  const safeRelativePath = relativePath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(__dirname, safeRelativePath);
  const appRoot = path.resolve(__dirname);

  if (!resolvedPath.startsWith(appRoot)) {
    return null;
  }

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  if (fs.statSync(resolvedPath).isDirectory()) {
    const directoryIndex = path.join(resolvedPath, 'index.html');
    return fs.existsSync(directoryIndex) ? directoryIndex : null;
  }

  return resolvedPath;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';

  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      response.end('Unable to read the requested file.');
      return;
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': APP_ORIGIN,
      'Cache-Control': 'no-store',
      'Content-Type': contentType,
    });
    response.end(fileBuffer);
  });
}

function ensureStaticServer() {
  if (staticServer) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    staticServer = http.createServer((request, response) => {
      const filePath = resolveAppFilePath(request.url || '/');
      if (!filePath) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        response.end('Not found.');
        return;
      }

      sendFile(response, filePath);
    });

    staticServer.once('error', (error) => {
      staticServer = null;
      reject(error);
    });

    staticServer.listen(APP_PORT, APP_HOST, () => resolve());
  });
}

async function createWindow() {
  await ensureStaticServer();

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

  win.loadURL(`${APP_ORIGIN}/login.html`);

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
  createWindow().catch((error) => {
    console.error('Failed to create the main window:', error);
    app.quit();
  });

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
    if (staticServer) {
      staticServer.close();
      staticServer = null;
    }
    app.quit();
  }
});
