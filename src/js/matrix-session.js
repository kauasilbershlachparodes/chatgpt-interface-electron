(() => {
  const SESSION_STORAGE_KEY = 'matrix.session.v1';
  const PENDING_STORAGE_KEY = 'matrix.pending.v1';
  const ROLE_COOKIE = 'matrix_role';
  const GATE_COOKIE = 'matrix_gate';
  const EMAIL_COOKIE = 'matrix_email';
  const AUTH_PROVIDER_COOKIE = 'matrix_auth_provider';
  const GUEST_TTL_MS = 12 * 60 * 60 * 1000;
  const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  const safeNow = () => Date.now();

  const tryParseJson = (value) => {
    if (!value || typeof value !== 'string') return null;
    try { return JSON.parse(value); } catch (_error) { return null; }
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

  const setCookie = (name, value, maxAgeSeconds) => {
    try {
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Strict`;
    } catch (_error) {
      // file:// pages may ignore cookies; localStorage remains the source of truth.
    }
  };

  const clearCookie = (name) => {
    try {
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Strict`;
    } catch (_error) {
      // noop
    }
  };

  const mirrorSessionCookies = (session) => {
    if (!session) {
      clearCookie(ROLE_COOKIE);
      clearCookie(GATE_COOKIE);
      clearCookie(EMAIL_COOKIE);
      clearCookie(AUTH_PROVIDER_COOKIE);
      return;
    }

    const maxAge = Math.max(1, Math.floor((session.expiresAt - safeNow()) / 1000));
    setCookie(ROLE_COOKIE, session.role, maxAge);
    setCookie(GATE_COOKIE, 'allowed', maxAge);
    if (session.email) {
      setCookie(EMAIL_COOKIE, session.email, maxAge);
    } else {
      clearCookie(EMAIL_COOKIE);
    }

    if (session.authProvider) {
      setCookie(AUTH_PROVIDER_COOKIE, session.authProvider, maxAge);
    } else {
      clearCookie(AUTH_PROVIDER_COOKIE);
    }
  };

  const persistSession = (session) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    mirrorSessionCookies(session);
    return session;
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    mirrorSessionCookies(null);
  };

  const clearPendingAuth = () => {
    localStorage.removeItem(PENDING_STORAGE_KEY);
  };

  const reconcileSessionWithCookies = () => {
    if (!/^https?:$/.test(window.location.protocol)) {
      return;
    }

    const session = tryParseJson(localStorage.getItem(SESSION_STORAGE_KEY));
    if (!session || typeof session !== 'object') {
      return;
    }

    const roleCookie = getCookieValue(ROLE_COOKIE);
    const gateCookie = getCookieValue(GATE_COOKIE);

    if (!roleCookie || !gateCookie || session.role !== roleCookie) {
      clearSession();
      clearPendingAuth();
    }
  };

  const getPendingAuth = () => {
    const payload = tryParseJson(localStorage.getItem(PENDING_STORAGE_KEY));
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  };

  const setPendingAuth = (payload = {}) => {
    const nextValue = {
      mode: payload.mode === 'signup' ? 'signup' : 'login',
      email: typeof payload.email === 'string' ? payload.email.trim() : '',
      createdAt: safeNow()
    };
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(nextValue));
    return nextValue;
  };

  const normalizeSession = (session) => {
    if (!session || typeof session !== 'object') return null;
    if (!session.role || !session.expiresAt) return null;
    if (session.expiresAt <= safeNow()) {
      clearSession();
      return null;
    }
    return session;
  };

  const getSession = () => normalizeSession(tryParseJson(localStorage.getItem(SESSION_STORAGE_KEY)));

  const resolveAuthProvider = (user = {}, explicitProvider = '') => {
    const normalizedExplicitProvider = String(explicitProvider || '').trim().toLowerCase();
    if (normalizedExplicitProvider === 'google' || normalizedExplicitProvider === 'email') {
      return normalizedExplicitProvider;
    }

    const appMetadataProvider = String(user?.app_metadata?.provider || '').trim().toLowerCase();
    if (appMetadataProvider === 'google' || appMetadataProvider === 'email') {
      return appMetadataProvider;
    }

    const appMetadataProviders = Array.isArray(user?.app_metadata?.providers)
      ? user.app_metadata.providers.map((provider) => String(provider || '').trim().toLowerCase())
      : [];

    if (appMetadataProviders.includes('google')) {
      return 'google';
    }

    const identityProviders = Array.isArray(user?.identities)
      ? user.identities.map((identity) => String(identity?.provider || '').trim().toLowerCase())
      : [];

    if (identityProviders.includes('google')) {
      return 'google';
    }

    return user && typeof user.email === 'string' && user.email.trim() ? 'email' : '';
  };

  const startGuestSession = () => {
    const now = safeNow();
    return persistSession({
      role: 'guest',
      gate: 'allowed',
      email: '',
      authProvider: '',
      userId: '',
      createdAt: now,
      expiresAt: now + GUEST_TTL_MS
    });
  };

  const startAuthenticatedSession = (user = {}, options = {}) => {
    const now = safeNow();
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    const userId = typeof user.id === 'string' ? user.id : '';
    const authProvider = resolveAuthProvider(user, options.provider);
    return persistSession({
      role: 'authenticated',
      gate: 'allowed',
      email,
      authProvider,
      userId,
      createdAt: now,
      expiresAt: now + AUTH_TTL_MS
    });
  };

  const canAccessProtectedUi = () => {
    const session = getSession();
    return Boolean(session && (session.role === 'guest' || session.role === 'authenticated'));
  };

  const getModeFromLocation = () => {
    const mode = new URLSearchParams(window.location.search).get('mode');
    return mode === 'signup' ? 'signup' : 'login';
  };

  reconcileSessionWithCookies();

  window.MatrixSession = {
    AUTH_MAX_PASSWORD_LENGTH: 72,
    AUTH_MAX_EMAIL_LENGTH: 254,
    AUTH_OTP_LENGTH: 6,
    getModeFromLocation,
    setPendingAuth,
    getPendingAuth,
    clearPendingAuth,
    getSession,
    clearSession,
    startGuestSession,
    startAuthenticatedSession,
    canAccessProtectedUi
  };
})();
