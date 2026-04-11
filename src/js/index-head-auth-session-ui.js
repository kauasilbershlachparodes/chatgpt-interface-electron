(() => {
  const SESSION_STORAGE_KEY = 'matrix.session.v2';
  const PENDING_STORAGE_KEY = 'matrix.pending.v2';
  const LEGACY_SESSION_STORAGE_KEYS = ['matrix.session.v1'];
  const LEGACY_PENDING_STORAGE_KEYS = ['matrix.pending.v1'];
  const OAUTH_POPUP_STORAGE_KEY = 'matrix.oauth.popup.result';
  const SESSION_BRIDGE_COOKIE = 'matrix_session_bridge.v1';
  const ROLE_COOKIE = 'matrix_role';
  const GATE_COOKIE = 'matrix_gate';
  const SESSION_COOKIE = 'matrix_sid';
  const SERIALIZATION_MAGIC = 'matrix.serialized';
  const SERIALIZATION_VERSION = 2;

  const getSecurityBridge = () =>
    window.electronAPI && typeof window.electronAPI === 'object' && window.electronAPI.security
      ? window.electronAPI.security
      : null;

  const getUtf8ByteLength = (value) => {
    try {
      return new TextEncoder().encode(String(value || '')).length;
    } catch (_error) {
      return String(value || '').length;
    }
  };

  const tryParseJson = (value, maxBytes = 16 * 1024) => {
    if (!value || typeof value !== 'string' || getUtf8ByteLength(value) > maxBytes) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  };

  const normalizeEnvelopeType = (value, fallback = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[a-z0-9._:-]{1,80}$/.test(normalized) ? normalized : fallback;
  };

  const getCookieValue = (name) => {
    const cookies = String(document.cookie || '').split(';');
    const prefix = `${encodeURIComponent(name)}=`;

    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (cookie.startsWith(prefix)) {
        return decodeURIComponent(cookie.slice(prefix.length));
      }
    }

    return '';
  };

  const clearCookie = (name, sameSite = 'Strict') => {
    try {
      const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=${sameSite}${secureFlag}`;
    } catch (_error) {
      // noop
    }
  };

  const openValue = (value) => {
    if (!value || typeof value !== 'string') return '';

    const bridge = getSecurityBridge();
    if (!bridge || typeof bridge.openString !== 'function') {
      return value;
    }

    try {
      return bridge.openString(value);
    } catch (_error) {
      return '';
    }
  };

  const deserializeSerializedValue = (raw, type, maxBytes = 16 * 1024) => {
    if (!raw || typeof raw !== 'string') return null;

    const opened = openValue(raw);
    if (!opened || getUtf8ByteLength(opened) > maxBytes) {
      return null;
    }

    const parsed = tryParseJson(opened, maxBytes);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    if (parsed.__format !== SERIALIZATION_MAGIC || Number(parsed.__v || 0) !== SERIALIZATION_VERSION) {
      if (parsed.__type === type && Number(parsed.__v || 0) === 1 && parsed.data && typeof parsed.data === 'object') {
        return parsed.data;
      }
      return null;
    }

    const actualType = normalizeEnvelopeType(parsed.__type, '');
    const expectedType = normalizeEnvelopeType(type, '');
    const payload = typeof parsed.payload === 'string' ? parsed.payload : '';
    const signature = typeof parsed.signature === 'string' ? parsed.signature : '';
    const bridge = getSecurityBridge();

    if (!actualType || !payload || (expectedType && actualType !== expectedType)) {
      return null;
    }

    if (bridge && typeof bridge.verifySignedString === 'function') {
      if (!signature || !bridge.verifySignedString(`${actualType}:${payload}`, signature)) {
        return null;
      }
    } else if (signature) {
      return null;
    }

    return tryParseJson(payload, maxBytes);
  };

  const normalizeSessionRecord = (value) => {
    if (!value || typeof value !== 'object') return null;

    const role = value.role === 'authenticated' ? 'authenticated' : value.role === 'guest' ? 'guest' : '';
    const gate = value.gate === 'allowed' ? 'allowed' : '';
    const expiresAt = Number(value.expiresAt || 0);

    if (!role || !gate || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return null;
    }

    return {
      role,
      gate,
      expiresAt,
      sessionId: String(value.sessionId || '').trim()
    };
  };

  const readStorageSession = (key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      if (key === SESSION_STORAGE_KEY) {
        return normalizeSessionRecord(deserializeSerializedValue(raw, 'matrix.session'));
      }

      return normalizeSessionRecord(tryParseJson(raw));
    } catch (_error) {
      return null;
    }
  };

  const readStoredSession = () =>
    readStorageSession(SESSION_STORAGE_KEY)
    || LEGACY_SESSION_STORAGE_KEYS.map(readStorageSession).find(Boolean)
    || null;

  const readBridgeCookie = () => {
    const raw = getCookieValue(SESSION_BRIDGE_COOKIE);
    if (!raw) return null;

    const parsed = deserializeSerializedValue(raw, 'matrix.session.cookie', 4096);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const role = parsed.role === 'authenticated' ? 'authenticated' : parsed.role === 'guest' ? 'guest' : '';
    const gate = parsed.gate === 'allowed' ? 'allowed' : '';
    const sessionId = String(parsed.sessionId || '').trim();

    return role && gate && sessionId ? { role, gate, sessionId } : null;
  };

  const removeStorageKey = (storage, key) => {
    try {
      storage.removeItem(key);
    } catch (_error) {
      // noop
    }
  };

  const clearStaleAuthenticatedArtifacts = () => {
    [SESSION_STORAGE_KEY, PENDING_STORAGE_KEY, OAUTH_POPUP_STORAGE_KEY, ...LEGACY_SESSION_STORAGE_KEYS, ...LEGACY_PENDING_STORAGE_KEYS].forEach((key) => {
      removeStorageKey(window.localStorage, key);
      removeStorageKey(window.sessionStorage, key);
    });

    clearCookie(SESSION_BRIDGE_COOKIE);
    clearCookie(ROLE_COOKIE, 'Lax');
    clearCookie(GATE_COOKIE, 'Lax');
    clearCookie(SESSION_COOKIE, 'Lax');

    try {
      Object.keys(window.localStorage).forEach((key) => {
        if (/^sb-.*-auth-token$/i.test(key) || /^supabase\.auth\./i.test(key)) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (_error) {
      // noop
    }

    try {
      Object.keys(window.sessionStorage).forEach((key) => {
        if (/^sb-.*-auth-token$/i.test(key) || /^supabase\.auth\./i.test(key)) {
          window.sessionStorage.removeItem(key);
        }
      });
    } catch (_error) {
      // noop
    }
  };

  const isHttpProtocol = () => /^https?:$/i.test(window.location.protocol || '');

  const resolveRole = () => {
    const storedSession = readStoredSession();
    const bridgeCookie = readBridgeCookie();
    const roleCookie = getCookieValue(ROLE_COOKIE);
    const gateCookie = getCookieValue(GATE_COOKIE);
    const sessionCookie = getCookieValue(SESSION_COOKIE);
    const hasLegacyCookieState = Boolean(roleCookie || gateCookie || sessionCookie);

    if (bridgeCookie?.role) {
      if (storedSession?.role && storedSession.role !== bridgeCookie.role) {
        clearStaleAuthenticatedArtifacts();
        return 'guest';
      }
      return bridgeCookie.role;
    }

    if (isHttpProtocol()) {
      if (!hasLegacyCookieState) {
        if (storedSession?.role === 'authenticated') {
          clearStaleAuthenticatedArtifacts();
          return 'guest';
        }
        return storedSession?.role || 'guest';
      }

      if (!roleCookie) {
        if (storedSession?.role === 'authenticated') {
          clearStaleAuthenticatedArtifacts();
          return 'guest';
        }
        return storedSession?.role || 'guest';
      }

      if (storedSession?.role && storedSession.role !== roleCookie) {
        clearStaleAuthenticatedArtifacts();
        return 'guest';
      }

      return roleCookie;
    }

    return roleCookie || storedSession?.role || 'guest';
  };

  let lastAuthenticatedState = null;

  const syncGoogleFrameVisibility = () => {
    const resolvedRole = resolveRole();
    const isAuthenticated = resolvedRole === 'authenticated';

    document.documentElement.setAttribute('data-matrix-role', resolvedRole);

    if (isAuthenticated) {
      document.documentElement.setAttribute('data-authenticated-session', 'true');
    } else {
      document.documentElement.removeAttribute('data-authenticated-session');
    }

    if (lastAuthenticatedState === true && !isAuthenticated) {
      const frame = document.getElementById('google-one-tap-anchor');
      if (frame) {
        frame.style.display = '';
      }
    }

    lastAuthenticatedState = isAuthenticated;
  };

  window.__matrixHardResetSessionUi = () => {
    clearStaleAuthenticatedArtifacts();
    syncGoogleFrameVisibility();
  };

  syncGoogleFrameVisibility();
  window.addEventListener('focus', syncGoogleFrameVisibility);
  window.addEventListener('pageshow', syncGoogleFrameVisibility);
  window.addEventListener('storage', (event) => {
    if (
      event.key === SESSION_STORAGE_KEY
      || event.key === OAUTH_POPUP_STORAGE_KEY
      || LEGACY_SESSION_STORAGE_KEYS.includes(event.key)
      || event.key === null
    ) {
      syncGoogleFrameVisibility();
    }
  });
  document.addEventListener('matrix:session-updated', syncGoogleFrameVisibility);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncGoogleFrameVisibility();
    }
  });
})();
