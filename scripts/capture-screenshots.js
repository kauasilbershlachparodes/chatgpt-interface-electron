const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const HOST = '127.0.0.1';
const PORT = 3211;
const ORIGIN = `http://${HOST}:${PORT}`;

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

const GUEST_STATE_JS = `
  (() => {
    localStorage.removeItem('matrix.session.v1');
    localStorage.removeItem('matrix.pending.v1');
    localStorage.removeItem('matrix_cookie_consent');
    localStorage.removeItem('matrix_cookie_preferences');
    localStorage.setItem('stage-slideover-sidebar-state', 'expanded');
    const expire = (name) => {
      document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax';
      document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Strict';
    };
    [
      'matrix_role',
      'matrix_gate',
      'matrix_email',
      'matrix_auth_provider',
      'matrix_cookie_consent',
      'stage_slideover_sidebar_state'
    ].forEach(expire);
    document.cookie = 'stage_slideover_sidebar_state=expanded; Max-Age=31536000; Path=/; SameSite=Lax';
  })();
`;

const AUTH_STATE_JS = `
  (() => {
    localStorage.removeItem('matrix_cookie_consent');
    localStorage.setItem('matrix_cookie_preferences', JSON.stringify({ analytics: true, marketing: true }));
    localStorage.setItem('stage-slideover-sidebar-state', 'expanded');
    if (window.MatrixSession && typeof window.MatrixSession.startAuthenticatedSession === 'function') {
      window.MatrixSession.startAuthenticatedSession({
        id: 'recruiter-demo-user',
        email: 'dr.parodesx@gmail.com',
        app_metadata: {
          provider: 'google',
          providers: ['google']
        },
        identities: [{ provider: 'google' }]
      }, { provider: 'google' });
    } else {
      localStorage.setItem('matrix.session.v1', JSON.stringify({
        role: 'authenticated',
        gate: 'allowed',
        email: 'dr.parodesx@gmail.com',
        authProvider: 'google',
        userId: 'recruiter-demo-user',
        createdAt: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
      }));
    }
    document.cookie = 'stage_slideover_sidebar_state=expanded; Max-Age=31536000; Path=/; SameSite=Lax';
    document.cookie = 'matrix_cookie_consent=accepted; Max-Age=15552000; Path=/; SameSite=Lax';
  })();
`;

let server = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveAppFilePath = (requestUrl = '/') => {
  const request = new URL(requestUrl, `${ORIGIN}/`);
  const relativePath = request.pathname === '/' ? '/login.html' : request.pathname;
  const safeRelativePath = relativePath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(ROOT, safeRelativePath);

  if (!resolvedPath.startsWith(ROOT)) {
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
};

const sendFile = (response, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';

  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      response.end('Unable to read the requested file.');
      return;
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': ORIGIN,
      'Cache-Control': 'no-store',
      'Content-Type': contentType,
    });
    response.end(fileBuffer);
  });
};

const ensureServer = () => {
  if (server) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const filePath = resolveAppFilePath(request.url || '/');
      if (!filePath) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        response.end('Not found.');
        return;
      }

      sendFile(response, filePath);
    });

    server.once('error', reject);
    server.listen(PORT, HOST, () => resolve());
  });
};

const waitForLoad = (windowInstance) => new Promise((resolve) => {
  windowInstance.webContents.once('did-finish-load', () => resolve());
});

const waitForUiIdle = async (windowInstance, ms = 900) => {
  await windowInstance.webContents.executeJavaScript(`
    new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, ${ms}));
    })
  `);
};

const loadPage = async (windowInstance, pagePath) => {
  const loadPromise = waitForLoad(windowInstance);
  await windowInstance.loadURL(`${ORIGIN}${pagePath}`);
  await loadPromise;
  await waitForUiIdle(windowInstance);
};

const reloadPage = async (windowInstance) => {
  const loadPromise = waitForLoad(windowInstance);
  windowInstance.webContents.reloadIgnoringCache();
  await loadPromise;
  await waitForUiIdle(windowInstance);
};

const setPageStateAndReload = async (windowInstance, stateScript) => {
  await windowInstance.webContents.executeJavaScript(stateScript);
  await reloadPage(windowInstance);
};

const createWindow = ({ width, height, mobile = false }) => {
  const windowInstance = new BrowserWindow({
    show: false,
    width,
    height,
    backgroundColor: '#202123',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (mobile) {
    windowInstance.webContents.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
  }

  return windowInstance;
};

const capture = async (windowInstance, fileName) => {
  await waitForUiIdle(windowInstance, 700);
  const image = await windowInstance.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, fileName), image.toPNG());
};

const captureLoginDesktop = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/login.html');
    await capture(windowInstance, 'login-desktop.png');
  } finally {
    await windowInstance.close();
  }
};

const captureIndexChatDesktop = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, AUTH_STATE_JS);
    await capture(windowInstance, 'index-chat-desktop.png');
  } finally {
    await windowInstance.close();
  }
};

const captureSidebarCollapsed = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, `${AUTH_STATE_JS}
      localStorage.setItem('stage-slideover-sidebar-state', 'collapsed');
      document.cookie = 'stage_slideover_sidebar_state=collapsed; Max-Age=31536000; Path=/; SameSite=Lax';
    `);
    await capture(windowInstance, 'index-sidebar-collapsed.png');
  } finally {
    await windowInstance.close();
  }
};

const captureSearchTooltip = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, `${AUTH_STATE_JS}
      if (window.MatrixSession && typeof window.MatrixSession.clearPendingAuth === 'function') {
        window.MatrixSession.clearPendingAuth();
      }
    `);
    await windowInstance.webContents.executeJavaScript(`
      (() => {
        const match = Array.from(document.querySelectorAll('[data-sidebar-item="true"] .truncate'))
          .find((node) => (node.textContent || '').trim() === 'Search chats');
        const item = match && match.closest('[data-sidebar-item="true"]');
        if (!item) {
          return false;
        }
        item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, view: window }));
        return true;
      })();
    `);
    await waitForUiIdle(windowInstance, 700);
    await capture(windowInstance, 'index-search-tooltip.png');
  } finally {
    await windowInstance.close();
  }
};

const captureNoAuthModal = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, `${GUEST_STATE_JS}
      localStorage.setItem('matrix_cookie_consent', 'accepted');
      document.cookie = 'matrix_cookie_consent=accepted; Max-Age=15552000; Path=/; SameSite=Lax';
    `);
    await windowInstance.webContents.executeJavaScript(`
      (() => {
        if (typeof window.openNoAuthLoginModal === 'function') {
          window.openNoAuthLoginModal('login', { collapseSidebar: true });
          return true;
        }
        return false;
      })();
    `);
    await waitForUiIdle(windowInstance, 800);
    await capture(windowInstance, 'index-no-auth-modal.png');
  } finally {
    await windowInstance.close();
  }
};

const captureCookieBanner = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, GUEST_STATE_JS);
    await capture(windowInstance, 'index-cookie-banner.png');
  } finally {
    await windowInstance.close();
  }
};

const captureCookiePreferences = async () => {
  const windowInstance = createWindow({ width: 1440, height: 980 });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, GUEST_STATE_JS);
    await windowInstance.webContents.executeJavaScript(`
      (() => {
        const button = document.getElementById('cookie-consent-manage');
        if (button) {
          button.click();
          return true;
        }
        return false;
      })();
    `);
    await waitForUiIdle(windowInstance, 800);
    await capture(windowInstance, 'index-cookie-preferences.png');
  } finally {
    await windowInstance.close();
  }
};

const captureMobile = async () => {
  const windowInstance = createWindow({ width: 430, height: 932, mobile: true });
  try {
    await loadPage(windowInstance, '/index.html');
    await setPageStateAndReload(windowInstance, `${AUTH_STATE_JS}
      localStorage.setItem('matrix_cookie_consent', 'accepted');
      document.cookie = 'matrix_cookie_consent=accepted; Max-Age=15552000; Path=/; SameSite=Lax';
    `);
    await capture(windowInstance, 'index-mobile.png');
  } finally {
    await windowInstance.close();
  }
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await ensureServer();

  await captureLoginDesktop();
  await captureIndexChatDesktop();
  await captureSidebarCollapsed();
  await captureSearchTooltip();
  await captureNoAuthModal();
  await captureCookieBanner();
  await captureCookiePreferences();
  await captureMobile();
};

app.whenReady()
  .then(main)
  .then(() => {
    if (server) {
      server.close();
      server = null;
    }
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    if (server) {
      server.close();
      server = null;
    }
    app.exit(1);
  });
