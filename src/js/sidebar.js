// src/js/sidebar.js
(() => {
  const SIDEBAR_STORAGE_KEY = 'stage-slideover-sidebar-state';
  const SIDEBAR_COOKIE_KEY = 'stage_slideover_sidebar_state';
  const MOBILE_BREAKPOINT = '(max-width: 767px)';
  const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  const VALID_SIDEBAR_STATES = new Set(['expanded', 'collapsed']);

  const getSerialization = () => window.MatrixSession && window.MatrixSession.SerializationSecurity
    ? window.MatrixSession.SerializationSecurity
    : null;

  const normalizeSidebarStateRecord = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const state = VALID_SIDEBAR_STATES.has(payload.state) ? payload.state : '';
    if (!state) {
      return null;
    }

    return {
      state,
      updatedAt: Number.isFinite(payload.updatedAt) ? Number(payload.updatedAt) : Date.now()
    };
  };

  const readSidebarStateCookie = () => {
    const serialization = getSerialization();
    if (serialization) {
      const record = serialization.readCookie(SIDEBAR_COOKIE_KEY, {
        type: 'stage.sidebar.state.cookie',
        normalize: normalizeSidebarStateRecord
      });
      if (record && VALID_SIDEBAR_STATES.has(record.state)) {
        return record.state;
      }
    }

    const cookies = String(document.cookie || '').split(';');
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (!cookie.startsWith(`${SIDEBAR_COOKIE_KEY}=`)) {
        continue;
      }

      const value = decodeURIComponent(cookie.slice(SIDEBAR_COOKIE_KEY.length + 1));
      if (VALID_SIDEBAR_STATES.has(value)) {
        return value;
      }
    }

    return null;
  };

  const readPersistedSidebarState = () => {
    const serialization = getSerialization();
    if (serialization) {
      const record = serialization.readStorage(SIDEBAR_STORAGE_KEY, {
        storage: 'local',
        type: 'stage.sidebar.state',
        normalize: normalizeSidebarStateRecord
      });
      if (record && VALID_SIDEBAR_STATES.has(record.state)) {
        return record.state;
      }
    }

    try {
      const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (VALID_SIDEBAR_STATES.has(storedValue)) {
        return storedValue;
      }
    } catch (error) {
      // ignore storage failures
    }

    return readSidebarStateCookie();
  };

  const persistSidebarState = (state) => {
    if (!VALID_SIDEBAR_STATES.has(state)) {
      return;
    }

    const payload = { state, updatedAt: Date.now() };
    const serialization = getSerialization();
    if (serialization) {
      serialization.writeStorage(SIDEBAR_STORAGE_KEY, payload, {
        storage: 'local',
        type: 'stage.sidebar.state',
        normalize: normalizeSidebarStateRecord
      });
      serialization.writeCookie(SIDEBAR_COOKIE_KEY, payload, {
        type: 'stage.sidebar.state.cookie',
        normalize: normalizeSidebarStateRecord,
        maxAgeSeconds: SIDEBAR_COOKIE_MAX_AGE,
        sameSite: 'Lax'
      });
      return;
    }

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
    } catch (error) {
      // ignore storage failures
    }

    document.cookie = `${SIDEBAR_COOKIE_KEY}=${encodeURIComponent(state)}; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  };

  const syncRootSidebarState = (state) => {
    if (VALID_SIDEBAR_STATES.has(state)) {
      document.documentElement.setAttribute('data-sidebar-desktop-state', state);
    } else {
      document.documentElement.removeAttribute('data-sidebar-desktop-state');
    }
  };



  const getMatrixApi = () =>
    window.MatrixSession && typeof window.MatrixSession === 'object'
      ? window.MatrixSession
      : null;

  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const createRadixToken = (prefix = 'r') => `${prefix}_${Math.random().toString(36).slice(2, 6)}_`;

  const deriveInitialsFromSession = (session) => {
    const explicitInitials = normalizeWhitespace(session?.initials || '');
    if (explicitInitials) {
      return explicitInitials.slice(0, 2).toUpperCase();
    }

    const name = normalizeWhitespace(session?.displayName || '');
    const nameTokens = name
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/gi, ''))
      .filter(Boolean);
    if (nameTokens.length >= 2) {
      return `${nameTokens[0][0]}${nameTokens[nameTokens.length - 1][0]}`.toUpperCase();
    }
    if (nameTokens.length === 1 && nameTokens[0].length >= 2) {
      return nameTokens[0].slice(0, 2).toUpperCase();
    }

    const emailLocalPart = String(session?.email || '').split('@')[0].replace(/[^a-z0-9]/gi, '');
    if (emailLocalPart.length >= 2) {
      return emailLocalPart.slice(0, 2).toUpperCase();
    }
    if (emailLocalPart.length === 1) {
      return `${emailLocalPart[0]}X`.toUpperCase();
    }
    return 'U';
  };

  const getSessionProfile = () => {
    const session = getMatrixApi()?.getSession?.() || null;
    const isAuthenticated = session?.role === 'authenticated';
    const displayName = normalizeWhitespace(session?.displayName || '') || normalizeWhitespace(session?.email || '') || 'Account';
    const planLabel = normalizeWhitespace(session?.planLabel || '') || 'Free';
    const avatarUrl = normalizeWhitespace(session?.avatarUrl || '');
    const initials = deriveInitialsFromSession(session);

    return {
      session,
      isAuthenticated,
      displayName,
      planLabel,
      avatarUrl,
      initials,
      email: normalizeWhitespace(session?.email || '')
    };
  };

  const syncAuthSurfaceState = () => {
    const profile = getSessionProfile();
    document.documentElement.setAttribute('data-matrix-role', profile.session?.role || 'public');
    if (profile.isAuthenticated) {
      document.documentElement.setAttribute('data-authenticated-session', 'true');
    } else {
      document.documentElement.removeAttribute('data-authenticated-session');
    }
    return profile;
  };

  const clearClientSession = () => {
    const matrix = getMatrixApi();
    matrix?.clearPendingAuth?.();
    matrix?.clearSession?.();
  };

  const readInlineConfig = () => window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {};
  const normalizeAuthConfig = (raw = {}) => ({
    supabaseUrl: String(raw.supabaseUrl || '').trim(),
    anonKey: String(raw.anonKey || raw.supabaseKey || '').trim()
  });

  const loadSupabaseAuthConfig = async () => {
    const bridgeConfig = normalizeAuthConfig(window.electronAPI && window.electronAPI.authConfig ? window.electronAPI.authConfig : {});
    if (bridgeConfig.supabaseUrl && bridgeConfig.anonKey) {
      return bridgeConfig;
    }

    const inlineConfig = normalizeAuthConfig(readInlineConfig());
    if (inlineConfig.supabaseUrl && inlineConfig.anonKey) {
      return inlineConfig;
    }

    const candidates = ['/auth.config.json', '/matrix-auth.config.json', 'auth.config.json', 'matrix-auth.config.json'];
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) continue;
        const payload = normalizeAuthConfig(await response.json());
        if (payload.supabaseUrl && payload.anonKey) {
          window.__MATRIX_SUPABASE_CONFIG__ = {
            ...(window.__MATRIX_SUPABASE_CONFIG__ || {}),
            ...payload
          };
          return payload;
        }
      } catch (_error) {
        // noop
      }
    }

    return { supabaseUrl: '', anonKey: '' };
  };

  const signOutSupabaseSession = async () => {
    try {
      if (!(window.supabase && typeof window.supabase.createClient === 'function')) {
        return;
      }
      const { supabaseUrl, anonKey } = await loadSupabaseAuthConfig();
      if (!supabaseUrl || !anonKey) {
        return;
      }
      const client = window.supabase.createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'pkce'
        }
      });
      await client.auth.signOut({ scope: 'local' });
    } catch (_error) {
      // noop
    }
  };

  const getCollapsedTriggerInnerMarkup = (profile) => {
    if (profile.isAuthenticated && profile.avatarUrl) {
      return `
        <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon-lg">
          <div class="flex overflow-hidden rounded-full select-none bg-gray-500/30 h-6 w-6 shrink-0">
            <img alt="Profile image" class="h-6 w-6 shrink-0 object-cover" referrerpolicy="no-referrer" src="${escapeHtml(profile.avatarUrl)}">
          </div>
        </div>
      `;
    }

    if (profile.isAuthenticated) {
      return `
        <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon-lg">
          <span aria-hidden="true" class="bg-token-text-tertiary/20 text-token-text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium uppercase leading-none">${escapeHtml(profile.initials)}</span>
        </div>
      `;
    }

    return `
      <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon-lg">
        <span aria-hidden="true" class="bg-token-text-tertiary/20 text-token-text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon-sm"><use href="#d13764" fill="currentColor"></use></svg>
        </span>
      </div>
    `;
  };

  const buildPublicProfileMenuMarkup = () => `
    <div class="flex flex-col">
      <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/chatgpt/pricing/" target="_blank">
        <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#ac4202" fill="currentColor"></use></svg></div>See plans and pricing</div>
        <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
      </a>
      <div role="menuitem" tabindex="0" class="group __menu-item hoverable gap-1.5" data-testid="settings-menu-item" data-profile-menu-action="settings" data-orientation="vertical" data-radix-collection-item="">
        <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#44c6db" fill="currentColor"></use></svg></div>Settings
      </div>
      <div role="separator" aria-orientation="horizontal" class="bg-token-border-default h-px mx-4 my-1"></div>
      <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://help.openai.com/en/collections/3742473-chatgpt" target="_blank">
        <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#975ff3" fill="currentColor"></use></svg></div>Help center</div>
        <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
      </a>
      <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://help.openai.com/en/articles/6825453-chatgpt-release-notes" target="_blank">
        <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#4a920d" fill="currentColor"></use></svg></div>Release notes</div>
        <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
      </a>
      <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/policies" target="_blank">
        <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#c6a95f" fill="currentColor"></use></svg></div>Terms &amp; policies</div>
        <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
      </a>
      <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/chatgpt/download" target="_blank">
        <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#b834c9" fill="currentColor"></use></svg></div>Download apps</div>
        <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
      </a>
    </div>
  `;

  const buildAuthenticatedProfileMenuMarkup = (profile) => {
    const avatarMarkup = profile.avatarUrl
      ? `<div class="flex overflow-hidden rounded-full select-none bg-gray-500/30 h-6 w-6 shrink-0"><img alt="Profile image" class="h-6 w-6 shrink-0 object-cover" referrerpolicy="no-referrer" src="${escapeHtml(profile.avatarUrl)}"></div>`
      : `<span aria-hidden="true" class="bg-token-text-tertiary/20 text-token-text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium uppercase leading-none">${escapeHtml(profile.initials)}</span>`;

    const accountTriggerId = createRadixToken();
    const accountMenuId = createRadixToken();
    const helpTriggerId = createRadixToken();
    const helpMenuId = createRadixToken();
    const logoutTriggerId = createRadixToken();
    const logoutMenuId = createRadixToken();

    return `
      <div class="flex flex-col">
        <div role="menuitem" id="radix-${accountTriggerId}" aria-haspopup="menu" aria-expanded="false" aria-controls="radix-${accountMenuId}" data-state="closed" tabindex="0" data-has-submenu="" class="group __menu-item hoverable bg-transparent! hover:bg-token-interactive-bg-secondary-selected! keyboard-focused:bg-token-interactive-bg-secondary-selected! data-[state=open]:bg-token-interactive-bg-secondary-selected!" data-profile-menu-action="account" data-orientation="vertical" data-radix-collection-item="">
          <div class="flex min-w-0 items-center gap-1.5">
            <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">${avatarMarkup}</div>
            <div class="min-w-0">
              <div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">${escapeHtml(profile.displayName)}</div></div>
              <div class="not-group-data-disabled:text-token-text-tertiary leading-dense mb-0.5 text-xs whitespace-normal group-data-sheet-item:mt-0.5 group-data-sheet-item:mb-0 dark:group-hover:text-token-text-secondary dark:group-focus-visible:text-token-text-secondary dark:group-data-[highlighted]:text-token-text-secondary dark:group-data-[state=open]:text-token-text-secondary"><span class="inline-flex items-center gap-1 truncate text-xs font-normal text-token-text-secondary" dir="auto"><span>${escapeHtml(profile.planLabel)}</span></span></div>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm -me-0.25"><use href="#d3876b" fill="currentColor"></use></svg>
        </div>
        <div role="menuitem" tabindex="0" class="group __menu-item hoverable gap-1.5" data-profile-menu-action="upgrade-plan" data-orientation="vertical" data-radix-collection-item=""><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon-sm"><use href="#7ad2ce" fill="currentColor"></use></svg></div>Upgrade plan</div>
        <div role="menuitem" tabindex="0" class="group __menu-item hoverable gap-1.5" data-profile-menu-action="personalization" data-orientation="vertical" data-radix-collection-item=""><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#306b75" fill="currentColor"></use></svg></div>Personalization</div>
        <div role="menuitem" tabindex="0" class="group __menu-item hoverable gap-1.5" data-profile-menu-action="profile" data-orientation="vertical" data-radix-collection-item=""><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#d13764" fill="currentColor"></use></svg></div>Profile</div>
        <div role="menuitem" tabindex="0" class="group __menu-item hoverable gap-1.5" data-testid="settings-menu-item" data-profile-menu-action="settings" data-orientation="vertical" data-radix-collection-item=""><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#44c6db" fill="currentColor"></use></svg></div>Settings</div>
        <div role="separator" aria-orientation="horizontal" class="bg-token-border-default h-px mx-4 my-1"></div>
        <div role="menuitem" id="radix-${helpTriggerId}" aria-haspopup="menu" aria-expanded="false" aria-controls="radix-${helpMenuId}" data-state="closed" tabindex="0" data-has-submenu="" class="group __menu-item hoverable" data-profile-menu-action="help" data-orientation="vertical" data-radix-collection-item="">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#ab0e8b" fill="currentColor"></use></svg></div>Help</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm -me-0.25"><use href="#d3876b" fill="currentColor"></use></svg>
        </div>
        <div role="menuitem" id="radix-${logoutTriggerId}" aria-haspopup="menu" aria-expanded="false" aria-controls="radix-${logoutMenuId}" data-state="closed" tabindex="0" data-has-submenu="" class="group __menu-item hoverable" data-testid="log-out-menu-item" data-profile-menu-action="logout" data-orientation="vertical" data-radix-collection-item="">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" data-rtl-flip="" class="icon"><use href="#06188d" fill="currentColor"></use></svg></div>Log out</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm -me-0.25"><use href="#d3876b" fill="currentColor"></use></svg>
        </div>
      </div>
    `;
  };


  const initSidebarToggle = () => {
    const sidebar = document.getElementById('stage-slideover-sidebar');
    const tinyBar = document.getElementById('stage-sidebar-tiny-bar');
    const closeButton = document.querySelector('[data-testid="close-sidebar-button"][aria-controls="stage-slideover-sidebar"]');
    const openButton = tinyBar?.querySelector('button[aria-controls="stage-slideover-sidebar"][aria-label="Open sidebar"]');
    const mobileOpenButton = document.querySelector('[data-testid="open-sidebar-button"][aria-controls="stage-slideover-sidebar"]');
    const mobileQuery = window.matchMedia(MOBILE_BREAKPOINT);

    if (!sidebar || !tinyBar || !closeButton || !openButton) {
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-sidebar-mobile-backdrop', '');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.zIndex = '59';
    backdrop.style.background = 'rgba(0, 0, 0, 0.55)';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
    backdrop.style.transition = 'opacity 150ms ease';
    const backdropHost = sidebar.parentElement || document.body;
    if (backdropHost === document.body) {
      document.body.appendChild(backdrop);
    } else {
      backdropHost.insertBefore(backdrop, sidebar);
    }

    const column = sidebar.firstElementChild;
    const expandedPane = column
      ? Array.from(column.children).find((element) => element !== tinyBar && element instanceof HTMLElement)
      : null;

    if (!(expandedPane instanceof HTMLElement)) {
      return;
    }

    const scrollNav = expandedPane.querySelector('nav[aria-label="Chat history"]');
    const mobileOptionalSection = expandedPane.querySelector('[class*="[@media(max-height:700px)]:hidden"]');
    const navGrowSpacers = scrollNav
      ? Array.from(scrollNav.children).filter((element) =>
          element instanceof HTMLElement && (
            element.classList.contains('grow') ||
            element.classList.contains('flex-grow')
          )
        )
      : [];

    if (sidebar.dataset.sidebarToggleBound === 'true') {
      return;
    }
    sidebar.dataset.sidebarToggleBound = 'true';

    const syncStateContainer = tinyBar.querySelector('[data-state]');
    const fullStateContainer = closeButton.closest('[data-state]');

    let desktopExpanded = true;
    let mobileOpen = false;

    const isMobile = () => mobileQuery.matches;

    const setDesktopState = (expanded, options = {}) => {
      const { persist = true, focusTarget = null } = options;

      desktopExpanded = expanded;
      syncRootSidebarState(expanded ? 'expanded' : 'collapsed');
      sidebar.dataset.sidebarState = expanded ? 'expanded' : 'collapsed';
      sidebar.dataset.sidebarMode = 'desktop';
      sidebar.style.display = '';
      sidebar.style.position = '';
      sidebar.style.inset = '';
      sidebar.style.height = '';
      sidebar.style.zIndex = '';
      sidebar.style.boxShadow = '';
      sidebar.style.width = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.minWidth = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.maxWidth = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.backgroundColor = expanded
        ? 'var(--sidebar-bg, var(--bg-elevated-secondary))'
        : 'var(--sidebar-bg, var(--bg-primary))';

      backdrop.hidden = true;
      backdrop.style.opacity = '0';
      backdrop.style.pointerEvents = 'none';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      tinyBar.style.display = '';
      tinyBar.style.opacity = expanded ? '0' : '1';
      tinyBar.style.pointerEvents = expanded ? 'none' : 'auto';
      if (expanded) {
        tinyBar.setAttribute('inert', '');
        tinyBar.setAttribute('aria-hidden', 'true');
      } else {
        tinyBar.removeAttribute('inert');
        tinyBar.removeAttribute('aria-hidden');
      }

      expandedPane.style.display = '';
      expandedPane.style.opacity = expanded ? '1' : '0';
      expandedPane.style.pointerEvents = expanded ? 'auto' : 'none';
      expandedPane.style.visibility = expanded ? 'visible' : 'hidden';
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.overflowY = '';
        scrollNav.style.webkitOverflowScrolling = '';
        scrollNav.style.overscrollBehavior = '';
      }
      if (mobileOptionalSection instanceof HTMLElement) {
        mobileOptionalSection.style.display = '';
      }
      navGrowSpacers.forEach((spacer) => {
        spacer.style.display = '';
        spacer.style.flexGrow = '';
        spacer.style.minHeight = '';
      });
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.justifyContent = '';
      }
      if (expanded) {
        expandedPane.removeAttribute('aria-hidden');
        expandedPane.removeAttribute('inert');
      } else {
        expandedPane.setAttribute('aria-hidden', 'true');
        expandedPane.setAttribute('inert', '');
      }

      closeButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      closeButton.setAttribute('aria-label', expanded ? 'Close sidebar' : 'Open sidebar');
      openButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (mobileOpenButton) {
        mobileOpenButton.setAttribute('aria-expanded', 'false');
      }

      if (syncStateContainer) {
        syncStateContainer.setAttribute('data-state', expanded ? 'closed' : 'open');
      }
      if (fullStateContainer) {
        fullStateContainer.setAttribute('data-state', expanded ? 'open' : 'closed');
      }
      closeButton.setAttribute('data-state', expanded ? 'open' : 'closed');

      if (persist) {
        persistSidebarState(expanded ? 'expanded' : 'collapsed');
      }

      if (focusTarget instanceof HTMLElement) {
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
    };

    const setMobileState = (open, options = {}) => {
      const { focusTarget = null } = options;

      mobileOpen = open;
      sidebar.dataset.sidebarState = open ? 'expanded' : 'collapsed';
      sidebar.dataset.sidebarMode = 'mobile';
      sidebar.style.position = open ? 'fixed' : '';
      sidebar.style.inset = open ? '0 auto 0 0' : '';
      sidebar.style.height = open ? '100dvh' : '';
      sidebar.style.zIndex = open ? '61' : '';
      sidebar.style.boxShadow = open ? 'var(--sharp-edge-side-shadow, 0 0 0 1px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.35))' : '';
      sidebar.style.width = 'var(--sidebar-width)';
      sidebar.style.minWidth = 'var(--sidebar-width)';
      sidebar.style.maxWidth = 'min(100vw, var(--sidebar-width))';
      sidebar.style.backgroundColor = 'var(--sidebar-bg, var(--bg-elevated-secondary))';
      sidebar.style.display = open ? 'block' : 'none';

      backdrop.hidden = !open;
      backdrop.style.opacity = open ? '1' : '0';
      backdrop.style.pointerEvents = open ? 'auto' : 'none';
      document.documentElement.style.overflow = open ? 'hidden' : '';
      document.body.style.overflow = open ? 'hidden' : '';

      tinyBar.style.display = 'none';
      tinyBar.style.opacity = '0';
      tinyBar.style.pointerEvents = 'none';
      tinyBar.setAttribute('inert', '');
      tinyBar.setAttribute('aria-hidden', 'true');

      expandedPane.style.display = 'block';
      expandedPane.style.opacity = open ? '1' : '0';
      expandedPane.style.pointerEvents = open ? 'auto' : 'none';
      expandedPane.style.visibility = open ? 'visible' : 'hidden';
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.overflowY = 'auto';
        scrollNav.style.webkitOverflowScrolling = 'touch';
        scrollNav.style.overscrollBehavior = 'contain';
      }
      if (mobileOptionalSection instanceof HTMLElement) {
        mobileOptionalSection.style.display = 'block';
      }
      navGrowSpacers.forEach((spacer) => {
        spacer.style.display = 'none';
        spacer.style.flexGrow = '0';
        spacer.style.minHeight = '0';
      });
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.justifyContent = 'flex-start';
      }
      if (open) {
        expandedPane.removeAttribute('aria-hidden');
        expandedPane.removeAttribute('inert');
      } else {
        expandedPane.setAttribute('aria-hidden', 'true');
        expandedPane.setAttribute('inert', '');
      }

      closeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      closeButton.setAttribute('aria-label', 'Close sidebar');
      openButton.setAttribute('aria-expanded', 'false');
      if (mobileOpenButton) {
        mobileOpenButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      if (syncStateContainer) {
        syncStateContainer.setAttribute('data-state', 'closed');
      }
      if (fullStateContainer) {
        fullStateContainer.setAttribute('data-state', open ? 'open' : 'closed');
      }
      closeButton.setAttribute('data-state', open ? 'open' : 'closed');

      if (focusTarget instanceof HTMLElement) {
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
    };

    const syncResponsiveState = () => {
      if (isMobile()) {
        setMobileState(mobileOpen, { focusTarget: null });
      } else {
        setDesktopState(desktopExpanded, { persist: false, focusTarget: null });
      }
    };

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (isMobile()) {
        setMobileState(false, { focusTarget: mobileOpenButton });
      } else {
        setDesktopState(false, { focusTarget: openButton });
      }
    });

    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      setDesktopState(true, { focusTarget: closeButton });
    });

    if (mobileOpenButton) {
      mobileOpenButton.addEventListener('click', (event) => {
        event.preventDefault();
        setMobileState(!mobileOpen, { focusTarget: mobileOpen ? mobileOpenButton : closeButton });
      });
    }

    backdrop.addEventListener('click', () => {
      if (isMobile() && mobileOpen) {
        setMobileState(false, { focusTarget: mobileOpenButton });
      }
    });

    tinyBar.addEventListener('dblclick', () => {
      if (!isMobile() && sidebar.dataset.sidebarState === 'collapsed') {
        setDesktopState(true, { focusTarget: closeButton });
      }
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\' && !isMobile()) {
        event.preventDefault();
        setDesktopState(sidebar.dataset.sidebarState === 'collapsed', {
          focusTarget: sidebar.dataset.sidebarState === 'collapsed' ? closeButton : openButton
        });
      }

      if (event.key === 'Escape' && isMobile() && mobileOpen) {
        event.preventDefault();
        setMobileState(false, { focusTarget: mobileOpenButton });
      }
    });

    const persistedState = readPersistedSidebarState();
    const isInitiallyCollapsedInMarkup = (
      sidebar.style.width === 'var(--sidebar-rail-width)' ||
      sidebar.dataset.sidebarState === 'collapsed' ||
      closeButton.getAttribute('aria-expanded') === 'false'
    );

    desktopExpanded = persistedState
      ? persistedState === 'expanded'
      : !isInitiallyCollapsedInMarkup;
    mobileOpen = false;
    syncRootSidebarState(desktopExpanded ? 'expanded' : 'collapsed');
    persistSidebarState(desktopExpanded ? 'expanded' : 'collapsed');
    syncResponsiveState();

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncResponsiveState);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(syncResponsiveState);
    }

    window.addEventListener('resize', syncResponsiveState, { passive: true });
  };


  const initSidebarHelpMenu = () => {
    const helpLabel = Array.from(document.querySelectorAll('[data-sidebar-item="true"] .truncate')).find((node) =>
      node.textContent.trim() === 'Help'
    );
    const helpTrigger = helpLabel?.closest('[data-sidebar-item="true"]');
    const sidebar = document.getElementById('stage-slideover-sidebar');

    if (!helpTrigger || !sidebar || helpTrigger.dataset.helpMenuBound === 'true') {
      return;
    }
    helpTrigger.dataset.helpMenuBound = 'true';

    const triggerId = helpTrigger.id || `radix-help-trigger-${Math.random().toString(36).slice(2)}`;
    const menuId = `radix-help-menu-${Math.random().toString(36).slice(2)}`;
    helpTrigger.id = triggerId;
    helpTrigger.setAttribute('role', 'button');
    helpTrigger.setAttribute('tabindex', '0');
    helpTrigger.setAttribute('aria-haspopup', 'menu');
    helpTrigger.setAttribute('aria-expanded', 'false');
    helpTrigger.setAttribute('data-state', 'closed');

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.setAttribute('dir', 'ltr');
    wrapper.hidden = true;
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate(0px, 0px)';
    wrapper.style.minWidth = 'max-content';
    wrapper.style.zIndex = '50';
    wrapper.style.pointerEvents = 'none';

    wrapper.innerHTML = `
      <div
        data-side="top"
        data-align="start"
        role="menu"
        aria-orientation="vertical"
        data-state="closed"
        data-radix-menu-content=""
        dir="ltr"
        id="${menuId}"
        aria-labelledby="${triggerId}"
        class="z-50 max-w-xs rounded-2xl popover bg-token-main-surface-primary dark:bg-[#353535] shadow-long py-1.5 data-[unbound-width]:min-w-[unset] data-[custom-padding]:py-0 MA-gxq_content [--trigger-width:calc(var(--radix-dropdown-menu-trigger-width)-2*var(--radix-align-offset))] min-w-(--trigger-width) max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto select-none min-w-[calc(var(--sidebar-width)-12px)]"
        tabindex="-1"
        data-orientation="vertical"
        style="outline: none; --radix-dropdown-menu-content-transform-origin: var(--radix-popper-transform-origin); --radix-dropdown-menu-content-available-width: var(--radix-popper-available-width); --radix-dropdown-menu-content-available-height: var(--radix-popper-available-height); --radix-dropdown-menu-trigger-width: var(--radix-popper-anchor-width); --radix-dropdown-menu-trigger-height: var(--radix-popper-anchor-height); pointer-events: auto;"
      >
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://help.openai.com/en/collections/3742473-chatgpt" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#975ff3" fill="currentColor"></use></svg></div>Help center</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://help.openai.com/en/articles/6825453-chatgpt-release-notes" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#4a920d" fill="currentColor"></use></svg></div>Release notes</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/policies" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#c6a95f" fill="currentColor"></use></svg></div>Terms &amp; policies</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/chatgpt/download" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#b834c9" fill="currentColor"></use></svg></div>Download apps</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
      </div>
    `;

    document.body.appendChild(wrapper);
    const menu = wrapper.firstElementChild;
    menu.style.pointerEvents = 'auto';
    menu.style.touchAction = 'pan-y';
    menu.style.webkitOverflowScrolling = 'touch';
    menu.style.overscrollBehavior = 'contain';
    const menuItems = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
    const allowedSidebarLoginButton = sidebar.querySelector('button[onclick*="login.html"]');
    let isOpen = false;
    let helpTriggerBackgroundSnapshot = '';

    const updateSidebarInteractivity = (blocked) => {
      const interactiveTargets = Array.from(sidebar.querySelectorAll('[data-sidebar-item="true"], button, a, [role="button"]'));

      interactiveTargets.forEach((element) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }

        const shouldAllow = (
          element === helpTrigger ||
          helpTrigger.contains(element) ||
          element === allowedSidebarLoginButton ||
          (allowedSidebarLoginButton instanceof HTMLElement && allowedSidebarLoginButton.contains(element))
        );

        if (shouldAllow) {
          element.style.pointerEvents = '';
          element.style.cursor = '';
          return;
        }

        if (blocked) {
          element.style.pointerEvents = 'none';
          element.style.cursor = 'default';
        } else {
          element.style.pointerEvents = '';
          element.style.cursor = '';
        }
      });
    };

    const applyHelpTriggerOpenState = () => {
      const computed = window.getComputedStyle(helpTrigger);
      const openBackground = computed.getPropertyValue('--menu-item-open').trim();
      helpTriggerBackgroundSnapshot = helpTrigger.style.backgroundColor;
      if (openBackground) {
        helpTrigger.style.backgroundColor = openBackground;
      }
    };

    const clearHelpTriggerOpenState = () => {
      helpTrigger.style.backgroundColor = helpTriggerBackgroundSnapshot || '';
      helpTriggerBackgroundSnapshot = '';
    };

    const updatePosition = () => {
      wrapper.hidden = false;
      const sidebarRect = sidebar.getBoundingClientRect();
      const triggerRect = helpTrigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 6;
      const gap = 4;
      const mobile = window.matchMedia(MOBILE_BREAKPOINT).matches;
      const preferredX = sidebarRect.left + margin;
      const maxViewportX = window.innerWidth - menuRect.width - margin;
      const x = Math.round(Math.max(margin, Math.min(preferredX, maxViewportX)));
      const preferredY = triggerRect.top - menuRect.height - gap;
      const maxViewportY = window.innerHeight - menuRect.height - margin;
      const y = Math.round(Math.max(margin, Math.min(preferredY, maxViewportY)));
      const availableWidth = Math.max(0, (mobile ? sidebarRect.right : window.innerWidth) - x);
      const availableHeight = Math.max(0, triggerRect.top - margin);
      const transformOriginY = Math.max(0, Math.round(triggerRect.top - y));

      wrapper.style.zIndex = mobile ? '75' : '50';
      wrapper.style.willChange = mobile ? 'transform' : '';
      wrapper.style.pointerEvents = isOpen ? 'auto' : 'none';
      wrapper.style.transform = `translate(${x}px, ${y}px)`;
      menu.style.maxHeight = `${availableHeight}px`;
      menu.style.webkitOverflowScrolling = 'touch';
      menu.style.overscrollBehavior = mobile ? 'contain' : 'auto';
      menu.style.touchAction = mobile ? 'pan-y' : 'auto';
      wrapper.style.setProperty('--radix-popper-transform-origin', `0% ${transformOriginY}px`);
      wrapper.style.setProperty('--radix-popper-available-width', `${availableWidth}px`);
      wrapper.style.setProperty('--radix-popper-available-height', `${availableHeight}px`);
      wrapper.style.setProperty('--radix-popper-anchor-width', `${Math.round(triggerRect.width)}px`);
      wrapper.style.setProperty('--radix-popper-anchor-height', `${Math.round(triggerRect.height)}px`);
    };

    const closeMenu = ({ focusTrigger = false } = {}) => {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      document.documentElement.removeAttribute('data-help-menu-open');
      document.dispatchEvent(new CustomEvent('stage:help-menu-state', {
        detail: { open: false }
      }));
      clearHelpTriggerOpenState();
      updateSidebarInteractivity(false);
      wrapper.hidden = true;
      wrapper.style.pointerEvents = 'none';
      menu.setAttribute('data-state', 'closed');
      helpTrigger.setAttribute('aria-expanded', 'false');
      helpTrigger.setAttribute('data-state', 'closed');
      if (focusTrigger) {
        window.requestAnimationFrame(() => helpTrigger.focus({ preventScroll: true }));
      }
    };

    const openMenu = () => {
      if (isOpen) {
        return;
      }
      isOpen = true;
      document.documentElement.setAttribute('data-help-menu-open', 'true');
      document.dispatchEvent(new CustomEvent('stage:help-menu-state', {
        detail: { open: true }
      }));
      applyHelpTriggerOpenState();
      document.dispatchEvent(new CustomEvent('stage:close-click-popovers', {
        detail: { source: 'help-menu', owner: 'help-menu' }
      }));
      updateSidebarInteractivity(true);
      wrapper.hidden = false;
      wrapper.style.pointerEvents = 'auto';
      menu.setAttribute('data-state', 'open');
      helpTrigger.setAttribute('aria-expanded', 'true');
      helpTrigger.setAttribute('data-state', 'open');
      updatePosition();
      menuItems().forEach((item) => {
        item.style.touchAction = 'manipulation';
      });
    };

    const toggleMenu = () => {
      if (isOpen) {
        closeMenu({ focusTrigger: false });
      } else {
        openMenu();
      }
    };

    helpTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });

    helpTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!isOpen) {
          openMenu();
          window.requestAnimationFrame(() => {
            menuItems()[0]?.focus({ preventScroll: true });
          });
        } else {
          menuItems()[0]?.focus({ preventScroll: true });
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    menu.addEventListener('keydown', (event) => {
      const items = menuItems();
      const currentIndex = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0]?.focus({ preventScroll: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1]?.focus({ preventScroll: true });
      } else if (event.key === 'Tab') {
        closeMenu({ focusTrigger: false });
      }
    });

    menu.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    menu.addEventListener('pointerup', (event) => {
      event.stopPropagation();
    });

    menu.addEventListener('touchstart', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('touchmove', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('touchend', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('scroll', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('click', (event) => {
      const item = event.target.closest('[role="menuitem"]');
      if (!item) {
        return;
      }

      const mobile = window.matchMedia(MOBILE_BREAKPOINT).matches;
      if (mobile) {
        const href = item.getAttribute('href');
        const target = item.getAttribute('target') || '_self';
        event.preventDefault();
        event.stopPropagation();
        closeMenu({ focusTrigger: false });
        if (href) {
          if (target === '_blank') {
            window.open(href, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = href;
          }
        }
        return;
      }

      closeMenu({ focusTrigger: false });
    });

    document.addEventListener('pointerdown', (event) => {
      if (!isOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!wrapper.contains(target) && !helpTrigger.contains(target)) {
        closeMenu({ focusTrigger: false });
      }
    });

    window.addEventListener('resize', () => {
      if (isOpen) {
        updatePosition();
      }
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (isOpen) {
        updatePosition();
      }
    }, { passive: true, capture: true });
  };


  const initCollapsedProfileMenu = () => {
    const profileTrigger = document.querySelector('#stage-sidebar-tiny-bar [data-testid="accounts-profile-button"]');
    const sidebar = document.getElementById('stage-slideover-sidebar');

    if (!(profileTrigger instanceof HTMLElement) || !sidebar || profileTrigger.dataset.profileMenuBound === 'true') {
      return;
    }
    profileTrigger.dataset.profileMenuBound = 'true';

    const triggerId = profileTrigger.id || `radix-profile-trigger-${Math.random().toString(36).slice(2)}`;
    const menuId = `radix-profile-menu-${Math.random().toString(36).slice(2)}`;
    profileTrigger.id = triggerId;
    profileTrigger.setAttribute('role', 'button');
    profileTrigger.setAttribute('tabindex', '0');
    profileTrigger.setAttribute('aria-haspopup', 'menu');
    profileTrigger.setAttribute('aria-expanded', 'false');
    profileTrigger.setAttribute('data-state', 'closed');
    profileTrigger.setAttribute('aria-label', 'Open profile menu');

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.setAttribute('dir', 'ltr');
    wrapper.hidden = true;
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate(0px, 0px)';
    wrapper.style.minWidth = 'max-content';
    wrapper.style.zIndex = '50';
    wrapper.style.pointerEvents = 'none';
    wrapper.innerHTML = `
      <div
        data-side="top"
        data-align="start"
        role="menu"
        aria-orientation="vertical"
        data-state="closed"
        data-radix-menu-content=""
        dir="ltr"
        id="${menuId}"
        aria-labelledby="${triggerId}"
        class="z-50 max-w-xs rounded-2xl popover bg-token-main-surface-primary dark:bg-[#353535] shadow-long py-1.5 data-[unbound-width]:min-w-[unset] data-[custom-padding]:py-0 MA-gxq_content [--trigger-width:calc(var(--radix-dropdown-menu-trigger-width)-2*var(--radix-align-offset))] min-w-(--trigger-width) max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto select-none min-w-[calc(var(--sidebar-width)-12px)]"
        tabindex="-1"
        data-orientation="vertical"
        style="outline: none; --radix-dropdown-menu-content-transform-origin: var(--radix-popper-transform-origin); --radix-dropdown-menu-content-available-width: var(--radix-popper-available-width); --radix-dropdown-menu-content-available-height: var(--radix-popper-available-height); --radix-dropdown-menu-trigger-width: var(--radix-popper-anchor-width); --radix-dropdown-menu-trigger-height: var(--radix-popper-anchor-height); pointer-events: auto;"
      ></div>
    `;

    document.body.appendChild(wrapper);
    const menu = wrapper.firstElementChild;
    menu.style.pointerEvents = 'auto';
    menu.style.touchAction = 'pan-y';
    menu.style.webkitOverflowScrolling = 'touch';
    menu.style.overscrollBehavior = 'contain';

    const menuItems = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
    let isOpen = false;
    let profileTriggerBackgroundSnapshot = '';

    const updateProfileTriggerVisual = () => {
      const profile = syncAuthSurfaceState();
      profileTrigger.innerHTML = getCollapsedTriggerInnerMarkup(profile);
      profileTrigger.setAttribute('data-auth-role', profile.session?.role || 'public');
      profileTrigger.setAttribute('data-auth-provider', profile.session?.authProvider || '');
      profileTrigger.setAttribute('aria-label', profile.isAuthenticated ? 'Open account menu' : 'Open profile menu');
      return profile;
    };

    const renderMenuContent = () => {
      const profile = syncAuthSurfaceState();
      menu.innerHTML = profile.isAuthenticated
        ? buildAuthenticatedProfileMenuMarkup(profile)
        : buildPublicProfileMenuMarkup();
      return profile;
    };

    const updateSidebarInteractivity = (blocked) => {
      const interactiveTargets = Array.from(sidebar.querySelectorAll('[data-sidebar-item="true"], button, a, [role="button"]'));

      interactiveTargets.forEach((element) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }

        const shouldAllow = element === profileTrigger || profileTrigger.contains(element);
        if (shouldAllow) {
          element.style.pointerEvents = '';
          element.style.cursor = '';
          return;
        }

        if (blocked) {
          element.style.pointerEvents = 'none';
          element.style.cursor = 'default';
        } else {
          element.style.pointerEvents = '';
          element.style.cursor = '';
        }
      });
    };

    const applyProfileTriggerOpenState = () => {
      const computed = window.getComputedStyle(profileTrigger);
      const openBackground = computed.getPropertyValue('--menu-item-open').trim();
      profileTriggerBackgroundSnapshot = profileTrigger.style.backgroundColor;
      if (openBackground) {
        profileTrigger.style.backgroundColor = openBackground;
      }
    };

    const clearProfileTriggerOpenState = () => {
      profileTrigger.style.backgroundColor = profileTriggerBackgroundSnapshot || '';
      profileTriggerBackgroundSnapshot = '';
    };

    const updatePosition = () => {
      wrapper.hidden = false;
      const triggerRect = profileTrigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const banner = document.getElementById('cookie-consent-banner');
      const bannerRect = banner instanceof HTMLElement && !banner.closest('[hidden]') && window.getComputedStyle(banner).display !== 'none'
        ? banner.getBoundingClientRect()
        : null;
      const bottomBoundary = bannerRect && bannerRect.top > 0
        ? Math.max(margin, Math.round(bannerRect.top - margin))
        : Math.max(margin, window.innerHeight - margin);
      const menuWidth = Math.max(0, Math.round(menuRect.width));
      const menuHeight = Math.max(0, Math.round(menuRect.height));
      const x = Math.round(Math.max(margin, Math.min(margin, window.innerWidth - menuWidth - margin)));
      const preferredY = Math.round(triggerRect.top - menuHeight - gap);
      const maxY = Math.max(margin, bottomBoundary - menuHeight);
      const y = Math.max(margin, Math.min(preferredY, maxY));
      const availableWidth = Math.max(0, window.innerWidth - x - margin);
      const availableHeight = Math.max(160, bottomBoundary - y);
      const transformOriginY = Math.max(0, Math.round(triggerRect.top - y));

      wrapper.style.pointerEvents = isOpen ? 'auto' : 'none';
      wrapper.style.transform = `translate(${x}px, ${y}px)`;
      wrapper.style.setProperty('--radix-popper-transform-origin', `0% ${transformOriginY}px`);
      wrapper.style.setProperty('--radix-popper-available-width', `${availableWidth}px`);
      wrapper.style.setProperty('--radix-popper-available-height', `${availableHeight}px`);
      wrapper.style.setProperty('--radix-popper-anchor-width', `${Math.round(triggerRect.width)}px`);
      wrapper.style.setProperty('--radix-popper-anchor-height', `${Math.round(triggerRect.height)}px`);
      menu.style.maxHeight = `${availableHeight}px`;
    };

    const closeMenu = ({ focusTrigger = false } = {}) => {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      document.documentElement.removeAttribute('data-account-profile-menu-open');
      clearProfileTriggerOpenState();
      updateSidebarInteractivity(false);
      wrapper.hidden = true;
      wrapper.style.pointerEvents = 'none';
      menu.setAttribute('data-state', 'closed');
      profileTrigger.setAttribute('aria-expanded', 'false');
      profileTrigger.setAttribute('data-state', 'closed');
      if (focusTrigger) {
        window.requestAnimationFrame(() => profileTrigger.focus({ preventScroll: true }));
      }
    };

    const openMenu = () => {
      if (isOpen) {
        return;
      }
      isOpen = true;
      renderMenuContent();
      document.documentElement.setAttribute('data-account-profile-menu-open', 'true');
      applyProfileTriggerOpenState();
      document.dispatchEvent(new CustomEvent('stage:close-click-popovers', {
        detail: { source: 'account-profile-menu', owner: 'account-profile-menu' }
      }));
      updateSidebarInteractivity(true);
      wrapper.hidden = false;
      wrapper.style.pointerEvents = 'auto';
      menu.setAttribute('data-state', 'open');
      profileTrigger.setAttribute('aria-expanded', 'true');
      profileTrigger.setAttribute('data-state', 'open');
      updatePosition();
    };

    const toggleMenu = () => {
      if (isOpen) {
        closeMenu({ focusTrigger: false });
      } else {
        openMenu();
      }
    };

    const handleProfileAction = async (action, item) => {
      switch (action) {
        case 'upgrade-plan':
          window.open('https://openai.com/chatgpt/pricing/', '_blank', 'noopener,noreferrer');
          return true;
        case 'help':
          window.open('https://help.openai.com/en/collections/3742473-chatgpt', '_blank', 'noopener,noreferrer');
          return true;
        case 'logout':
          item?.setAttribute('aria-disabled', 'true');
          await signOutSupabaseSession();
          clearClientSession();
          syncAuthSurfaceState();
          updateProfileTriggerVisual();
          closeMenu({ focusTrigger: false });
          window.location.href = 'log-in-or-create-account.html?mode=login';
          return true;
        case 'settings':
        case 'profile':
        case 'personalization':
        case 'account':
          return true;
        default:
          return false;
      }
    };

    profileTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });

    profileTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        }
        window.requestAnimationFrame(() => {
          menuItems()[0]?.focus({ preventScroll: true });
        });
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    menu.addEventListener('keydown', (event) => {
      const items = menuItems();
      const currentIndex = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0]?.focus({ preventScroll: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1]?.focus({ preventScroll: true });
      } else if (event.key === 'Tab') {
        closeMenu({ focusTrigger: false });
      }
    });

    ['pointerdown', 'pointerup'].forEach((eventName) => {
      menu.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });

    ['touchstart', 'touchmove', 'touchend', 'scroll'].forEach((eventName) => {
      menu.addEventListener(eventName, (event) => {
        event.stopPropagation();
      }, { passive: true });
    });

    menu.addEventListener('click', async (event) => {
      const item = event.target.closest('[role="menuitem"]');
      if (!(item instanceof HTMLElement)) {
        return;
      }

      const action = item.getAttribute('data-profile-menu-action') || '';
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        const handled = await handleProfileAction(action, item);
        if (handled) {
          if (action !== 'logout') {
            closeMenu({ focusTrigger: false });
          }
          return;
        }
      }

      const href = item.getAttribute('href');
      const target = item.getAttribute('target') || '_self';
      event.stopPropagation();

      if (!href) {
        event.preventDefault();
        closeMenu({ focusTrigger: false });
        return;
      }

      closeMenu({ focusTrigger: false });
      if (target === '_blank') {
        event.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!isOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!wrapper.contains(target) && !profileTrigger.contains(target)) {
        closeMenu({ focusTrigger: false });
      }
    });

    const syncFromSession = () => {
      updateProfileTriggerVisual();
      if (isOpen) {
        renderMenuContent();
        updatePosition();
      }
    };

    window.addEventListener('resize', () => {
      if (isOpen) {
        updatePosition();
      }
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (isOpen) {
        updatePosition();
      }
    }, { passive: true, capture: true });

    window.addEventListener('storage', (event) => {
      if (event.key === SESSION_STORAGE_KEY) {
        syncFromSession();
      }
    });
    window.addEventListener('focus', syncFromSession, { passive: true });
    window.addEventListener('pageshow', syncFromSession, { passive: true });

    syncFromSession();
  };



  const initAll = () => {
    initSidebarToggle();
    initSidebarHelpMenu();
    initCollapsedProfileMenu();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
