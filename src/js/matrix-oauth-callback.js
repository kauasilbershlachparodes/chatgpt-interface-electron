(async () => {
  const CONFIG_URLS = [
    '/auth.config.json',
    '/matrix-auth.config.json',
    'auth.config.json',
    'matrix-auth.config.json',
  ];
  const SUPABASE_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  ];
  const OAUTH_POPUP_STORAGE_KEY = 'matrix.oauth.popup.result';

  const matrix = window.MatrixSession;
  const statusElement = document.getElementById('oauth-status');

  const setStatus = (message, isError = false) => {
    if (!(statusElement instanceof HTMLElement)) return;
    statusElement.textContent = String(message || '');
    statusElement.style.color = isError ? '#fca5a5' : '#c6d4cf';
  };

  const redirectToLogin = () => {
    window.location.replace('/index.html');
  };

  const redirectToIndex = () => {
    window.location.replace('/index.html');
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.head.appendChild(script);
  });

  const ensureSupabase = async () => {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return window.supabase;
    }

    let lastError = null;
    for (const src of SUPABASE_CDN_URLS) {
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

  const normalizeConfig = (raw = {}) => ({
    supabaseUrl: String(raw.supabaseUrl || '').trim(),
    anonKey: String(raw.anonKey || raw.supabaseKey || '').trim(),
  });

  const loadConfigFromSameOrigin = async () => {
    for (const candidate of CONFIG_URLS) {
      try {
        const response = await fetch(candidate, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const normalized = normalizeConfig(payload);
        if (normalized.supabaseUrl && normalized.anonKey) {
          return normalized;
        }
      } catch (_error) {
        // noop
      }
    }
    return { supabaseUrl: '', anonKey: '' };
  };

  const getConfig = async () => {
    const bridgeConfig = window.electronAPI && window.electronAPI.authConfig
      ? normalizeConfig(window.electronAPI.authConfig)
      : { supabaseUrl: '', anonKey: '' };
    if (bridgeConfig.supabaseUrl && bridgeConfig.anonKey) {
      return bridgeConfig;
    }

    const inlineConfig = normalizeConfig(
      window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {}
    );
    if (inlineConfig.supabaseUrl && inlineConfig.anonKey) {
      return inlineConfig;
    }

    return loadConfigFromSameOrigin();
  };

  const notifyOpener = (payload) => {
    const message = { ...payload, ts: Date.now() };

    try {
      window.localStorage.setItem(OAUTH_POPUP_STORAGE_KEY, JSON.stringify(message));
    } catch (_error) {
      // noop
    }

    if (!window.opener || window.opener.closed) {
      return;
    }

    try {
      window.opener.postMessage(message, window.location.origin);
    } catch (_error) {
      // noop
    }
  };

  const finishPopupWindow = (fallback) => {
    if (!window.opener || window.opener.closed) {
      fallback();
      return;
    }

    window.setTimeout(() => {
      try {
        window.close();
      } catch (_error) {
        fallback();
        return;
      }

      window.setTimeout(() => {
        if (!window.closed) {
          fallback();
        }
      }, 300);
    }, 150);
  };

  const readUrlArtifacts = () => {
    const url = new URL(window.location.href);
    const search = url.searchParams;
    const hash = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));

    return {
      code: search.get('code') || '',
      oauthError: search.get('error_description') || search.get('error') || hash.get('error_description') || hash.get('error') || '',
      accessToken: hash.get('access_token') || search.get('access_token') || '',
      refreshToken: hash.get('refresh_token') || search.get('refresh_token') || '',
      expiresIn: Number.parseInt(hash.get('expires_in') || search.get('expires_in') || '0', 10) || 0,
      expiresAt: Number.parseInt(hash.get('expires_at') || search.get('expires_at') || '0', 10) || 0,
      tokenType: hash.get('token_type') || search.get('token_type') || 'bearer',
      providerToken: hash.get('provider_token') || search.get('provider_token') || '',
      providerRefreshToken: hash.get('provider_refresh_token') || search.get('provider_refresh_token') || '',
    };
  };

  const cleanupUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.delete('code');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      url.searchParams.delete('access_token');
      url.searchParams.delete('refresh_token');
      url.searchParams.delete('expires_in');
      url.searchParams.delete('expires_at');
      url.searchParams.delete('token_type');
      url.searchParams.delete('provider_token');
      url.searchParams.delete('provider_refresh_token');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch (_error) {
      // noop
    }
  };

  const createClient = (supabaseModule, supabaseUrl, anonKey) => supabaseModule.createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  const hasLikelyStoredPkceVerifier = () => {
    const keyLooksRelevant = (key) => /code.?verifier|pkce/i.test(String(key || ''));
    const storageHasVerifier = (storage) => {
      if (!storage) return false;
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!keyLooksRelevant(key)) continue;
          const value = storage.getItem(key);
          if (typeof value === 'string' && value.trim()) {
            return true;
          }
        }
      } catch (_error) {
        return false;
      }
      return false;
    };

    return storageHasVerifier(window.localStorage) || storageHasVerifier(window.sessionStorage);
  };

  const buildSessionFromTokens = (artifacts) => ({
    access_token: artifacts.accessToken,
    refresh_token: artifacts.refreshToken,
    token_type: artifacts.tokenType || 'bearer',
    expires_in: artifacts.expiresIn || undefined,
    expires_at: artifacts.expiresAt || undefined,
    provider_token: artifacts.providerToken || undefined,
    provider_refresh_token: artifacts.providerRefreshToken || undefined,
  });

  const resolveUserFromImplicitArtifacts = async (client, artifacts) => {
    if (typeof client.auth.setSession === 'function' && artifacts.accessToken && artifacts.refreshToken) {
      const { data, error } = await client.auth.setSession(buildSessionFromTokens(artifacts));
      if (error) throw error;
      if (data?.user) return data.user;
      if (data?.session?.user) return data.session.user;
    }

    if (typeof client.auth.getUser === 'function') {
      const userResult = await client.auth.getUser();
      if (userResult.error) throw userResult.error;
      if (userResult.data?.user) return userResult.data.user;
    }

    return null;
  };

  const resolveUserFromPkceCode = async (client, code) => {
    if (!code || typeof client.auth.exchangeCodeForSession !== 'function') {
      return null;
    }

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data?.user || data?.session?.user || null;
  };

  const finishOAuthFlow = async () => {
    if (!matrix || typeof matrix.startAuthenticatedSession !== 'function') {
      setStatus('The session bridge is not available on this page.', true);
      return;
    }

    const artifacts = readUrlArtifacts();

    if (artifacts.oauthError) {
      setStatus(artifacts.oauthError, true);
      notifyOpener({ type: 'matrix:oauth:error', provider: 'google', message: artifacts.oauthError });
      cleanupUrl();
      window.setTimeout(() => finishPopupWindow(redirectToLogin), 1800);
      return;
    }

    if (!artifacts.accessToken && !artifacts.code) {
      const message = 'The Google callback did not include any usable authentication tokens.';
      setStatus(message, true);
      notifyOpener({ type: 'matrix:oauth:error', provider: 'google', message });
      cleanupUrl();
      window.setTimeout(() => finishPopupWindow(redirectToLogin), 1800);
      return;
    }

    try {
      setStatus('Completing your Google sign-in…');
      const [{ supabaseUrl, anonKey }, supabaseModule] = await Promise.all([
        getConfig(),
        ensureSupabase(),
      ]);

      if (!supabaseUrl || !anonKey) {
        throw new Error('Authentication is not configured. Add auth.config.json or set the Electron auth config before starting the app.');
      }

      const client = createClient(supabaseModule, supabaseUrl, anonKey);
      let user = null;

      if (artifacts.accessToken) {
        user = await resolveUserFromImplicitArtifacts(client, artifacts);
      } else if (artifacts.code && hasLikelyStoredPkceVerifier()) {
        user = await resolveUserFromPkceCode(client, artifacts.code);
      } else if (artifacts.code) {
        throw new Error('This Google callback returned an auth code, but no PKCE verifier was available to complete the exchange.');
      }

      if (!user && typeof client.auth.getUser === 'function') {
        const userResult = await client.auth.getUser();
        if (userResult.error) throw userResult.error;
        user = userResult.data?.user || null;
      }

      if (!user || !user.email) {
        throw new Error('Google sign-in completed, but no authenticated user was returned.');
      }

      matrix.startAuthenticatedSession(user, { provider: 'google' });
      matrix.clearPendingAuth?.();
      cleanupUrl();

      setStatus('Google sign-in completed. Redirecting…');
      notifyOpener({ type: 'matrix:oauth:complete', provider: 'google', email: user.email });
      window.setTimeout(() => finishPopupWindow(redirectToIndex), 250);
    } catch (error) {
      const rawMessage = error && error.message ? error.message : 'Unable to complete Google sign-in.';
      const message = /(PKCE code verifier not found in storage|both auth code and code verifier should be non-empty)/i.test(rawMessage)
        ? 'Google sign-in returned to a stale callback path. Close this window, restart the app, and start Google sign-in again.'
        : rawMessage;
      setStatus(message, true);
      notifyOpener({ type: 'matrix:oauth:error', provider: 'google', message });
      cleanupUrl();
      window.setTimeout(() => finishPopupWindow(redirectToLogin), 2200);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finishOAuthFlow, { once: true });
  } else {
    finishOAuthFlow();
  }
})();
