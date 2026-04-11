(() => {
        const root = document.getElementById('modal-no-auth-login');
        if (!(root instanceof HTMLElement)) {
          return;
        }

        const dragHost = document.getElementById('no-auth-login-drag-host');
        const dialog = root.querySelector('[role="dialog"]');
        const header = dialog?.querySelector('header');
        const closeButton = root.querySelector('[data-testid="close-button"]');
        const emailInput = root.querySelector('input[type="email"][name="email"]');
        const googleButton = document.getElementById('no-auth-modal-google');
        const appleButton = document.getElementById('no-auth-modal-apple');
        const phoneButton = document.getElementById('no-auth-modal-phone');
        const form = document.getElementById('no-auth-login-form');
        const sidebar = document.getElementById('stage-slideover-sidebar');
        const sidebarCloseButton = document.querySelector('[data-testid="close-sidebar-button"][aria-controls="stage-slideover-sidebar"]');
                const mobileModalQuery = window.matchMedia('(max-width: 767px)');
        let activeMode = 'login';
        let dragStartX = 0;
        let dragStartY = 0;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let dragPeakOffsetX = 0;
        let dragPeakOffsetY = 0;
        let dragLastX = 0;
        let dragLastY = 0;
        let dragLastTime = 0;
        let dragVelocityX = 0;
        let dragVelocityY = 0;
        let dragAxis = '';
        let dragStartZone = '';
        let dragDiagonalSlope = 0;
        let isDraggingModal = false;

        const sanitizeEmail = (value) => String(value || '').trim().toLowerCase();

        const stopModalDragTracking = () => {
          isDraggingModal = false;
          document.body.style.userSelect = '';
        };

        const resetDialogDragState = () => {
          if (!(dragHost instanceof HTMLElement)) {
            return;
          }

          dragStartX = 0;
          dragStartY = 0;
          dragOffsetX = 0;
          dragOffsetY = 0;
          dragPeakOffsetX = 0;
          dragPeakOffsetY = 0;
          dragLastX = 0;
          dragLastY = 0;
          dragVelocityX = 0;
          dragLastTime = 0;
          dragVelocityY = 0;
          dragAxis = '';
          dragStartZone = '';
          dragDiagonalSlope = 0;
          stopModalDragTracking();
          dragHost.style.transform = '';
          dragHost.style.transition = '';
          dragHost.style.willChange = '';
        };

        const setDragHostOffset = (offsetX, offsetY) => {
          if (!(dragHost instanceof HTMLElement)) {
            return;
          }

          dragHost.style.transform = `translate3d(${Math.round(offsetX)}px, ${Math.round(offsetY)}px, 0)`;
        };

        const applyDialogDragOffset = (offsetX, offsetY) => {
          dragOffsetX = Math.round(offsetX);
          dragOffsetY = Math.round(offsetY);
          dragPeakOffsetX = Math.max(dragPeakOffsetX, Math.abs(dragOffsetX));
          dragPeakOffsetY = Math.max(dragPeakOffsetY, Math.abs(dragOffsetY));
          setDragHostOffset(dragOffsetX, dragOffsetY);
        };

        const animateDragHost = (targetX, targetY, duration, onDone) => {
          if (!(dragHost instanceof HTMLElement)) {
            onDone?.();
            return;
          }

          const nextX = Math.round(targetX);
          const nextY = Math.round(targetY);
          let finished = false;
          let fallbackTimer = 0;

          const cleanup = () => {
            dragHost.removeEventListener('transitionend', handleTransitionEnd);
            if (fallbackTimer) {
              window.clearTimeout(fallbackTimer);
            }
            dragHost.style.willChange = '';
          };

          const complete = () => {
            if (finished) {
              return;
            }

            finished = true;
            cleanup();
            onDone?.();
          };

          const handleTransitionEnd = (event) => {
            if (event.target !== dragHost || event.propertyName !== 'transform') {
              return;
            }

            complete();
          };

          dragHost.style.willChange = 'transform';
          dragHost.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
          void dragHost.offsetWidth;
          dragHost.addEventListener('transitionend', handleTransitionEnd);
          window.requestAnimationFrame(() => {
            setDragHostOffset(nextX, nextY);
          });
          fallbackTimer = window.setTimeout(complete, duration + 160);
        };

        const startModalDrag = (clientX, clientY, zone = '') => {
          if (!(dragHost instanceof HTMLElement)) {
            return;
          }

          dragStartX = clientX;
          dragStartY = clientY;
          dragOffsetX = 0;
          dragOffsetY = 0;
          dragPeakOffsetX = 0;
          dragPeakOffsetY = 0;
          dragLastX = clientX;
          dragLastY = clientY;
          dragVelocityX = 0;
          dragLastTime = performance.now();
          dragVelocityY = 0;
          dragAxis = '';
          dragStartZone = zone;
          dragDiagonalSlope = 0;
          isDraggingModal = true;
          dragHost.style.transition = 'none';
          dragHost.style.willChange = 'transform';
          document.body.style.userSelect = 'none';
        };

        const updateModalDrag = (clientX, clientY) => {
          if (!isDraggingModal || !(dialog instanceof HTMLElement)) {
            return;
          }

          const now = performance.now();
          const deltaX = clientX - dragLastX;
          const deltaY = clientY - dragLastY;
          const deltaTime = Math.max(1, now - dragLastTime);
          dragVelocityX = deltaX / deltaTime;
          dragVelocityY = deltaY / deltaTime;
          dragLastX = clientX;
          dragLastY = clientY;
          dragLastTime = now;

          const nextOffsetX = clientX - dragStartX;
          const nextOffsetY = clientY - dragStartY;
          const lockThreshold = 12;
          const absOffsetX = Math.abs(nextOffsetX);
          const absOffsetY = Math.abs(nextOffsetY);

          if (!dragAxis) {
            if (Math.max(absOffsetX, absOffsetY) < lockThreshold) {
              applyDialogDragOffset(0, 0);
              return;
            }

            const diagonalRatio = Math.min(absOffsetX, absOffsetY) / Math.max(absOffsetX, absOffsetY);
            dragAxis = diagonalRatio >= 0.52 ? 'diag' : absOffsetX > absOffsetY ? 'x' : 'y';
            if (dragAxis === 'diag') {
              dragDiagonalSlope = nextOffsetX * nextOffsetY >= 0 ? 1 : -1;
            }
          }

          if (dragAxis === 'x') {
            applyDialogDragOffset(nextOffsetX, 0);
            return;
          }

          if (dragAxis === 'diag') {
            if (!dragDiagonalSlope) {
              dragDiagonalSlope = nextOffsetX * nextOffsetY >= 0 ? 1 : -1;
            }

            const diagonalProjection = Math.round((nextOffsetX + (dragDiagonalSlope * nextOffsetY)) / 2);
            const diagonalOffsetX = diagonalProjection;
            const diagonalOffsetYRaw = dragDiagonalSlope * diagonalProjection;
            const diagonalOffsetY = diagonalOffsetYRaw < 0 && dragStartZone !== 'bottom'
              ? Math.round(diagonalOffsetYRaw * 0.42)
              : diagonalOffsetYRaw;

            applyDialogDragOffset(diagonalOffsetX, diagonalOffsetY);
            return;
          }

          const resistedOffsetY = nextOffsetY < 0 && dragStartZone !== 'bottom'
            ? Math.round(nextOffsetY * 0.42)
            : nextOffsetY;

          applyDialogDragOffset(0, resistedOffsetY);
        };

        const closeDraggedModal = (direction) => {
          if (!(dialog instanceof HTMLElement)) {
            closeModal();
            return;
          }

          stopModalDragTracking();

          const closeAnimationMs = 420;
          const dialogWidth = dialog.getBoundingClientRect().width;
          const dialogHeight = dialog.getBoundingClientRect().height;
          const closingOffsetX = direction.includes('left')
            ? -(window.innerWidth + dialogWidth + 72)
            : direction.includes('right')
              ? window.innerWidth + dialogWidth + 72
              : 0;
          const closingOffsetY = direction.includes('up')
            ? -(window.innerHeight + dialogHeight + 96)
            : direction.includes('down')
              ? window.innerHeight + dialogHeight + 96
              : 0;

          animateDragHost(closingOffsetX, closingOffsetY, closeAnimationMs, closeModal);
        };

        const setPendingAuth = (mode, email = '') => {
          const normalizedMode = mode === 'signup' ? 'signup' : 'login';
          const normalizedEmail = sanitizeEmail(email);
          const matrix = window.MatrixSession;

          if (matrix && typeof matrix.setPendingAuth === 'function') {
            try {
              matrix.setPendingAuth({
                mode: normalizedMode,
                email: normalizedEmail,
              });
              return;
            } catch (_error) {
              // fall through to legacy storage write
            }
          }

          try {
            window.localStorage.setItem(
              'matrix.pending.v1',
              JSON.stringify({
                mode: normalizedMode,
                email: normalizedEmail,
                createdAt: Date.now(),
              }),
            );
          } catch (_error) {
            // noop
          }
        };

        const collapseSidebarIfNeeded = () => {
          if (!(sidebar instanceof HTMLElement) || !(sidebarCloseButton instanceof HTMLElement)) {
            return;
          }

          const isMobileOpen = sidebar.dataset.sidebarMode === 'mobile' && sidebar.dataset.sidebarState === 'expanded';
          const isDesktopExpanded =
            document.documentElement.getAttribute('data-sidebar-desktop-state') !== 'collapsed' &&
            sidebar.dataset.sidebarMode !== 'mobile';

          if (isMobileOpen || isDesktopExpanded) {
            sidebarCloseButton.click();
          }
        };

        const openModal = (mode = 'login', options = {}) => {
          activeMode = mode === 'signup' ? 'signup' : 'login';

          if (options.collapseSidebar) {
            collapseSidebarIfNeeded();
          }

          resetDialogDragState();
          root.hidden = false;
          window.requestAnimationFrame(() => {
            if (emailInput instanceof HTMLElement) {
              emailInput.focus({ preventScroll: true });
            } else if (dialog instanceof HTMLElement) {
              dialog.focus({ preventScroll: true });
            }
          });
        };

        window.openNoAuthLoginModal = (mode = 'login', options = {}) => {
          openModal(mode, options);
        };

        const closeModal = () => {
          resetDialogDragState();
          root.hidden = true;
        };

        const continueWithEmail = (event) => {
          event.preventDefault();
          const email = sanitizeEmail(emailInput instanceof HTMLInputElement ? emailInput.value : '');

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (emailInput instanceof HTMLInputElement) {
              emailInput.focus({ preventScroll: true });
              emailInput.reportValidity?.();
            }
            return;
          }

          setPendingAuth(activeMode, email);
          window.location.href = `log-in-or-create-account.html?mode=${activeMode}`;
        };

        const OAUTH_POPUP_STORAGE_KEY = 'matrix.oauth.popup.result';
        const OAUTH_POPUP_NAME = 'matrix-google-auth-popup';
        const DEFAULT_PROJECT_URL = 'https://xkkrbnxqtrfjzbasvocz.supabase.co';
        const DEFAULT_ANON_KEY = 'sb_publishable_MhEwBmkNjTFAMSZniI5XzQ_45tNsIYX';

        const getOAuthPopupFeatures = () => {
          const popupWidth = 520;
          const popupHeight = 720;
          const popupLeft = Math.max(0, Math.round(window.screenX + ((window.outerWidth - popupWidth) / 2)));
          const popupTop = Math.max(0, Math.round(window.screenY + ((window.outerHeight - popupHeight) / 2)));
          return [
            'popup=yes',
            'toolbar=no',
            'menubar=no',
            'location=yes',
            'status=no',
            'resizable=yes',
            'scrollbars=yes',
            `width=${popupWidth}`,
            `height=${popupHeight}`,
            `left=${popupLeft}`,
            `top=${popupTop}`,
          ].join(',');
        };

        const isSafeSupabaseUrl = (value) => {
          try {
            const parsed = new URL(String(value || '').trim());
            return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && /^127\.0\.0\.1$|^localhost$/i.test(parsed.hostname));
          } catch (_error) {
            return false;
          }
        };

        const getAuthConfig = () => {
          const bridgeConfig = window.electronAPI && window.electronAPI.authConfig ? window.electronAPI.authConfig : {};
          const inlineConfig = window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {};
          const supabaseUrl = bridgeConfig.supabaseUrl || inlineConfig.supabaseUrl || DEFAULT_PROJECT_URL;
          const anonKey = bridgeConfig.anonKey || bridgeConfig.supabaseKey || inlineConfig.anonKey || inlineConfig.supabaseKey || DEFAULT_ANON_KEY;
          return {
            supabaseUrl: isSafeSupabaseUrl(supabaseUrl) ? supabaseUrl : '',
            anonKey: typeof anonKey === 'string' && anonKey.length <= 4096 ? anonKey : '',
          };
        };

        const buildOAuthStarterFallbackUrl = (mode = 'login') => {
          const normalizedMode = mode === 'signup' ? 'signup' : 'login';
          const helperUrl = new URL('google-oauth-start.html', window.location.href);
          helperUrl.searchParams.set('mode', normalizedMode);
          helperUrl.searchParams.set('provider', 'google');
          helperUrl.searchParams.set('popup', '1');
          return helperUrl.toString();
        };

        const buildGoogleOAuthStarterDocument = (mode = 'login') => {
          const normalizedMode = mode === 'signup' ? 'signup' : 'login';
          const { supabaseUrl, anonKey } = getAuthConfig();
          const callbackUrl = `${window.location.origin}/auth/callback.html`;
          const escapedSupabaseUrl = JSON.stringify(supabaseUrl);
          const escapedAnonKey = JSON.stringify(anonKey);
          const escapedMode = JSON.stringify(normalizedMode);
          const escapedCallbackUrl = JSON.stringify(callbackUrl);

          return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connecting to Google…</title>
    <style>
      :root { color-scheme: dark; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f0f10;
        color: #f5f5f5;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: grid;
        place-items: center;
      }
      .card {
        width: min(420px, calc(100vw - 32px));
        padding: 24px 22px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        background: #171717;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
      }
      .title {
        margin: 0 0 10px;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.35;
      }
      .text {
        margin: 0;
        color: rgba(255, 255, 255, 0.74);
        font-size: 14px;
        line-height: 1.5;
      }
      .spinner {
        width: 30px;
        height: 30px;
        margin: 0 0 16px;
        border-radius: 999px;
        border: 3px solid rgba(255, 255, 255, 0.14);
        border-top-color: #1a73e8;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .error { color: #fda4af; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner" aria-hidden="true"></div>
      <h1 class="title">Opening Google sign-in…</h1>
      <p class="text" id="oauth-start-status">Please wait a moment.</p>
    </div>
    <script>
      (() => {
        const statusNode = document.getElementById('oauth-start-status');
        const setStatus = (message, isError = false) => {
          if (!statusNode) return;
          statusNode.textContent = message;
          statusNode.classList.toggle('error', Boolean(isError));
        };

        const loadScript = (src) => new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Unable to load ' + src));
          document.head.appendChild(script);
        });

        const ensureSupabase = async () => {
          if (window.supabase && typeof window.supabase.createClient === 'function') {
            return window.supabase;
          }

          const sources = [
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
          ];

          let lastError = null;
          for (const src of sources) {
            try {
              await loadScript(src);
              if (window.supabase && typeof window.supabase.createClient === 'function') {
                return window.supabase;
              }
            } catch (error) {
              lastError = error;
            }
          }

          throw lastError || new Error('Supabase browser client is not available.');
        };

        const start = async () => {
          try {
            const supabaseModule = await ensureSupabase();
            const client = supabaseModule.createClient(${escapedSupabaseUrl}, ${escapedAnonKey}, {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                flowType: 'pkce',
              },
            });

            const { data, error } = await client.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: ${escapedCallbackUrl},
                skipBrowserRedirect: true,
                queryParams: {
                  access_type: 'offline',
                  prompt: 'select_account',
                },
              },
            });

            if (error) throw error;
            if (!data || !data.url) {
              throw new Error('Supabase did not return a Google sign-in URL.');
            }

            window.location.replace(data.url);
          } catch (error) {
            setStatus(error && error.message ? error.message : 'Unable to open Google sign-in.', true);
          }
        };

        window.name = 'matrix-google-auth-popup';
        window.__matrixOauthStartMode = ${escapedMode};
        start();
      })();
    <\/script>
  </body>
</html>`;
        };

        const getOAuthPopupMessageVerifier = () => (
          window.electronAPI && window.electronAPI.security && typeof window.electronAPI.security.verifySignedString === 'function'
            ? window.electronAPI.security.verifySignedString
            : null
        );

        const normalizeSessionSnapshot = (value = {}) => {
          if (!value || typeof value !== 'object') return null;

          const role = value.role === 'authenticated' ? 'authenticated' : value.role === 'guest' ? 'guest' : '';
          const gate = value.gate === 'allowed' ? 'allowed' : '';
          const sessionId = String(value.sessionId || '').trim().slice(0, 96);
          const createdAt = Number(value.createdAt || 0);
          const expiresAt = Number(value.expiresAt || 0);

          if (!role || !gate || !sessionId || !Number.isFinite(createdAt) || createdAt <= 0 || !Number.isFinite(expiresAt) || expiresAt <= 0) {
            return null;
          }

          return {
            role,
            gate,
            sessionId,
            email: typeof value.email === 'string' ? value.email.trim().toLowerCase().slice(0, 254) : '',
            authProvider: value.authProvider === 'google' ? 'google' : value.authProvider === 'email' ? 'email' : '',
            userId: typeof value.userId === 'string' ? value.userId.trim().slice(0, 128) : '',
            displayName: typeof value.displayName === 'string' ? value.displayName.trim().slice(0, 120) : '',
            avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl.trim().slice(0, 2048) : '',
            initials: typeof value.initials === 'string' ? value.initials.trim().slice(0, 4).toUpperCase() : '',
            planLabel: typeof value.planLabel === 'string' ? value.planLabel.trim().slice(0, 40) : 'Free',
            createdAt,
            expiresAt
          };
        };

        const normalizeOAuthPopupPayload = (payload = {}) => {
          if (!payload || typeof payload !== 'object') return null;
          const type = String(payload.type || '').trim();
          const provider = String(payload.provider || '').trim().toLowerCase();
          if (!/^matrix:oauth:(complete|error)$/.test(type) || provider !== 'google') {
            return null;
          }

          const normalized = {
            type,
            provider,
            ts: Number(payload.ts || 0) || 0,
          };

          if (typeof payload.email === 'string' && payload.email.trim()) {
            normalized.email = payload.email.trim().toLowerCase().slice(0, 254);
          }

          if (typeof payload.message === 'string' && payload.message.trim()) {
            normalized.message = payload.message.trim().slice(0, 300);
          }

          const sessionSnapshot = normalizeSessionSnapshot(payload.sessionSnapshot);
          if (sessionSnapshot) {
            normalized.sessionSnapshot = sessionSnapshot;
          }

          return normalized;
        };

        const parseOAuthPopupPayload = (rawValue) => {
          if (!rawValue) return null;

          try {
            const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            if (!parsed || typeof parsed !== 'object') return null;

            if (typeof parsed.payload === 'string' && typeof parsed.signature === 'string') {
              const verifySignedString = getOAuthPopupMessageVerifier();
              if (verifySignedString && !verifySignedString(parsed.payload, parsed.signature)) {
                return null;
              }

              return normalizeOAuthPopupPayload(JSON.parse(parsed.payload));
            }

            return normalizeOAuthPopupPayload(parsed);
          } catch (_error) {
            return null;
          }
        };

        const clearStoredOAuthPopupResult = () => {
          try {
            window.localStorage.removeItem(OAUTH_POPUP_STORAGE_KEY);
          } catch (_error) {
            // noop
          }
        };

        const syncAuthenticatedUiAfterPopup = () => {
          document.documentElement.setAttribute('data-authenticated-session', 'true');
          const oneTapAnchor = document.getElementById('google-one-tap-anchor');
          if (oneTapAnchor instanceof HTMLElement) {
            oneTapAnchor.style.display = 'none';
          }
          closeModal();
        };

        const handleOAuthPopupResult = (payload) => {
          const normalized = normalizeOAuthPopupPayload(payload);
          if (!normalized || normalized.provider !== 'google') {
            return;
          }

          clearStoredOAuthPopupResult();

          if (normalized.type === 'matrix:oauth:error') {
            return;
          }

          if (normalized.sessionSnapshot && window.MatrixSession && typeof window.MatrixSession.restoreSessionSnapshot === 'function') {
            window.MatrixSession.restoreSessionSnapshot(normalized.sessionSnapshot);
          }

          syncAuthenticatedUiAfterPopup();
          window.requestAnimationFrame(() => {
            window.location.reload();
          });
        };

        window.addEventListener('message', (event) => {
          if (event.origin !== window.location.origin) {
            return;
          }

          const normalized = parseOAuthPopupPayload(event.data);
          if (!normalized) {
            return;
          }

          handleOAuthPopupResult(normalized);
        });

      

const processStoredOAuthPopupResult = () => {
  let rawValue = '';
  try {
    rawValue = window.localStorage.getItem(OAUTH_POPUP_STORAGE_KEY) || '';
  } catch (_error) {
    rawValue = '';
  }

  if (!rawValue) {
    return;
  }

  const normalized = parseOAuthPopupPayload(rawValue);
  if (!normalized) {
    clearStoredOAuthPopupResult();
    return;
  }

  handleOAuthPopupResult(normalized);
};

  window.addEventListener('storage', (event) => {
          if (event.key !== OAUTH_POPUP_STORAGE_KEY || !event.newValue) {
            return;
          }

          const normalized = parseOAuthPopupPayload(event.newValue);
          if (!normalized) {
            clearStoredOAuthPopupResult();
            return;
          }

          handleOAuthPopupResult(normalized);
        });

        processStoredOAuthPopupResult();

        window.openMatrixGoogleAuthPopup = (mode = 'login', options = {}) => {
          const normalizedMode = mode === 'signup' ? 'signup' : 'login';
          setPendingAuth(normalizedMode, '');

          const popupUrl = buildOAuthStarterFallbackUrl(normalizedMode);
          const popup = window.open(popupUrl, OAUTH_POPUP_NAME, getOAuthPopupFeatures());

          if (!popup) {
            window.location.href = popupUrl;
            return false;
          }

          try {
            popup.focus();
          } catch (_error) {
            // noop
          }

          if (options.closeModal !== false) {
            closeModal();
          }

          return true;
        };

        const continueWithGoogle = (event) => {
          event.preventDefault();
          window.openMatrixGoogleAuthPopup(activeMode, { closeModal: true, source: 'modal_google_button' });
        };

        const getModalDragStartZone = (target, clientY) => {
          if (!(dialog instanceof HTMLElement) || !(target instanceof Node)) {
            return '';
          }

          if (closeButton instanceof HTMLElement && closeButton.contains(target)) {
            return '';
          }

          const targetElement = target instanceof Element ? target : null;
          const interactiveTarget = targetElement?.closest(
            'button, input, textarea, select, a, label, [role="button"], [role="switch"]',
          );
          const rect = dialog.getBoundingClientRect();
          const offsetY = clientY - rect.top;
          const topZoneSize = Math.min(88, Math.max(56, rect.height * 0.16));
          const bottomZoneSize = Math.min(40, Math.max(28, rect.height * 0.08));
          const isInTopZone = offsetY >= 0 && offsetY <= topZoneSize;
          const isInBottomZone = offsetY >= rect.height - bottomZoneSize && offsetY <= rect.height;

          if (isInTopZone) {
            return 'top';
          }

          if (isInBottomZone && !interactiveTarget) {
            return 'bottom';
          }

          return '';
        };

        const tryStartModalDrag = (target, clientX, clientY) => {
          if (root.hidden || !(dialog instanceof HTMLElement)) {
            return false;
          }

          const dragZone = getModalDragStartZone(target, clientY);
          if (!dragZone) {
            return false;
          }

          startModalDrag(clientX, clientY, dragZone);
          return true;
        };

        closeButton?.addEventListener('click', (event) => {
          event.preventDefault();
          closeModal();
        });

        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && !root.hidden) {
            closeModal();
          }
        });

        form?.addEventListener('submit', continueWithEmail);
        googleButton?.addEventListener('click', continueWithGoogle);

        appleButton?.addEventListener('click', (event) => {
          event.preventDefault();
        });

        phoneButton?.addEventListener('click', (event) => {
          event.preventDefault();
        });

        const onModalTouchMove = (event) => {
          if (!isDraggingModal || !(dialog instanceof HTMLElement)) {
            return;
          }

          const touch = event.touches && event.touches[0];
          if (!touch) {
            return;
          }

          event.preventDefault();
          updateModalDrag(touch.clientX, touch.clientY);
        };

        const finishModalDrag = () => {
          if (!isDraggingModal || !(dragHost instanceof HTMLElement) || !(dialog instanceof HTMLElement)) {
            return;
          }

          const dialogWidth = dialog.getBoundingClientRect().width;
          const dialogHeight = dialog.getBoundingClientRect().height;
          const axis = dragAxis || 'y';
          const restoreAnimationMs = 280;
          const axisOffset = axis === 'x' ? dragOffsetX : dragOffsetY;
          const axisVelocity = axis === 'x' ? dragVelocityX : dragVelocityY;

          stopModalDragTracking();

          if (axis === 'x') {
            const threshold = Math.min(Math.max(dialogWidth * 0.38, 120), 240);
            const engagedDragThreshold = Math.max(70, Math.round(threshold * 0.65));
            const shouldCloseByDistance = Math.abs(axisOffset) >= threshold;
            const shouldCloseByVelocity =
              dragPeakOffsetX >= engagedDragThreshold &&
              Math.abs(axisVelocity) >= 1.25;

            if (shouldCloseByDistance || shouldCloseByVelocity) {
              closeDraggedModal((shouldCloseByVelocity ? axisVelocity : axisOffset) < 0 ? 'left' : 'right');
              return;
            }
          } else if (axis === 'diag') {
            const isMobileGesture = mobileModalQuery.matches;
            const horizontalThreshold = Math.min(Math.max(dialogWidth * 0.28, 82), 170);
            const downwardThreshold = Math.min(Math.max(dialogHeight * 0.34, 120), 230);
            const upwardThreshold = isMobileGesture
              ? Math.min(Math.max(dialogHeight * 0.24, 76), 150)
              : Math.min(Math.max(dialogHeight * 0.18, 44), 92);
            const horizontalVelocityThreshold = 1.05;
            const downwardVelocityThreshold = 1.2;
            const upwardVelocityThreshold = isMobileGesture ? 1.25 : 0.95;
            const horizontalEngagedThreshold = Math.max(54, Math.round(horizontalThreshold * 0.62));
            const downwardEngagedThreshold = Math.max(72, Math.round(downwardThreshold * 0.58));
            const upwardEngagedThreshold = isMobileGesture
              ? Math.max(54, Math.round(upwardThreshold * 0.55))
              : Math.max(32, Math.round(upwardThreshold * 0.42));
            const isDiagonalUp = dragOffsetY < 0;
            const verticalThreshold = isDiagonalUp ? upwardThreshold : downwardThreshold;
            const verticalVelocityThreshold = isDiagonalUp ? upwardVelocityThreshold : downwardVelocityThreshold;
            const verticalEngagedThreshold = isDiagonalUp ? upwardEngagedThreshold : downwardEngagedThreshold;
            const shouldCloseByDistance =
              Math.abs(dragOffsetX) >= horizontalThreshold &&
              Math.abs(dragOffsetY) >= verticalThreshold;
            const shouldCloseByVelocity =
              dragPeakOffsetX >= horizontalEngagedThreshold &&
              dragPeakOffsetY >= verticalEngagedThreshold &&
              Math.abs(dragVelocityX) >= horizontalVelocityThreshold &&
              Math.abs(dragVelocityY) >= verticalVelocityThreshold;

            if (shouldCloseByDistance || shouldCloseByVelocity) {
              const horizontalDirection = dragOffsetX < 0 ? 'left' : 'right';
              const verticalDirection = dragOffsetY < 0 ? 'up' : 'down';
              closeDraggedModal(`${verticalDirection}-${horizontalDirection}`);
              return;
            }
          } else {
            const isMobileGesture = mobileModalQuery.matches;
            const downDistanceThreshold = Math.min(Math.max(dialogHeight * 0.42, 170), 300);
            const upDistanceThreshold = isMobileGesture
              ? Math.min(Math.max(dialogHeight * 0.3, 90), 170)
              : Math.min(Math.max(dialogHeight * 0.22, 56), 120);
            const downVelocityThreshold = 1.55;
            const upVelocityThreshold = isMobileGesture ? 1.45 : 1.1;
            const downEngagedThreshold = Math.max(120, Math.round(downDistanceThreshold * 0.7));
            const upEngagedThreshold = isMobileGesture
              ? Math.max(64, Math.round(upDistanceThreshold * 0.58))
              : Math.max(42, Math.round(upDistanceThreshold * 0.46));
            const shouldCloseDownByDistance = axisOffset >= downDistanceThreshold;
            const shouldCloseUpByDistance = axisOffset <= -upDistanceThreshold;
            const shouldCloseDownByVelocity =
              dragPeakOffsetY >= downEngagedThreshold &&
              axisVelocity >= downVelocityThreshold;
            const shouldCloseUpByVelocity =
              dragPeakOffsetY >= upEngagedThreshold &&
              axisVelocity <= -upVelocityThreshold &&
              Math.abs(axisOffset) >= (isMobileGesture
                ? Math.max(36, Math.round(upEngagedThreshold * 0.38))
                : Math.max(24, Math.round(upEngagedThreshold * 0.2)));

            if (
              shouldCloseDownByDistance ||
              shouldCloseDownByVelocity ||
              shouldCloseUpByDistance ||
              shouldCloseUpByVelocity
            ) {
              closeDraggedModal(shouldCloseUpByDistance || shouldCloseUpByVelocity ? 'up' : 'down');
              return;
            }
          }

          animateDragHost(0, 0, restoreAnimationMs, () => {
            resetDialogDragState();
          });
        };

        dialog?.addEventListener('touchstart', (event) => {
          if (!mobileModalQuery.matches || !(dialog instanceof HTMLElement)) {
            return;
          }

          const touch = event.touches && event.touches[0];
          const target = event.target;
          if (!touch || !(target instanceof Node)) {
            return;
          }

          tryStartModalDrag(target, touch.clientX, touch.clientY);
        }, { passive: true });

        dialog?.addEventListener('mousedown', (event) => {
          if (!(dialog instanceof HTMLElement) || event.button !== 0) {
            return;
          }

          const target = event.target;
          if (!(target instanceof Node)) {
            return;
          }

          if (tryStartModalDrag(target, event.clientX, event.clientY)) {
            event.preventDefault();
          }
        });

        window.addEventListener('touchmove', onModalTouchMove, { passive: false });
        window.addEventListener('touchend', finishModalDrag, { passive: true });
        window.addEventListener('touchcancel', finishModalDrag, { passive: true });
        window.addEventListener('mousemove', (event) => {
          if (!isDraggingModal) {
            return;
          }

          updateModalDrag(event.clientX, event.clientY);
        });
        window.addEventListener('mouseup', finishModalDrag);
        window.addEventListener('mouseout', (event) => {
          if (mobileModalQuery.matches || !isDraggingModal || root.hidden) {
            return;
          }

          if (event.relatedTarget instanceof Node) {
            return;
          }

          if ((event.buttons & 1) !== 1) {
            return;
          }

          const hasUpwardIntent =
            dragOffsetY <= -18 &&
            Math.abs(dragOffsetY) >= Math.abs(dragOffsetX);

          if (!hasUpwardIntent) {
            return;
          }

          if (dragAxis === 'diag' && Math.abs(dragOffsetX) >= 18) {
            closeDraggedModal(dragOffsetX < 0 ? 'up-left' : 'up-right');
            return;
          }

          closeDraggedModal('up');
        });

        Array.from(document.querySelectorAll('[data-no-auth-modal-trigger]')).forEach((button) => {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            const trigger = event.currentTarget;
            if (!(trigger instanceof HTMLElement)) {
              return;
            }

            openModal(trigger.dataset.noAuthModalTrigger || 'login', {
              collapseSidebar: trigger.dataset.noAuthCollapseSidebar === 'true',
            });
          });
        });
      })();
