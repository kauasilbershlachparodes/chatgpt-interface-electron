(() => {
  const SESSION_STORAGE_KEY = 'matrix.session.v2';
  const PENDING_STORAGE_KEY = 'matrix.pending.v2';
  const THEME_STORAGE_KEY = 'theme';
  const RESOLVED_THEME_STORAGE_KEY = 'matrix.theme.v1';
  const ROLE_COOKIE = 'matrix_role';
  const GATE_COOKIE = 'matrix_gate';
  const SESSION_COOKIE = 'matrix_sid';
  const GUEST_TTL_MS = 2 * 60 * 60 * 1000;
  const AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const ATTEMPT_STORAGE_KEY = 'matrix.auth.attempts.v1';
  const LEGACY_SESSION_KEYS = ['matrix.session.v1'];
  const LEGACY_PENDING_KEYS = ['matrix.pending.v1'];
  const TRANSIENT_SESSION_KEYS = [
    'matrix.onboarding.what_brings_you.v1',
    'matrix.onboarding.usage_plan.v1'
  ];

  const safeNow = () => Date.now();

  const getStorage = (kind = 'local') => {
    try {
      return kind === 'session' ? window.sessionStorage : window.localStorage;
    } catch (_error) {
      return null;
    }
  };

  const safeStorageGet = (key, kind = 'local') => {
    try {
      return getStorage(kind)?.getItem(key) ?? null;
    } catch (_error) {
      return null;
    }
  };

  const safeStorageSet = (key, value, kind = 'local') => {
    try {
      getStorage(kind)?.setItem(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const safeStorageRemove = (key, kind = 'local') => {
    try {
      getStorage(kind)?.removeItem(key);
    } catch (_error) {
      // noop
    }
  };

  const tryParseJson = (value) => {
    if (!value || typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  };

  const getSecurityBridge = () =>
    window.electronAPI && typeof window.electronAPI === 'object' && window.electronAPI.security
      ? window.electronAPI.security
      : null;

  const sealValue = (value) => {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    const bridge = getSecurityBridge();
    if (!bridge || typeof bridge.sealString !== 'function') {
      return payload;
    }

    try {
      return bridge.sealString(payload);
    } catch (_error) {
      return payload;
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

  const readJsonEnvelope = (key, options = {}) => {
    const storageKind = options.storage === 'session' ? 'session' : 'local';
    const legacyKeys = Array.isArray(options.legacyKeys) ? options.legacyKeys : [];
    const candidates = [key, ...legacyKeys];

    for (const candidate of candidates) {
      const raw = safeStorageGet(candidate, storageKind);
      if (!raw) continue;
      const opened = openValue(raw);
      const parsed = tryParseJson(opened);
      if (parsed && typeof parsed === 'object') {
        if (candidate !== key) {
          safeStorageSet(key, sealValue(parsed), storageKind);
          safeStorageRemove(candidate, storageKind);
        }
        return parsed;
      }
    }

    return null;
  };

  const writeJsonEnvelope = (key, value, options = {}) => {
    const storageKind = options.storage === 'session' ? 'session' : 'local';
    return safeStorageSet(key, sealValue(value), storageKind);
  };

  const clearEnvelope = (key, options = {}) => {
    const storageKind = options.storage === 'session' ? 'session' : 'local';
    const legacyKeys = Array.isArray(options.legacyKeys) ? options.legacyKeys : [];
    [key, ...legacyKeys].forEach((candidate) => safeStorageRemove(candidate, storageKind));
  };

  const getSystemTheme = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'dark';
    }

    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_error) {
      return 'dark';
    }
  };

  const getExplicitThemePreference = () => {
    const theme = String(safeStorageGet(THEME_STORAGE_KEY, 'local') || '').trim().toLowerCase();
    return theme === 'light' || theme === 'dark' ? theme : '';
  };

  const resolveDocumentTheme = () => {
    const explicitTheme = getExplicitThemePreference();
    if (explicitTheme) return explicitTheme;

    const rememberedTheme = String(safeStorageGet(RESOLVED_THEME_STORAGE_KEY, 'local') || '').trim().toLowerCase();
    if (rememberedTheme === 'light' || rememberedTheme === 'dark') {
      return rememberedTheme;
    }

    const root = document.documentElement;
    if (root) {
      if (root.classList.contains('light')) return 'light';
      if (root.classList.contains('dark')) return 'dark';

      const darkModeAttribute = String(root.getAttribute('data-dark-mode-enabled') || '').trim().toLowerCase();
      if (darkModeAttribute === 'true') return 'dark';
      if (darkModeAttribute === 'false') return 'light';
    }

    return getSystemTheme();
  };

  const applyDocumentTheme = () => {
    const root = document.documentElement;
    if (!root) return;

    const resolvedTheme = resolveDocumentTheme();
    const isDarkTheme = resolvedTheme === 'dark';

    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    root.setAttribute('data-dark-mode-enabled', isDarkTheme ? 'true' : 'false');

    safeStorageSet(RESOLVED_THEME_STORAGE_KEY, resolvedTheme, 'local');
  };

  const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

  const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const toTitleCaseToken = (value) => {
    const normalized = normalizeWhitespace(value).toLowerCase();
    if (!normalized) return '';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const deriveEmailLocalPart = (email) => {
    const normalizedEmail = toTrimmedString(email).toLowerCase();
    if (!normalizedEmail.includes('@')) return normalizedEmail;
    return normalizedEmail.split('@')[0] || '';
  };

  const deriveDisplayNameFromEmail = (email) => {
    const localPart = deriveEmailLocalPart(email);
    if (!localPart) return '';

    const tokens = localPart
      .split(/[._+-]+/)
      .map((token) => token.replace(/[^a-z0-9]/gi, '').trim())
      .filter(Boolean);

    if (tokens.length >= 2) {
      return tokens.map(toTitleCaseToken).join(' ');
    }

    if (tokens.length === 1) {
      const token = tokens[0];
      if (token.length <= 18) {
        return toTitleCaseToken(token);
      }
      return toTitleCaseToken(token.slice(0, 18));
    }

    return '';
  };

  const deriveInitials = (displayName, email) => {
    const normalizedName = normalizeWhitespace(displayName);
    const nameTokens = normalizedName
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/gi, '').trim())
      .filter(Boolean);

    if (nameTokens.length >= 2) {
      return `${nameTokens[0][0]}${nameTokens[nameTokens.length - 1][0]}`.toUpperCase();
    }

    if (nameTokens.length === 1 && nameTokens[0].length >= 2) {
      return nameTokens[0].slice(0, 2).toUpperCase();
    }

    const localPart = deriveEmailLocalPart(email).replace(/[^a-z0-9]/gi, '');
    if (localPart.length >= 2) {
      return localPart.slice(0, 2).toUpperCase();
    }

    if (localPart.length === 1) {
      return `${localPart[0]}X`.toUpperCase();
    }

    return 'U';
  };

  const resolveUserMetadata = (user = {}) => {
    const appMetadata = user && typeof user.app_metadata === 'object' ? user.app_metadata : {};
    const userMetadata = user && typeof user.user_metadata === 'object' ? user.user_metadata : {};
    const identities = Array.isArray(user?.identities) ? user.identities : [];
    const identityData = identities
      .map((identity) => (identity && typeof identity.identity_data === 'object' ? identity.identity_data : null))
      .find(Boolean) || {};

    return { appMetadata, userMetadata, identityData };
  };

  const resolveDisplayName = (user = {}, options = {}) => {
    const explicitName = normalizeWhitespace(options.displayName || options.name || '');
    if (explicitName) return explicitName;

    const { userMetadata, identityData } = resolveUserMetadata(user);
    const candidates = [
      userMetadata.full_name,
      userMetadata.name,
      userMetadata.display_name,
      userMetadata.user_name,
      userMetadata.preferred_username,
      identityData.full_name,
      identityData.name,
      identityData.display_name,
      identityData.user_name,
      identityData.preferred_username
    ];

    for (const candidate of candidates) {
      const normalized = normalizeWhitespace(candidate);
      if (normalized) return normalized;
    }

    return deriveDisplayNameFromEmail(user && typeof user.email === 'string' ? user.email : '');
  };

  const resolveAvatarUrl = (user = {}, options = {}) => {
    const explicitAvatar = toTrimmedString(options.avatarUrl || options.avatar || '');
    if (explicitAvatar) return explicitAvatar;

    const { userMetadata, identityData } = resolveUserMetadata(user);
    const candidates = [
      userMetadata.avatar_url,
      userMetadata.picture,
      userMetadata.avatar,
      identityData.avatar_url,
      identityData.picture,
      identityData.avatar
    ];

    for (const candidate of candidates) {
      const normalized = toTrimmedString(candidate);
      if (normalized) return normalized;
    }

    return '';
  };

  const resolveProfile = (user = {}, options = {}) => {
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    const displayName = resolveDisplayName(user, options);
    const avatarUrl = resolveAvatarUrl(user, options);
    const initials = deriveInitials(displayName, email);

    return {
      displayName,
      avatarUrl,
      initials,
      planLabel: toTrimmedString(options.planLabel || 'Free') || 'Free'
    };
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
      const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Strict${secureFlag}`;
    } catch (_error) {
      // noop
    }
  };

  const clearCookie = (name) => {
    try {
      const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Strict${secureFlag}`;
    } catch (_error) {
      // noop
    }
  };

  const createSessionId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sid-${safeNow()}-${Math.random().toString(36).slice(2, 12)}`;
  };

  const mirrorSessionCookies = (session) => {
    if (!session) {
      clearCookie(ROLE_COOKIE);
      clearCookie(GATE_COOKIE);
      clearCookie(SESSION_COOKIE);
      return;
    }

    const maxAge = Math.max(1, Math.floor((session.expiresAt - safeNow()) / 1000));
    setCookie(ROLE_COOKIE, session.role, maxAge);
    setCookie(GATE_COOKIE, 'allowed', maxAge);
    setCookie(SESSION_COOKIE, session.sessionId || '', maxAge);
  };

  const notifySessionUpdated = (detail = {}) => {
    try {
      document.dispatchEvent(new CustomEvent('matrix:session-updated', { detail }));
    } catch (_error) {
      // noop
    }
  };

  const persistSession = (session) => {
    writeJsonEnvelope(SESSION_STORAGE_KEY, session, { storage: 'local' });
    mirrorSessionCookies(session);
    notifySessionUpdated({ state: 'authenticated', role: session?.role || '' });
    return session;
  };

  const clearSession = () => {
    clearEnvelope(SESSION_STORAGE_KEY, { storage: 'local', legacyKeys: LEGACY_SESSION_KEYS });
    mirrorSessionCookies(null);
    notifySessionUpdated({ state: 'cleared', role: '' });
  };

  const clearPendingAuth = () => {
    clearEnvelope(PENDING_STORAGE_KEY, { storage: 'session', legacyKeys: LEGACY_PENDING_KEYS });
    clearEnvelope(PENDING_STORAGE_KEY, { storage: 'local', legacyKeys: LEGACY_PENDING_KEYS });
    TRANSIENT_SESSION_KEYS.forEach((key) => safeStorageRemove(key, 'session'));
  };

  const normalizeSession = (session) => {
    if (!session || typeof session !== 'object') return null;
    if (!session.role || !session.expiresAt || !session.sessionId) return null;
    if (session.expiresAt <= safeNow()) {
      clearSession();
      return null;
    }
    return session;
  };

  const getSession = () => normalizeSession(readJsonEnvelope(SESSION_STORAGE_KEY, {
    storage: 'local',
    legacyKeys: LEGACY_SESSION_KEYS
  }));

  const getPendingAuth = () => {
    const payload = readJsonEnvelope(PENDING_STORAGE_KEY, {
      storage: 'session',
      legacyKeys: LEGACY_PENDING_KEYS
    }) || readJsonEnvelope(PENDING_STORAGE_KEY, {
      storage: 'local',
      legacyKeys: LEGACY_PENDING_KEYS
    });

    if (!payload || typeof payload !== 'object') return null;

    const maxAgeMs = 30 * 60 * 1000;
    if (payload.createdAt && safeNow() - payload.createdAt > maxAgeMs) {
      clearPendingAuth();
      return null;
    }

    return payload;
  };

  const setPendingAuth = (payload = {}) => {
    const onboardingPurposes = Array.isArray(payload.onboardingPurposes)
      ? payload.onboardingPurposes
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : typeof payload.onboardingPurpose === 'string' && payload.onboardingPurpose.trim()
        ? [payload.onboardingPurpose.trim()]
        : [];

    const nextValue = {
      mode: payload.mode === 'signup' ? 'signup' : 'login',
      email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '',
      password: typeof payload.password === 'string' ? payload.password : '',
      name: typeof payload.name === 'string' ? payload.name.trim() : '',
      age: Number.isFinite(payload.age) ? payload.age : null,
      onboardingPurpose: onboardingPurposes[0] || '',
      onboardingPurposes,
      onboardingUsageMode:
        typeof payload.onboardingUsageMode === 'string'
          ? payload.onboardingUsageMode.trim()
          : '',
      createdAt: safeNow()
    };

    writeJsonEnvelope(PENDING_STORAGE_KEY, nextValue, { storage: 'session' });
    clearEnvelope(PENDING_STORAGE_KEY, { storage: 'local', legacyKeys: LEGACY_PENDING_KEYS });
    return nextValue;
  };

  const reconcileSessionWithCookies = () => {
    if (!/^https?:$/.test(window.location.protocol)) {
      return;
    }

    const session = getSession();
    if (!session || typeof session !== 'object') {
      return;
    }

    const roleCookie = getCookieValue(ROLE_COOKIE);
    const gateCookie = getCookieValue(GATE_COOKIE);
    const sessionCookie = getCookieValue(SESSION_COOKIE);

    if (!roleCookie || !gateCookie || !sessionCookie || session.role !== roleCookie || session.sessionId !== sessionCookie) {
      clearSession();
      clearPendingAuth();
    }
  };

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

  const buildSessionPayload = (base) => ({
    sessionId: createSessionId(),
    gate: 'allowed',
    createdAt: safeNow(),
    ...base
  });

  const startGuestSession = () => {
    clearPendingAuth();
    return persistSession(buildSessionPayload({
      role: 'guest',
      email: '',
      authProvider: '',
      userId: '',
      displayName: '',
      avatarUrl: '',
      initials: 'G',
      planLabel: 'Free',
      expiresAt: safeNow() + GUEST_TTL_MS
    }));
  };

  const startAuthenticatedSession = (user = {}, options = {}) => {
    clearPendingAuth();
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    const userId = typeof user.id === 'string' ? user.id : '';
    const authProvider = resolveAuthProvider(user, options.provider);
    const profile = resolveProfile(user, options);

    return persistSession(buildSessionPayload({
      role: 'authenticated',
      email,
      authProvider,
      userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      initials: profile.initials,
      planLabel: profile.planLabel,
      expiresAt: safeNow() + AUTH_TTL_MS
    }));
  };

  const canAccessProtectedUi = () => {
    const session = getSession();
    return Boolean(session && (session.role === 'guest' || session.role === 'authenticated'));
  };

  const getModeFromLocation = () => {
    const mode = new URLSearchParams(window.location.search).get('mode');
    return mode === 'signup' ? 'signup' : 'login';
  };

  const readAttemptStore = () => {
    const parsed = tryParseJson(safeStorageGet(ATTEMPT_STORAGE_KEY, 'local'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  };

  const writeAttemptStore = (value) => {
    safeStorageSet(ATTEMPT_STORAGE_KEY, JSON.stringify(value || {}), 'local');
  };

  const normalizeAttemptIdentifier = (scope, identifier = '') =>
    `${String(scope || 'global').trim().toLowerCase()}:${String(identifier || 'anonymous').trim().toLowerCase() || 'anonymous'}`;

  const getThrottleWindowMs = (failureCount) => {
    if (failureCount >= 10) return 15 * 60 * 1000;
    if (failureCount >= 8) return 5 * 60 * 1000;
    if (failureCount >= 5) return 60 * 1000;
    return 0;
  };

  const getAttemptStatus = (scope, identifier = '') => {
    const key = normalizeAttemptIdentifier(scope, identifier);
    const store = readAttemptStore();
    const entry = store[key];

    if (!entry || typeof entry !== 'object') {
      return {
        blocked: false,
        remainingMs: 0,
        failureCount: 0,
        cooldownReason: ''
      };
    }

    const lockedUntil = Number(entry.lockedUntil || 0);
    const remainingMs = Math.max(0, lockedUntil - safeNow());

    if (!remainingMs && entry.failureCount === 0 && !entry.cooldownReason) {
      delete store[key];
      writeAttemptStore(store);
      return {
        blocked: false,
        remainingMs: 0,
        failureCount: 0,
        cooldownReason: ''
      };
    }

    return {
      blocked: remainingMs > 0,
      remainingMs,
      failureCount: Number(entry.failureCount || 0),
      cooldownReason: typeof entry.cooldownReason === 'string' ? entry.cooldownReason : ''
    };
  };

  const registerFailedAttempt = (scope, identifier = '') => {
    const key = normalizeAttemptIdentifier(scope, identifier);
    const store = readAttemptStore();
    const current = store[key] && typeof store[key] === 'object' ? store[key] : {};
    const failureCount = Number(current.failureCount || 0) + 1;
    const lockedForMs = getThrottleWindowMs(failureCount);

    store[key] = {
      failureCount,
      cooldownReason: 'failed_attempts',
      lockedUntil: lockedForMs ? safeNow() + lockedForMs : 0,
      updatedAt: safeNow()
    };

    writeAttemptStore(store);
    return getAttemptStatus(scope, identifier);
  };

  const clearAttemptStatus = (scope, identifier = '') => {
    const key = normalizeAttemptIdentifier(scope, identifier);
    const store = readAttemptStore();
    if (store[key]) {
      delete store[key];
      writeAttemptStore(store);
    }
  };

  const registerCooldown = (scope, identifier = '', cooldownMs = 0, reason = 'cooldown') => {
    const key = normalizeAttemptIdentifier(scope, identifier);
    const store = readAttemptStore();
    const current = store[key] && typeof store[key] === 'object' ? store[key] : {};

    store[key] = {
      failureCount: Number(current.failureCount || 0),
      cooldownReason: reason,
      lockedUntil: Math.max(Number(current.lockedUntil || 0), safeNow() + Math.max(0, cooldownMs)),
      updatedAt: safeNow()
    };

    writeAttemptStore(store);
    return getAttemptStatus(scope, identifier);
  };

  const formatRemainingTime = (remainingMs = 0) => {
    const totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const minutes = Math.ceil(totalSeconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
  };

  const sanitizeNextUrl = (candidate, fallback = 'log-in-or-create-account.html?mode=signup', disallowedMatchers = []) => {
    const fallbackValue = typeof fallback === 'string' && fallback.trim()
      ? fallback.trim()
      : 'log-in-or-create-account.html?mode=signup';
    const rawCandidate = String(candidate || '').trim();

    if (!rawCandidate || rawCandidate.startsWith('//') || /^javascript:/i.test(rawCandidate)) {
      return fallbackValue;
    }

    try {
      const url = new URL(rawCandidate, window.location.origin);
      if (url.origin !== window.location.origin) {
        return fallbackValue;
      }

      const normalized = `${url.pathname.replace(/^\//, '')}${url.search}${url.hash}`;
      if (!normalized || !/\.html?(?:[?#].*)?$/i.test(normalized)) {
        return fallbackValue;
      }

      const isDisallowed = disallowedMatchers.some((matcher) => {
        if (matcher instanceof RegExp) {
          return matcher.test(normalized);
        }

        return String(matcher || '').trim() === normalized;
      });

      return isDisallowed ? fallbackValue : normalized;
    } catch (_error) {
      return fallbackValue;
    }
  };

  applyDocumentTheme();

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === RESOLVED_THEME_STORAGE_KEY) {
      applyDocumentTheme();
    }
  });

  if (typeof window.matchMedia === 'function') {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (!getExplicitThemePreference()) {
        applyDocumentTheme();
      }
    };

    if (typeof darkModeMediaQuery.addEventListener === 'function') {
      darkModeMediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (typeof darkModeMediaQuery.addListener === 'function') {
      darkModeMediaQuery.addListener(handleSystemThemeChange);
    }
  }

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
    canAccessProtectedUi,
    getAttemptStatus,
    registerFailedAttempt,
    clearAttemptStatus,
    registerCooldown,
    formatRemainingTime,
    sanitizeNextUrl
  };
})();
