const { app, BrowserWindow, Menu, session, shell, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const APP_HOST = '127.0.0.1';
const APP_PORT = 3210;
const APP_ORIGIN = `http://${APP_HOST}:${APP_PORT}`;
const CONFIG_FILE_NAMES = ['auth.config.json', 'matrix-auth.config.json'];
const KEY_FILE_NAME = 'matrix-secure-store.key';
const MAX_CONFIG_FILE_BYTES = 32 * 1024;
const MAX_IPC_STRING_BYTES = 64 * 1024;
const MAX_REQUEST_URL_LENGTH = 2048;

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
let cachedEncryptionKey = null;

function resolveRouteAlias(pathname = '/') {
  if (pathname === '/' || pathname === '/login.html') {
    return '/index.html';
  }
  return pathname;
}

function resolveAppFilePath(requestUrl = '/') {
  const request = new URL(requestUrl, `${APP_ORIGIN}/`);
  const relativePath = resolveRouteAlias(request.pathname || '/');
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
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Content-Security-Policy': "default-src 'self' data: blob: https:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https:;",
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
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
      const requestMethod = String(request.method || 'GET').toUpperCase();
      if (requestMethod !== 'GET' && requestMethod != 'HEAD') {
        response.writeHead(405, { 'Content-Type': 'text/plain; charset=UTF-8', 'Allow': 'GET, HEAD' });
        response.end('Method not allowed.');
        return;
      }

      const requestUrl = String(request.url || '/');
      if (!requestUrl || requestUrl.length > MAX_REQUEST_URL_LENGTH) {
        response.writeHead(414, { 'Content-Type': 'text/plain; charset=UTF-8' });
        response.end('Request URL is too long.');
        return;
      }

      const filePath = resolveAppFilePath(requestUrl);
      if (!filePath) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        response.end('Not found.');
        return;
      }

      if (requestMethod === 'HEAD') {
        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';
        response.writeHead(200, {
          'Access-Control-Allow-Origin': APP_ORIGIN,
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          'Pragma': 'no-cache',
          'Content-Security-Policy': "default-src 'self' data: blob: https:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https:;",
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Resource-Policy': 'same-origin',
          'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          'Content-Type': contentType,
        });
        response.end();
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

function getWindowIconPath() {
  const candidate = path.join(__dirname, 'build/icon.ico');
  return fs.existsSync(candidate) ? candidate : undefined;
}

function buildWindowOptions(parent = null) {
  return {
    icon: getWindowIconPath(),
    title: 'ChatGPT',
    fullscreen: parent ? false : true,
    width: parent ? 520 : undefined,
    height: parent ? 720 : undefined,
    minWidth: parent ? 460 : undefined,
    minHeight: parent ? 620 : undefined,
    autoHideMenuBar: true,
    modal: Boolean(parent),
    parent: parent || undefined,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: process.env.ELECTRON_DEVTOOLS === '1',
      safeDialogs: true
    }
  };
}

function isSameOriginAppUrl(rawUrl = '') {
  try {
    return new URL(rawUrl).origin === APP_ORIGIN;
  } catch (_error) {
    return false;
  }
}

function isSafeExternalUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch (_error) {
    return false;
  }
}

function openSafeExternal(rawUrl = '') {
  if (!isSafeExternalUrl(rawUrl)) {
    return false;
  }

  shell.openExternal(rawUrl);
  return true;
}

function hardenWebContents(webContents, { allowExternalTopLevelNavigation = false } = {}) {
  webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isSameOriginAppUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: buildWindowOptions(BrowserWindow.fromWebContents(webContents) || null)
      };
    }

    openSafeExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (isSameOriginAppUrl(url)) {
      return;
    }

    if (allowExternalTopLevelNavigation) {
      return;
    }

    event.preventDefault();
    openSafeExternal(url);
  });

  webContents.on('will-redirect', (event, url) => {
    if (isSameOriginAppUrl(url)) {
      return;
    }

    if (allowExternalTopLevelNavigation) {
      return;
    }

    event.preventDefault();
    openSafeExternal(url);
  });
}

function resolveWritableAppDir() {
  try {
    return app.getPath('userData');
  } catch (_error) {
    const appDataRoot =
      process.env.APPDATA ||
      process.env.XDG_CONFIG_HOME ||
      path.join(os.homedir(), '.config');
    return path.join(appDataRoot, 'ChatGPTInterface');
  }
}

function ensureAppDir() {
  const target = resolveWritableAppDir();
  try {
    fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  } catch (_error) {
    // noop
  }
  return target;
}

function readJsonFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_CONFIG_FILE_BYTES) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function getAuthConfigCandidatePaths() {
  const appDataDir = ensureAppDir();
  const executableDir = path.dirname(process.execPath || '');
  const resourcesDir = process.resourcesPath || '';
  const candidateDirs = [
    process.cwd(),
    __dirname,
    executableDir,
    resourcesDir,
    appDataDir
  ].filter(Boolean);

  const dedupedDirs = Array.from(new Set(candidateDirs.map((value) => path.resolve(value))));
  return dedupedDirs.flatMap((dirPath) => CONFIG_FILE_NAMES.map((fileName) => path.join(dirPath, fileName)));
}

function loadExternalAuthConfig() {
  const candidatePaths = getAuthConfigCandidatePaths();

  for (const filePath of candidatePaths) {
    const parsed = readJsonFile(filePath);
    if (parsed && typeof parsed === 'object') {
      return { ...parsed, __loadedFrom: filePath };
    }
  }

  return { __loadedFrom: '' };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isSafeSupabaseUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1');
  } catch (_error) {
    return false;
  }
}

function normalizeAuthConfig(raw = {}) {
  const normalizedUrl = String(raw.supabaseUrl || '').trim();
  const normalizedAnonKey = String(raw.anonKey || raw.supabaseKey || '').trim();

  return {
    supabaseUrl: isSafeSupabaseUrl(normalizedUrl) ? normalizedUrl : '',
    anonKey: normalizedAnonKey && normalizedAnonKey.length <= 4096 ? normalizedAnonKey : '',
    otpLength: parsePositiveInteger(raw.otpLength, 6),
    emailMaxLength: parsePositiveInteger(raw.emailMaxLength, 254),
    passwordMaxLength: parsePositiveInteger(raw.passwordMaxLength, 72),
    loadedFrom: typeof raw.__loadedFrom === 'string' ? raw.__loadedFrom : ''
  };
}

function getAuthConfig() {
  const externalAuthConfig = normalizeAuthConfig(loadExternalAuthConfig());
  const envSupabaseUrl = String(process.env.MATRIX_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const envAnonKey = String(process.env.MATRIX_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  const supabaseUrl = isSafeSupabaseUrl(envSupabaseUrl)
    ? envSupabaseUrl
    : externalAuthConfig.supabaseUrl;
  const anonKey = envAnonKey && envAnonKey.length <= 4096
    ? envAnonKey
    : externalAuthConfig.anonKey;

  return {
    supabaseUrl,
    anonKey,
    otpLength: parsePositiveInteger(
      process.env.MATRIX_AUTH_OTP_LENGTH ?? externalAuthConfig.otpLength,
      6
    ),
    emailMaxLength: parsePositiveInteger(
      process.env.MATRIX_AUTH_EMAIL_MAX_LENGTH ?? externalAuthConfig.emailMaxLength,
      254
    ),
    passwordMaxLength: parsePositiveInteger(
      process.env.MATRIX_AUTH_PASSWORD_MAX_LENGTH ?? externalAuthConfig.passwordMaxLength,
      72
    ),
    isConfigured: Boolean(supabaseUrl && anonKey),
    loadedFrom: externalAuthConfig.loadedFrom || ''
  };
}

function loadOrCreateEncryptionKey() {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  const keyPath = path.join(ensureAppDir(), KEY_FILE_NAME);

  try {
    if (fs.existsSync(keyPath)) {
      const existing = fs.readFileSync(keyPath, 'utf8').trim();
      if (/^[a-f0-9]{64}$/i.test(existing)) {
        cachedEncryptionKey = Buffer.from(existing, 'hex');
        return cachedEncryptionKey;
      }
    }

    cachedEncryptionKey = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, cachedEncryptionKey.toString('hex'), { mode: 0o600 });
    return cachedEncryptionKey;
  } catch (_error) {
    cachedEncryptionKey = null;
    return null;
  }
}

function sealString(value) {
  const key = loadOrCreateEncryptionKey();
  if (!key || typeof value !== 'string') {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function openString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  if (!value.startsWith('enc:v1:')) {
    return value;
  }

  const key = loadOrCreateEncryptionKey();
  if (!key) {
    throw new Error('Encrypted storage is not available.');
  }

  const payload = value.slice('enc:v1:'.length);
  const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Encrypted payload is malformed.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivEncoded, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

function getUtf8ByteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

function normalizeIpcStringInput(value) {
  const normalized = String(value ?? '');
  return getUtf8ByteLength(normalized) <= MAX_IPC_STRING_BYTES ? normalized : '';
}

function isTrustedSenderUrl(rawUrl = '') {
  if (rawUrl === 'about:blank') {
    return true;
  }

  try {
    const parsed = new URL(rawUrl);
    return parsed.origin === APP_ORIGIN;
  } catch (_error) {
    return false;
  }
}

function isTrustedIpcEvent(event) {
  const senderFrameUrl = event && event.senderFrame && typeof event.senderFrame.url === 'string'
    ? event.senderFrame.url
    : '';
  const senderUrl = event && event.sender && typeof event.sender.getURL === 'function'
    ? event.sender.getURL()
    : '';

  return isTrustedSenderUrl(senderFrameUrl || senderUrl);
}

function signString(value) {
  const key = loadOrCreateEncryptionKey();
  if (!key || typeof value !== 'string') {
    return '';
  }

  return crypto.createHmac('sha256', key).update(value, 'utf8').digest('base64url');
}

function verifySignedString(value, signature) {
  const normalizedValue = typeof value === 'string' ? value : '';
  const normalizedSignature = typeof signature === 'string' ? signature.trim() : '';
  if (!normalizedValue || !normalizedSignature) {
    return false;
  }

  try {
    const expected = Buffer.from(signString(normalizedValue), 'utf8');
    const actual = Buffer.from(normalizedSignature, 'utf8');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_error) {
    return false;
  }
}

function registerIpcHandlers() {
  ipcMain.on('matrix:security:get-auth-config', (event) => {
    if (!isTrustedIpcEvent(event)) {
      event.returnValue = { supabaseUrl: '', anonKey: '', otpLength: 6, emailMaxLength: 254, passwordMaxLength: 72, isConfigured: false, loadedFrom: '' };
      return;
    }

    event.returnValue = getAuthConfig();
  });

  ipcMain.on('matrix:security:get-status', (event) => {
    if (!isTrustedIpcEvent(event)) {
      event.returnValue = { encryptedAtRest: false };
      return;
    }

    event.returnValue = {
      encryptedAtRest: Boolean(loadOrCreateEncryptionKey())
    };
  });

  ipcMain.on('matrix:security:seal-string', (event, value) => {
    if (!isTrustedIpcEvent(event)) {
      event.returnValue = '';
      return;
    }

    try {
      const normalized = normalizeIpcStringInput(value);
      event.returnValue = normalized ? sealString(normalized) : '';
    } catch (_error) {
      event.returnValue = '';
    }
  });

  ipcMain.on('matrix:security:open-string', (event, value) => {
    if (!isTrustedIpcEvent(event)) {
      event.returnValue = '';
      return;
    }

    try {
      const normalized = normalizeIpcStringInput(value);
      event.returnValue = normalized ? openString(normalized) : '';
    } catch (_error) {
      event.returnValue = '';
    }
  });

  ipcMain.on('matrix:security:sign-string', (event, value) => {
    if (!isTrustedIpcEvent(event)) {
      event.returnValue = '';
      return;
    }

    try {
      const normalized = normalizeIpcStringInput(value);
      event.returnValue = normalized ? signString(normalized) : '';
    } catch (_error) {
      event.returnValue = '';
    }
  });

  ipcMain.on('matrix:security:verify-signed-string', (event, value, signature) => {
    if (!isTrustedIpcEvent(event)) {
      event.returnValue = false;
      return;
    }

    try {
      const normalizedValue = normalizeIpcStringInput(value);
      const normalizedSignature = normalizeIpcStringInput(signature);
      event.returnValue = Boolean(normalizedValue && normalizedSignature && verifySignedString(normalizedValue, normalizedSignature));
    } catch (_error) {
      event.returnValue = false;
    }
  });
}

async function createWindow() {
  await ensureStaticServer();

  const win = new BrowserWindow(buildWindowOptions());

  hardenWebContents(win.webContents, { allowExternalTopLevelNavigation: false });
  win.loadURL(`${APP_ORIGIN}/index.html`);

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

  return win;
}

app.whenReady().then(() => {
  registerIpcHandlers();

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow().catch((error) => {
    console.error('Failed to create the main window:', error);
    app.quit();
  });

  app.on('browser-window-created', (_event, newWindow) => {
    const iconPath = getWindowIconPath();
    if (iconPath && newWindow.setIcon) newWindow.setIcon(iconPath);
    if (newWindow.setTitle) newWindow.setTitle('ChatGPT');

    const parent = newWindow.getParentWindow();
    hardenWebContents(newWindow.webContents, {
      allowExternalTopLevelNavigation: Boolean(parent)
    });
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
