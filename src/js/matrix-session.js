(() => {
  const SESSION_STORAGE_KEY = 'matrix.session.v1';
  const PENDING_STORAGE_KEY = 'matrix.pending.v1';
  const ROLE_COOKIE = 'matrix_role';
  const GATE_COOKIE = 'matrix_gate';
  const EMAIL_COOKIE = 'matrix_email';
  const GUEST_TTL_MS = 12 * 60 * 60 * 1000;
  const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  const safeNow = () => Date.now();

  const tryParseJson = (value) => {
    if (!value || typeof value !== 'string') return null;
    try { return JSON.parse(value); } catch (_error) { return null; }
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

  const startGuestSession = () => {
    const now = safeNow();
    return persistSession({
      role: 'guest',
      gate: 'allowed',
      email: '',
      userId: '',
      createdAt: now,
      expiresAt: now + GUEST_TTL_MS
    });
  };

  const startAuthenticatedSession = (user = {}) => {
    const now = safeNow();
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    const userId = typeof user.id === 'string' ? user.id : '';
    return persistSession({
      role: 'authenticated',
      gate: 'allowed',
      email,
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
