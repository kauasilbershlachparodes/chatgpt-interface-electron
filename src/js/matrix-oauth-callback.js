(() => {
  const DEFAULT_PROJECT_URL = 'https://xkkrbnxqtrfjzbasvocz.supabase.co';
  const DEFAULT_ANON_KEY = 'sb_publishable_MhEwBmkNjTFAMSZniI5XzQ_45tNsIYX';

  const getConfig = () => {
    const bridgeConfig = window.electronAPI && window.electronAPI.authConfig ? window.electronAPI.authConfig : {};
    const inlineConfig = window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {};

    return {
      supabaseUrl: bridgeConfig.supabaseUrl || inlineConfig.supabaseUrl || DEFAULT_PROJECT_URL,
      anonKey: bridgeConfig.anonKey || bridgeConfig.supabaseKey || inlineConfig.anonKey || inlineConfig.supabaseKey || DEFAULT_ANON_KEY,
    };
  };

  const config = getConfig();
  const matrix = window.MatrixSession;
  const statusElement = document.getElementById('oauth-status');
  const client = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(config.supabaseUrl, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : null;

  const setStatus = (message, isError = false) => {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.style.color = isError ? '#fca5a5' : '#c6d4cf';
  };

  const redirectToLogin = () => {
    window.location.replace('/log-in-or-create-account.html?mode=login');
  };

  const redirectToIndex = () => {
    window.location.replace('/index.html');
  };

  const getOAuthErrorMessage = () => {
    const url = new URL(window.location.href);
    return url.searchParams.get('error_description') || url.searchParams.get('error') || '';
  };

  const finishOAuthFlow = async () => {
    if (!matrix || !client) {
      setStatus('The authentication client is not available on this page.', true);
      return;
    }

    const oauthError = getOAuthErrorMessage();
    if (oauthError) {
      setStatus(oauthError, true);
      window.setTimeout(redirectToLogin, 1800);
      return;
    }

    const code = new URL(window.location.href).searchParams.get('code');
    if (!code) {
      setStatus('The Google callback did not include an authorization code.', true);
      window.setTimeout(redirectToLogin, 1800);
      return;
    }

    try {
      setStatus('Signing you in with Google...');
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;

      const user = data && data.user
        ? data.user
        : data && data.session && data.session.user
          ? data.session.user
          : null;

      matrix.startAuthenticatedSession(user || {}, { provider: 'google' });
      matrix.clearPendingAuth();
      setStatus('Google sign-in completed. Redirecting...');
      window.setTimeout(redirectToIndex, 250);
    } catch (error) {
      setStatus(error && error.message ? error.message : 'Unable to complete Google sign-in.', true);
      window.setTimeout(redirectToLogin, 2200);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finishOAuthFlow, { once: true });
  } else {
    finishOAuthFlow();
  }
})();
