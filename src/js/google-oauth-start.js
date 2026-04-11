
(() => {
  const statusNode = document.getElementById('oauth-start-status');
  const DEFAULT_PROJECT_URL = 'https://xkkrbnxqtrfjzbasvocz.supabase.co';
  const DEFAULT_ANON_KEY = 'sb_publishable_MhEwBmkNjTFAMSZniI5XzQ_45tNsIYX';
  const SUPABASE_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
  ];

  const setStatus = (message, isError = false) => {
    if (!(statusNode instanceof HTMLElement)) return;
    statusNode.textContent = String(message || '');
    statusNode.classList.toggle('error', Boolean(isError));
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

  const isSafeSupabaseUrl = (value) => {
    try {
      const parsed = new URL(String(value || '').trim());
      return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && /^127\.0\.0\.1$|^localhost$/i.test(parsed.hostname));
    } catch (_error) {
      return false;
    }
  };

  const normalizeConfig = (raw = {}) => {
    const supabaseUrl = String(raw.supabaseUrl || '').trim();
    const anonKey = String(raw.anonKey || raw.supabaseKey || '').trim();
    return {
      supabaseUrl: isSafeSupabaseUrl(supabaseUrl) ? supabaseUrl : '',
      anonKey: anonKey && anonKey.length <= 4096 ? anonKey : ''
    };
  };

  const getAuthConfig = () => {
    const bridgeConfig = window.electronAPI && window.electronAPI.authConfig
      ? normalizeConfig(window.electronAPI.authConfig)
      : { supabaseUrl: '', anonKey: '' };
    if (bridgeConfig.supabaseUrl && bridgeConfig.anonKey) {
      return bridgeConfig;
    }

    const inlineConfig = normalizeConfig(window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {});
    if (inlineConfig.supabaseUrl && inlineConfig.anonKey) {
      return inlineConfig;
    }

    return {
      supabaseUrl: DEFAULT_PROJECT_URL,
      anonKey: DEFAULT_ANON_KEY
    };
  };

  const getMode = () => {
    try {
      const value = new URLSearchParams(window.location.search).get('mode');
      return value === 'signup' ? 'signup' : 'login';
    } catch (_error) {
      return 'login';
    }
  };

  const start = async () => {
    try {
      const { supabaseUrl, anonKey } = getAuthConfig();
      if (!supabaseUrl || !anonKey) {
        throw new Error('Authentication is not configured for Google sign-in.');
      }

      const supabaseModule = await ensureSupabase();
      const client = supabaseModule.createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce'
        }
      });

      const callbackUrl = `${window.location.origin}/auth/callback.html`;
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) throw error;
      if (!data || !data.url) {
        throw new Error('Supabase did not return a Google sign-in URL.');
      }

      window.name = 'matrix-google-auth-popup';
      window.__matrixOauthStartMode = getMode();
      window.location.replace(data.url);
    } catch (error) {
      setStatus(error && error.message ? error.message : 'Unable to open Google sign-in.', true);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
