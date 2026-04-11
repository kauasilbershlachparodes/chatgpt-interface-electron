(async () => {
  const AUTH_PAGE_EMAIL = 'log-in-or-create-account';
  const AUTH_PAGE_PASSWORD = 'create-account-password';
  const AUTH_PAGE_VERIFY = 'email-verification';
  const AUTH_PAGE_ABOUT = 'about-you';

  const readInlineConfig = () => window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {};
  const normalizeConfig = (raw = {}) => ({
    supabaseUrl: String(raw.supabaseUrl || '').trim(),
    anonKey: String(raw.anonKey || raw.supabaseKey || '').trim(),
    otpLength: Number.parseInt(String(raw.otpLength || 6), 10) || 6,
    emailMaxLength: Number.parseInt(String(raw.emailMaxLength || 254), 10) || 254,
    passwordMaxLength: Number.parseInt(String(raw.passwordMaxLength || 72), 10) || 72
  });

  const loadConfigFromSameOrigin = async () => {
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
        const payload = await response.json();
        if (payload && typeof payload === 'object') {
          const normalized = normalizeConfig(payload);
          if (normalized.supabaseUrl && normalized.anonKey) {
            window.__MATRIX_SUPABASE_CONFIG__ = {
              ...(window.__MATRIX_SUPABASE_CONFIG__ || {}),
              ...normalized
            };
            return normalized;
          }
        }
      } catch (_error) {
        // noop
      }
    }
    return null;
  };

  const loadRuntimeConfig = async () => {
    const bridgeConfig = normalizeConfig(window.electronAPI && window.electronAPI.authConfig ? window.electronAPI.authConfig : {});
    if (bridgeConfig.supabaseUrl && bridgeConfig.anonKey) {
      return bridgeConfig;
    }

    const inlineConfig = normalizeConfig(readInlineConfig());
    if (inlineConfig.supabaseUrl && inlineConfig.anonKey) {
      return inlineConfig;
    }

    const fetchedConfig = await loadConfigFromSameOrigin();
    if (fetchedConfig && fetchedConfig.supabaseUrl && fetchedConfig.anonKey) {
      return fetchedConfig;
    }

    return {
      supabaseUrl: '',
      anonKey: '',
      otpLength: inlineConfig.otpLength || bridgeConfig.otpLength || 6,
      emailMaxLength: inlineConfig.emailMaxLength || bridgeConfig.emailMaxLength || 254,
      passwordMaxLength: inlineConfig.passwordMaxLength || bridgeConfig.passwordMaxLength || 72
    };
  };

  const config = await loadRuntimeConfig();
  const matrix = window.MatrixSession;
  const hasValidAuthConfig = Boolean(config.supabaseUrl && config.anonKey);
  const client = hasValidAuthConfig && window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(config.supabaseUrl, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'implicit'
        }
      })
    : null;

  const getPageName = () => {
    const path = window.location.pathname.split('/').filter(Boolean).pop() || '';
    return path.replace(/\.html$/i, '');
  };
  const getSearchParam = (key) => {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch (_error) {
      return null;
    }
  };
  const getRequestedOAuthProvider = () => {
    const provider = String(getSearchParam('provider') || '').trim().toLowerCase();
    return provider === 'google' ? provider : null;
  };

  const getMessageHost = () => document.querySelector('div[aria-live="polite"].__matrix-message-host, ._hiddenErrorsContainer_1wcdi_38') || null;

  const ensureMessageHost = () => {
    let host = document.querySelector('.__matrix-message-host');
    if (host) return host;
    const existing = document.querySelector('div[aria-live="polite"]._hiddenErrorsContainer_1wcdi_38');
    if (existing) {
      existing.classList.add('__matrix-message-host');
      return existing;
    }
    const form = document.querySelector('form');
    if (!form) return null;
    host = document.createElement('div');
    host.className = '__matrix-message-host';
    host.setAttribute('aria-live', 'polite');
    form.prepend(host);
    return host;
  };

  const showMessage = (message, kind = 'error') => {
    const host = ensureMessageHost();
    if (!host) {
      window.alert(message);
      return;
    }
    host.textContent = message;
    host.style.display = 'block';
    host.style.marginTop = '12px';
    host.style.fontSize = '14px';
    host.style.lineHeight = '1.4';
    host.style.color = kind === 'error' ? '#f87171' : '#9ae6b4';
  };

  const clearMessage = () => {
    const host = document.querySelector('.__matrix-message-host');
    if (!host) return;
    host.textContent = '';
  };

  const sanitizeEmail = (value) => String(value || '').trim().toLowerCase();
  const sanitizeCode = (value) => String(value || '').replace(/\D+/g, '').slice(0, config.otpLength);
  const SIGNUP_PASSWORD_MIN_LENGTH = 12;
  const DEFAULT_PASSWORD_MIN_LENGTH = 8;
  const VERIFICATION_REQUIRED_MESSAGE = 'The verification code is required';
  const getVerificationLengthMessage = () => `The verification code should be exactly ${config.otpLength} characters long`;

  const PASSWORD_ATTEMPT_SCOPE = 'password-login';
  const OTP_ATTEMPT_SCOPE = 'otp-verify';
  const OTP_RESEND_SCOPE = 'otp-resend';
  const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

  const getThrottleMessage = (label, status) => {
    if (!status || !status.blocked) return '';
    const remaining = matrix && typeof matrix.formatRemainingTime === 'function'
      ? matrix.formatRemainingTime(status.remainingMs)
      : `${Math.max(1, Math.ceil((status.remainingMs || 0) / 1000))}s`;

    if (status.cooldownReason === 'resend_cooldown') {
      return `Wait ${remaining} before requesting another verification code.`;
    }

    return `Too many ${label} attempts. Try again in ${remaining}.`;
  };

  const getAttemptStatus = (scope, identifier) =>
    matrix && typeof matrix.getAttemptStatus === 'function'
      ? matrix.getAttemptStatus(scope, identifier)
      : { blocked: false, remainingMs: 0, failureCount: 0, cooldownReason: '' };

  const enforceThrottle = (scope, identifier, label) => {
    const status = getAttemptStatus(scope, identifier);
    if (!status.blocked) {
      return false;
    }

    showMessage(getThrottleMessage(label, status));
    return true;
  };

  const registerFailedAttempt = (scope, identifier, label) => {
    if (!(matrix && typeof matrix.registerFailedAttempt === 'function')) {
      return;
    }

    const status = matrix.registerFailedAttempt(scope, identifier);
    if (status && status.blocked) {
      showMessage(getThrottleMessage(label, status));
    }
  };

  const clearAttemptStatus = (scope, identifier) => {
    if (matrix && typeof matrix.clearAttemptStatus === 'function') {
      matrix.clearAttemptStatus(scope, identifier);
    }
  };

  const startCooldown = (scope, identifier, cooldownMs, reason) =>
    matrix && typeof matrix.registerCooldown === 'function'
      ? matrix.registerCooldown(scope, identifier, cooldownMs, reason)
      : null;
  const VERIFICATION_ERROR_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" title="Error">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M8 14.667A6.667 6.667 0 1 0 8 1.333a6.667 6.667 0 0 0 0 13.334z" fill="#D00E17" stroke="#D00E17" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M8 4.583a.75.75 0 0 1 .75.75V8a.75.75 0 0 1-1.5 0V5.333a.75.75 0 0 1 .75-.75z" fill="#fff"></path>
      <path d="M8.667 10.667a.667.667 0 1 1-1.334 0 .667.667 0 0 1 1.334 0z" fill="#fff"></path>
    </svg>
  `;

  const setBusy = (button, isBusy) => {
    if (!(button instanceof HTMLElement)) return;

    const scope = button.form || button.closest('form') || button.closest('fieldset') || button.parentElement;
    const controls = scope
      ? Array.from(scope.querySelectorAll('button, input:not([type="hidden"]), textarea, select'))
      : [button];

    controls.forEach((control) => {
      if (!(control instanceof HTMLElement)) return;

      if (isBusy) {
        control.dataset.busyRestoreDisabled = control.disabled ? 'true' : 'false';
        control.disabled = true;
        control.setAttribute('aria-disabled', 'true');
        return;
      }

      const shouldRestoreDisabled = control.dataset.busyRestoreDisabled === 'true';
      control.disabled = shouldRestoreDisabled;
      if (control.disabled) {
        control.setAttribute('aria-disabled', 'true');
      } else {
        control.setAttribute('aria-disabled', 'false');
      }
      delete control.dataset.busyRestoreDisabled;
    });
  };

  const requireClient = () => {
    if (client) return true;
    showMessage(hasValidAuthConfig ? 'Supabase client is not available on this page.' : 'Authentication is not configured. Load auth.config.json or set MATRIX_SUPABASE_URL and MATRIX_SUPABASE_ANON_KEY before starting the app.');
    return false;
  };

  const getOAuthCallbackUrl = () => `${window.location.origin}/auth/callback.html`;
  const OAUTH_POPUP_STORAGE_KEY = 'matrix.oauth.popup.result';
  const OAUTH_POPUP_NAME = 'matrix-google-auth-popup';

  const isPopupRequest = () => getSearchParam('popup') === '1';

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

  const openOAuthPopup = (provider) => {
    const mode = matrix && typeof matrix.getModeFromLocation === 'function'
      ? matrix.getModeFromLocation()
      : 'login';
    const popupUrl = new URL('google-oauth-start.html', window.location.href);
    popupUrl.searchParams.set('mode', mode === 'signup' ? 'signup' : 'login');
    popupUrl.searchParams.set('provider', provider);
    popupUrl.searchParams.set('popup', '1');

    const popup = window.open(popupUrl.toString(), OAUTH_POPUP_NAME, getOAuthPopupFeatures());
    if (!popup) {
      return false;
    }

    try {
      popup.focus();
    } catch (_error) {
      // noop
    }

    return true;
  };

  const handleOAuthPopupResult = (payload) => {
    if (!payload || payload.provider !== 'google') {
      return;
    }

    if (getPageName() !== 'index') {
      window.location.href = 'index.html';
    }
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data && event.data.type === 'matrix:oauth:complete') {
      handleOAuthPopupResult(event.data);
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== OAUTH_POPUP_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      handleOAuthPopupResult(JSON.parse(event.newValue));
    } catch (_error) {
      // noop
    }
  });

  const shouldPreferPopupOAuth = (provider) => {
    if (provider !== 'google') return false;
    return Boolean(window.electronAPI) || isPopupRequest() || typeof window.openMatrixGoogleAuthPopup === 'function';
  };

  const startOAuthSignIn = async (provider, button) => {
    clearMessage();

    if (!/^https?:$/.test(window.location.protocol)) {
      showMessage(`${provider[0].toUpperCase()}${provider.slice(1)} sign-in requires the app to run over http://localhost or https.`);
      return;
    }

    try {
      setBusy(button, true);

      if (shouldPreferPopupOAuth(provider)) {
        const popupOpened = typeof window.openMatrixGoogleAuthPopup === 'function'
          ? window.openMatrixGoogleAuthPopup(
              matrix && typeof matrix.getModeFromLocation === 'function' ? matrix.getModeFromLocation() : 'login',
              { closeModal: false, source: 'matrix_auth_google_button' }
            )
          : openOAuthPopup(provider);

        if (popupOpened) {
          return;
        }
      }

      if (!requireClient()) return;

      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getOAuthCallbackUrl(),
          skipBrowserRedirect: true,
          queryParams: provider === 'google'
            ? {
                access_type: 'offline',
                prompt: 'select_account'
              }
            : undefined
        }
      });

      if (error) throw error;
      if (!data || !data.url) {
        throw new Error(`Supabase did not return an OAuth URL for ${provider}.`);
      }

      window.location.assign(data.url);
    } catch (error) {
      showMessage(error && error.message ? error.message : `Unable to start ${provider} sign-in.`);
    } finally {
      setBusy(button, false);
    }
  };



  const unlockAuthInputs = () => {
    const forms = Array.from(document.querySelectorAll('form, fieldset'));
    forms.forEach((element) => {
      element.removeAttribute('inert');
      element.removeAttribute('aria-hidden');
      element.style.pointerEvents = 'auto';
    });

    const wrappers = Array.from(document.querySelectorAll([
      '.react-aria-TextField',
      '._root_18qcl_51',
      '._fieldFootprint_18qcl_59',
      '._typeable_18qcl_74',
      '._section_1wcdi_7',
      '._root_1wcdi_1'
    ].join(',')));

    wrappers.forEach((element) => {
      element.style.pointerEvents = 'auto';
      if (!element.style.position) {
        element.style.position = 'relative';
      }
      if (!element.style.zIndex) {
        element.style.zIndex = '1';
      }
    });

    document.querySelectorAll('label[for]').forEach((label) => {
      label.style.pointerEvents = 'none';
      label.style.userSelect = 'none';
    });

    const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea'));
    fields.forEach((field) => {
      const shouldStayReadonly = field.hasAttribute('readonly') && field.name !== 'new-password' && field.name !== 'code';
      field.removeAttribute('inert');
      field.removeAttribute('aria-hidden');
      field.disabled = false;
      if (!shouldStayReadonly) {
        field.readOnly = false;
        field.removeAttribute('readonly');
      }
      field.style.pointerEvents = 'auto';
      field.style.position = 'relative';
      field.style.zIndex = '5';
      field.style.userSelect = 'text';
      field.style.webkitUserSelect = 'text';
      field.style.webkitTouchCallout = 'default';
      field.style.touchAction = 'manipulation';
      field.style.caretColor = 'auto';
      field.tabIndex = field.tabIndex < 0 ? 0 : field.tabIndex;

      const focusField = () => {
        try {
          field.focus({ preventScroll: true });
        } catch (_error) {
          field.focus();
        }
      };

      field.addEventListener('pointerdown', focusField);
      field.addEventListener('mousedown', focusField);
      field.addEventListener('touchstart', focusField, { passive: true });
      field.addEventListener('click', focusField);
      bindFloatingFieldState(field);
    });
  };

  const syncFloatingFieldState = (field) => {
    if (!(field instanceof HTMLElement)) return;

    const root = field.closest('._root_18qcl_51');
    const footprint = field.closest('._fieldFootprint_18qcl_59');
    if (!footprint) return;

    const hasValue = String(field.value || '').trim().length > 0;
    const isFocused = document.activeElement === field;
    const hasBadNumberInput =
      field instanceof HTMLInputElement &&
      field.type === 'number' &&
      field.validity &&
      field.validity.badInput;
    const hasValidationError =
      field.hasAttribute('aria-invalid') ||
      field.hasAttribute('data-invalid') ||
      (root instanceof HTMLElement && root.querySelector('._errors_18qcl_110'));
    const shouldMaskBadNumberInput = hasBadNumberInput && !isFocused && !hasValidationError;
    const label = root instanceof HTMLElement
      ? root.querySelector('label._typeableLabel_18qcl_74')
      : null;

    footprint.classList.toggle('_hasValue_18qcl_151', hasValue);

    if (isFocused) {
      field.setAttribute('data-focused', '');
      field.setAttribute('data-focus-within', '');
    } else {
      field.removeAttribute('data-focused');
      field.removeAttribute('data-focus-within');
    }

    if (root instanceof HTMLElement) {
      root.toggleAttribute('data-matrix-bad-number-resting', shouldMaskBadNumberInput);
    }

    if (shouldMaskBadNumberInput) {
      field.style.color = 'transparent';
      field.style.webkitTextFillColor = 'transparent';
      field.style.caretColor = 'transparent';

      if (label instanceof HTMLElement) {
        label.style.zIndex = '6';
        label.style.pointerEvents = 'none';
      }

      return;
    }

    field.style.color = '';
    field.style.webkitTextFillColor = '';
    field.style.caretColor = 'auto';

    if (label instanceof HTMLElement) {
      label.style.zIndex = '';
      label.style.pointerEvents = '';
    }
  };

  const refreshFloatingFieldStates = () => {
    document
      .querySelectorAll('input._target_18qcl_134, textarea._target_18qcl_134')
      .forEach((field) => syncFloatingFieldState(field));
  };

  const bindFloatingFieldState = (field) => {
    if (!(field instanceof HTMLElement)) return;

    // Some cloned/auth pages already ship with data-floating-state-bound in the
    // HTML, so we keep our own binding flag to ensure listeners are attached.
    if (field.dataset.matrixFloatingStateBound === 'true') {
      syncFloatingFieldState(field);
      return;
    }

    field.dataset.matrixFloatingStateBound = 'true';

    const handleStateSync = () => syncFloatingFieldState(field);

    field.addEventListener('focus', handleStateSync);
    field.addEventListener('blur', handleStateSync);
    field.addEventListener('input', handleStateSync);
    field.addEventListener('change', handleStateSync);
    field.addEventListener('keyup', handleStateSync);

    syncFloatingFieldState(field);
  };

  const getVerificationFieldElements = () => {
    const input = document.querySelector('input[name="code"]');
    if (!(input instanceof HTMLElement)) return null;

    const textField = input.closest('.react-aria-TextField');
    const root = input.closest('._root_18qcl_51');
    const liveRegion = root ? root.querySelector('span[aria-live="polite"][aria-atomic="true"]') : null;

    if (!(textField instanceof HTMLElement) || !(root instanceof HTMLElement) || !(liveRegion instanceof HTMLElement)) {
      return null;
    }

    return { input, textField, root, liveRegion };
  };

  const ensureVerificationErrorHost = () => {
    const elements = getVerificationFieldElements();
    if (!elements) return null;

    const { input, liveRegion } = elements;
    let errorHost = liveRegion.querySelector('.react-aria-FieldError');

    if (!(errorHost instanceof HTMLElement)) {
      errorHost = document.createElement('span');
      errorHost.className = 'react-aria-FieldError';
      errorHost.setAttribute('slot', 'errorMessage');
      errorHost.setAttribute('data-rac', '');
      errorHost.id = `${input.id}-error`;
      liveRegion.appendChild(errorHost);
    }

    return { ...elements, errorHost };
  };

  const setVerificationFieldError = (message) => {
    const elements = ensureVerificationErrorHost();
    if (!elements) {
      showMessage(message);
      return;
    }

    const { input, textField, errorHost } = elements;
    const baseDescribedBy = (input.dataset.baseDescribedBy || input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((value) => value !== errorHost.id)
      .join(' ');

    if (!input.dataset.baseDescribedBy) {
      input.dataset.baseDescribedBy = baseDescribedBy;
    }

    textField.setAttribute('data-invalid', 'true');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('data-invalid', 'true');
    input.setAttribute('aria-describedby', [baseDescribedBy, errorHost.id].filter(Boolean).join(' '));

    errorHost.innerHTML = `
      <ul class="_errors_18qcl_110">
        <li class="_error_18qcl_110">
          ${VERIFICATION_ERROR_ICON}
          ${message}
        </li>
      </ul>
    `;

    syncFloatingFieldState(input);
  };

  const clearVerificationFieldError = () => {
    const elements = ensureVerificationErrorHost();
    if (!elements) return;

    const { input, textField, errorHost } = elements;
    const baseDescribedBy = (input.dataset.baseDescribedBy || '')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');

    textField.removeAttribute('data-invalid');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('data-invalid');
    input.setAttribute('aria-describedby', baseDescribedBy);
    errorHost.innerHTML = '';
  };

  const getAboutYouFieldElements = (inputName) => {
    const input = document.querySelector(`input[name="${inputName}"]`);
    if (!(input instanceof HTMLElement)) return null;

    const wrapper = input.closest('.react-aria-TextField, ._ageFallbackAgeInput_q6mtz_32');
    const root = wrapper ? wrapper.querySelector('._root_18qcl_51') : input.closest('._root_18qcl_51');
    const liveRegion = root ? root.querySelector('span[aria-live="polite"][aria-atomic="true"]') : null;

    if (!(wrapper instanceof HTMLElement) || !(root instanceof HTMLElement) || !(liveRegion instanceof HTMLElement)) {
      return null;
    }

    return { input, wrapper, root, liveRegion };
  };

  const ensureAboutYouFieldErrorHost = (inputName, fallbackId) => {
    const elements = getAboutYouFieldElements(inputName);
    if (!elements) return null;

    const { input, liveRegion } = elements;
    let errorHost = liveRegion.querySelector('.react-aria-FieldError');

    if (!(errorHost instanceof HTMLElement)) {
      errorHost = document.createElement('span');
      errorHost.className = 'react-aria-FieldError';
      errorHost.setAttribute('slot', 'errorMessage');
      errorHost.setAttribute('data-rac', '');
      errorHost.id = fallbackId || `${input.id}-error`;
      liveRegion.appendChild(errorHost);
    }

    if (!errorHost.id) {
      errorHost.id = fallbackId || `${input.id}-error`;
    }

    return { ...elements, errorHost };
  };

  const setAboutYouFieldError = (inputName, message, fallbackId) => {
    const elements = ensureAboutYouFieldErrorHost(inputName, fallbackId);
    if (!elements) {
      showMessage(message);
      return;
    }

    const { input, wrapper, errorHost } = elements;
    const baseDescribedBy = (input.dataset.baseDescribedBy || input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((value) => value !== errorHost.id)
      .join(' ');

    if (!input.dataset.baseDescribedBy) {
      input.dataset.baseDescribedBy = baseDescribedBy;
    }

    wrapper.setAttribute('data-invalid', 'true');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('data-invalid', 'true');
    input.setAttribute('aria-describedby', [baseDescribedBy, errorHost.id].filter(Boolean).join(' '));

    errorHost.innerHTML = `
      <ul class="_errors_18qcl_110">
        <li class="_error_18qcl_110">
          ${VERIFICATION_ERROR_ICON}
          ${message}
        </li>
      </ul>
    `;

    syncFloatingFieldState(input);
  };

  const clearAboutYouFieldError = (inputName) => {
    const elements = getAboutYouFieldElements(inputName);
    if (!elements) return;

    const { input, wrapper, liveRegion } = elements;
    const errorHost = liveRegion.querySelector('.react-aria-FieldError');
    const baseDescribedBy = (input.dataset.baseDescribedBy || '')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');

    wrapper.removeAttribute('data-invalid');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('data-invalid');
    input.setAttribute('aria-describedby', baseDescribedBy);
    if (errorHost instanceof HTMLElement) {
      errorHost.innerHTML = '';
    }

    syncFloatingFieldState(input);
  };

  const ensurePasswordFieldAssistiveElements = () => {
    const input = document.querySelector('input[name="new-password"]');
    if (!(input instanceof HTMLElement)) return null;

    const textField = input.closest('.react-aria-TextField');
    const root = input.closest('._root_18qcl_51');
    const liveRegion = root ? root.querySelector('span[aria-live="polite"][aria-atomic="true"]') : null;
    const requirementHost = document.querySelector('._requirements_1fjp5_2');
    const requirementList = requirementHost ? requirementHost.querySelector('._requirementsList_1fjp5_13') : null;
    const requirementItem = requirementHost ? requirementHost.querySelector('._requirement_1fjp5_2') : null;
    const screenreaderOnly = requirementHost ? requirementHost.querySelector('._screenreaderOnly_1fjp5_36') : null;

    if (
      !(textField instanceof HTMLElement) ||
      !(root instanceof HTMLElement) ||
      !(liveRegion instanceof HTMLElement) ||
      !(requirementHost instanceof HTMLElement) ||
      !(requirementList instanceof HTMLElement) ||
      !(requirementItem instanceof HTMLElement) ||
      !(screenreaderOnly instanceof HTMLElement)
    ) {
      return null;
    }

    let errorHost = liveRegion.querySelector('.react-aria-FieldError');
    if (!(errorHost instanceof HTMLElement)) {
      errorHost = document.createElement('span');
      errorHost.className = 'react-aria-FieldError';
      errorHost.setAttribute('slot', 'errorMessage');
      errorHost.setAttribute('data-rac', '');
      errorHost.id = `${input.id}-error`;
      liveRegion.appendChild(errorHost);
    }

    if (!errorHost.id) {
      errorHost.id = `${input.id}-error`;
    }

    return {
      input,
      textField,
      root,
      errorHost,
      requirementHost,
      requirementList,
      requirementItem,
      screenreaderOnly
    };
  };

  const setPasswordRequirementState = ({ visible, invalid, complete }) => {
    const elements = ensurePasswordFieldAssistiveElements();
    if (!elements) return;

    const {
      input,
      textField,
      errorHost,
      requirementHost,
      requirementList,
      requirementItem,
      screenreaderOnly
    } = elements;

    const relatedIds = [errorHost.id, requirementHost.id, requirementList.id].filter(Boolean);
    const baseDescribedBy = (input.dataset.baseDescribedBy || input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((value) => !relatedIds.includes(value))
      .join(' ');

    if (!input.dataset.baseDescribedBy) {
      input.dataset.baseDescribedBy = baseDescribedBy;
    }

    requirementHost.hidden = !visible;
    requirementHost.style.display = visible ? 'block' : 'none';
    requirementHost.style.setProperty('--unmet-requirement-color', invalid ? 'var(--platform-error)' : 'inherit');
    requirementHost.style.setProperty('--unmet-requirement-glyph', invalid ? '"\\2717"' : '"\\2022"');

    requirementItem.classList.toggle('_requirementComplete_1fjp5_31', complete);
    screenreaderOnly.textContent = complete ? '. Complete.' : '. Incomplete.';

    if (invalid) {
      textField.setAttribute('data-invalid', 'true');
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('data-invalid', 'true');
      errorHost.innerHTML = '<ul class="_errors_18qcl_110"></ul>';
    } else {
      textField.removeAttribute('data-invalid');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('data-invalid');
      errorHost.innerHTML = '';
    }

    const describedBy = [];
    if (baseDescribedBy) describedBy.push(baseDescribedBy);
    if (invalid) describedBy.push(errorHost.id);
    if (visible) describedBy.push(requirementHost.id, requirementList.id);
    input.setAttribute('aria-describedby', describedBy.filter(Boolean).join(' '));
  };

  const createPasswordRequirementController = (passwordInput) => {
    if (!(passwordInput instanceof HTMLElement)) return null;

    let hasAttemptedSubmit = false;

    const sync = () => {
      const password = String(passwordInput.value || '');
      const complete = password.length >= SIGNUP_PASSWORD_MIN_LENGTH;
      const visible = document.activeElement === passwordInput || password.length > 0 || hasAttemptedSubmit;
      const invalid = hasAttemptedSubmit && !complete;

      setPasswordRequirementState({ visible, invalid, complete });
      return complete;
    };

    passwordInput.addEventListener('focus', sync);
    passwordInput.addEventListener('blur', sync);
    passwordInput.addEventListener('input', sync);
    passwordInput.addEventListener('change', sync);

    sync();

    return {
      sync,
      markSubmitted() {
        hasAttemptedSubmit = true;
        return sync();
      }
    };
  };

  const bindVisibilityToggle = () => {
    const toggleButton = document.querySelector('button[aria-controls="_r_1j_-new-password"]');
    const passwordInput = document.querySelector('input[name="new-password"]');
    if (!toggleButton || !passwordInput) return;

    const icon = toggleButton.querySelector('svg');
    const tooltipId = `react-aria-tooltip-${Math.random().toString(36).slice(2)}`;
    const eyeOpenPath = 'M5.91444 7.59106C4.3419 9.04124 3.28865 10.7415 2.77052 11.6971C2.66585 11.8902 2.66585 12.1098 2.77052 12.3029C3.28865 13.2585 4.3419 14.9588 5.91444 16.4089C7.48195 17.8545 9.50572 19 12 19C14.4943 19 16.518 17.8545 18.0855 16.4089C19.6581 14.9588 20.7113 13.2585 21.2295 12.3029C21.3341 12.1098 21.3341 11.8902 21.2295 11.6971C20.7113 10.7415 19.6581 9.04124 18.0855 7.59105C16.518 6.1455 14.4943 5 12 5C9.50572 5 7.48195 6.1455 5.91444 7.59106ZM4.55857 6.1208C6.36059 4.45899 8.84581 3 12 3C15.1542 3 17.6394 4.45899 19.4414 6.1208C21.2384 7.77798 22.4152 9.68799 22.9877 10.7438C23.4147 11.5315 23.4147 12.4685 22.9877 13.2562C22.4152 14.312 21.2384 16.222 19.4414 17.8792C17.6394 19.541 15.1542 21 12 21C8.84581 21 6.36059 19.541 4.55857 17.8792C2.76159 16.222 1.58478 14.312 1.01232 13.2562C0.58525 12.4685 0.585249 11.5315 1.01232 10.7438C1.58478 9.688 2.76159 7.77798 4.55857 6.1208ZM12 9.5C10.6193 9.5 9.49999 10.6193 9.49999 12C9.49999 13.3807 10.6193 14.5 12 14.5C13.3807 14.5 14.5 13.3807 14.5 12C14.5 10.6193 13.3807 9.5 12 9.5ZM7.49999 12C7.49999 9.51472 9.51471 7.5 12 7.5C14.4853 7.5 16.5 9.51472 16.5 12C16.5 14.4853 14.4853 16.5 12 16.5C9.51471 16.5 7.49999 14.4853 7.49999 12Z';
    const eyeClosedMarkup = `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M2.29291 2.29289C2.68343 1.90237 3.3166 1.90237 3.70712 2.29289L21.7071 20.2929C22.0976 20.6834 22.0976 21.3166 21.7071 21.7071C21.3166 22.0976 20.6834 22.0976 20.2929 21.7071L17.7785 19.1927C16.2039 20.2404 14.274 21 12 21C8.84584 21 6.36062 19.541 4.5586 17.8792C2.76162 16.222 1.58481 14.312 1.01235 13.2562C0.585075 12.4681 0.585779 11.5305 1.01269 10.7432C1.5904 9.67778 2.79205 7.72646 4.63588 6.05008L2.29291 3.70711C1.90238 3.31658 1.90238 2.68342 2.29291 2.29289ZM6.05192 7.46612C4.40725 8.93862 3.30718 10.7074 2.77085 11.6965C2.66598 11.8899 2.66608 12.1102 2.77055 12.3029C3.28868 13.2585 4.34193 14.9588 5.91447 16.4089C7.48198 17.8545 9.50575 19 12 19C13.6494 19 15.09 18.5001 16.3303 17.7445L14.396 15.8102C12.6575 16.9057 10.3324 16.6963 8.81803 15.182C7.3037 13.6676 7.09428 11.3425 8.18977 9.60397L6.05192 7.46612ZM9.67223 11.0864L12.9136 14.3278C12.0164 14.6793 10.9571 14.4927 10.2322 13.7678C9.50734 13.0429 9.32067 11.9836 9.67223 11.0864Z" fill="currentColor"></path>
      <path d="M10.2234 5.19987C10.7835 5.07151 11.3753 5 12 5C14.4943 5 16.5181 6.1455 18.0856 7.59105C19.6581 9.04124 20.7114 10.7415 21.2295 11.6971C21.3335 11.8889 21.3338 12.1105 21.2285 12.3047C20.9449 12.8276 20.496 13.5829 19.8836 14.4005C19.5526 14.8426 19.6425 15.4693 20.0846 15.8004C20.5266 16.1315 21.1534 16.0415 21.4844 15.5995C22.1677 14.6872 22.6678 13.8459 22.9866 13.2582C23.4131 12.4717 23.4154 11.5327 22.9877 10.7438C22.4152 9.68799 21.2384 7.77798 19.4414 6.1208C17.6394 4.45899 15.1542 3 12 3C11.2211 3 10.4795 3.08934 9.77664 3.25041C9.23831 3.37379 8.90192 3.9102 9.02529 4.44853C9.14866 4.98686 9.68508 5.32325 10.2234 5.19987Z" fill="currentColor"></path>
    `;
    const tooltipContainer = document.createElement('div');
    const tooltip = document.createElement('div');
    const arrow = document.createElement('div');
    const tooltipBody = document.createElement('span');
    let isTooltipOpen = false;

    tooltipContainer.setAttribute('data-overlay-container', 'true');
    tooltipContainer.hidden = true;

    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('data-rac', '');
    tooltip.setAttribute('data-placement', 'top');
    tooltip.className = '_tooltip_1x7iz_24';
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '100000';
    tooltip.style.maxHeight = '195px';

    arrow.setAttribute('aria-hidden', 'true');
    arrow.setAttribute('role', 'presentation');
    arrow.setAttribute('data-rac', '');
    arrow.setAttribute('placement', 'top');
    arrow.setAttribute('data-placement', 'top');
    arrow.className = 'react-aria-OverlayArrow';
    arrow.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8" class="_tooltipArrow_1x7iz_49"><path d="M0 0 L4 4 L8 0"></path></svg>';

    tooltipBody.className = '_tooltipBody_1x7iz_41 _base_dw77f_67 _normal_dw77f_95 _primary_dw77f_113';
    tooltipBody.setAttribute('aria-hidden', 'true');

    tooltip.appendChild(arrow);
    tooltip.appendChild(tooltipBody);
    tooltipContainer.appendChild(tooltip);
    document.body.appendChild(tooltipContainer);

    const renderIcon = (markup) => {
      if (!icon) return;
      icon.innerHTML = markup;
    };

    const updateTooltipText = () => {
      tooltipBody.textContent = passwordInput.type === 'text' ? 'Hide password' : 'Show password';
    };

    const updateTooltipPosition = () => {
      const rect = toggleButton.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const left = Math.round(rect.left + (rect.width / 2) - (tooltipRect.width / 2));
      const bottom = Math.round(window.innerHeight - rect.top + 18);
      const arrowLeft = Math.round(tooltipRect.width / 2);

      tooltip.style.left = `${Math.max(8, left)}px`;
      tooltip.style.bottom = `${bottom}px`;
      arrow.style.position = 'absolute';
      arrow.style.transform = 'translateX(-50%)';
      arrow.style.top = '100%';
      arrow.style.left = `${arrowLeft}px`;
    };

    const openTooltip = () => {
      updateTooltipText();
      tooltipContainer.hidden = false;
      toggleButton.setAttribute('aria-describedby', tooltipId);
      isTooltipOpen = true;
      requestAnimationFrame(updateTooltipPosition);
    };

    const closeTooltip = () => {
      tooltipContainer.hidden = true;
      toggleButton.removeAttribute('aria-describedby');
      isTooltipOpen = false;
    };

    const syncVisibilityState = () => {
      const isVisible = passwordInput.type === 'text';
      toggleButton.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
      toggleButton.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
      updateTooltipText();
      renderIcon(isVisible
        ? eyeClosedMarkup
        : `<path fill-rule="evenodd" clip-rule="evenodd" d="${eyeOpenPath}" fill="currentColor"></path>`);
      if (isTooltipOpen) {
        requestAnimationFrame(updateTooltipPosition);
      }
    };

    syncVisibilityState();

    toggleButton.addEventListener('mouseenter', openTooltip);
    toggleButton.addEventListener('mouseleave', closeTooltip);
    toggleButton.addEventListener('focus', openTooltip);
    toggleButton.addEventListener('blur', closeTooltip);

    toggleButton.addEventListener('click', () => {
      const nextVisible = passwordInput.type === 'password';
      passwordInput.type = nextVisible ? 'text' : 'password';
      syncVisibilityState();
      if (toggleButton.matches(':hover') || document.activeElement === toggleButton) {
        openTooltip();
      }
    });

    window.addEventListener('resize', () => {
      if (isTooltipOpen) {
        updateTooltipPosition();
      }
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (isTooltipOpen) {
        updateTooltipPosition();
      }
    }, { passive: true, capture: true });
  };

  const decorateFields = () => {
    const emailInput = document.querySelector('input[type="email"], input[name="username"], input[name="email"]');
    if (emailInput) {
      emailInput.value = '';
      emailInput.maxLength = config.emailMaxLength;
      emailInput.autocapitalize = 'none';
      emailInput.spellcheck = false;
    }

    const passwordInput = document.querySelector('input[name="new-password"]');
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.maxLength = config.passwordMaxLength;
      passwordInput.minLength = matrix && matrix.getModeFromLocation && matrix.getModeFromLocation() === 'signup'
        ? SIGNUP_PASSWORD_MIN_LENGTH
        : DEFAULT_PASSWORD_MIN_LENGTH;
      passwordInput.autocomplete = matrix && matrix.getModeFromLocation && matrix.getModeFromLocation() === 'signup'
        ? 'new-password'
        : 'current-password';
    }

    const codeInput = document.querySelector('input[name="code"]');
    if (codeInput) {
      codeInput.value = '';
      codeInput.maxLength = config.otpLength;
      codeInput.inputMode = 'numeric';
      codeInput.pattern = `\\d{${config.otpLength}}`;
    }

    refreshFloatingFieldStates();
  };

  const syncPendingEmailIntoPasswordPage = () => {
    const pending = matrix && matrix.getPendingAuth ? matrix.getPendingAuth() : null;
    const email = pending && pending.email ? pending.email : '';
    const hiddenInput = document.querySelector('input[name="username"]');
    const readonlyEmailInput = document.querySelector('input[readonly][placeholder="Email address"]');
    const mode = matrix ? matrix.getModeFromLocation() : 'login';
    const title = document.querySelector('h1 ._root_xeddl_1');
    const subtitle = document.querySelector('._subTitle_1qx9q_115 span');

    if (hiddenInput) hiddenInput.value = email;
    if (readonlyEmailInput) readonlyEmailInput.value = email;

    if (title) {
      title.textContent = mode === 'signup' ? 'Create a password' : 'Enter your password';
    }
    if (subtitle) {
      subtitle.textContent = mode === 'signup'
        ? 'You’ll use this password to log in to ChatGPT and other OpenAI products'
        : 'Enter the password for the email address you selected.';
    }
    refreshFloatingFieldStates();
  };

  const syncPendingEmailIntoVerificationPage = () => {
    const pending = matrix && matrix.getPendingAuth ? matrix.getPendingAuth() : null;
    const email = pending && pending.email ? pending.email : '';
    const mode = pending && pending.mode === 'signup' ? 'signup' : 'login';
    const emailStrong = document.querySelector('._emailAddress_jwi2b_1');
    const title = document.querySelector('h1 ._root_xeddl_1');
    const subtitle = document.querySelector('._subTitle_1qx9q_115 span');
    const resendButton = document.querySelector('button[value="resend"]');
    const verifyButton = document.querySelector('button[value="validate"]');

    if (emailStrong) emailStrong.textContent = email || 'your email address';
    if (title) {
      title.textContent = 'Check your inbox';
    }
    if (subtitle) {
      subtitle.innerHTML = `Enter the verification code we just sent to <span class="_emailAddress_jwi2b_1">${email || 'your email address'}</span>`;
    }
    if (resendButton) resendButton.textContent = 'Resend email';
    if (verifyButton) verifyButton.textContent = mode === 'signup' ? 'Continue' : 'Sign in';
    refreshFloatingFieldStates();
  };

  const syncAboutYouDefaults = () => {
    const pending = matrix && typeof matrix.getPendingAuth === 'function' ? matrix.getPendingAuth() : null;
    const nameInput = document.querySelector('input[name="name"]');
    const ageInput = document.querySelector('input[name="age"]');
    const birthdayInput = document.querySelector('input[name="birthday"]');

    if (nameInput && pending && typeof pending.name === 'string' && pending.name) {
      nameInput.value = pending.name;
      syncFloatingFieldState(nameInput);
    }

    if (ageInput && pending && Number.isFinite(pending.age)) {
      ageInput.value = String(pending.age);
      syncFloatingFieldState(ageInput);
    }

    if (birthdayInput) {
      birthdayInput.value = new Date().toISOString().slice(0, 10);
    }
    refreshFloatingFieldStates();
  };

  const goToIndex = () => {
    window.location.href = 'index.html';
  };

  const handleEmailStep = () => {
    decorateFields();
    unlockAuthInputs();
    const form = document.querySelector('form[id="_r_2_"]') || document.querySelector('form[action="/log-in-or-create-account"]');
    const submitButton = form ? form.querySelector('button[type="submit"][value="email"]') : null;
    const socialButtons = Array.from(document.querySelectorAll('button[name="intent"]')).filter((button) => button.value && button.value !== 'email');
    const emailInput = form ? form.querySelector('input[type="email"]') : null;
    const pending = matrix.getPendingAuth();

    if (emailInput && pending && pending.email) {
      emailInput.value = pending.email;
      syncFloatingFieldState(emailInput);
    }

    socialButtons.forEach((button) => {
      button.type = 'button';
      button.addEventListener('click', async (event) => {
        event.preventDefault();

        if (button.value === 'google') {
          await startOAuthSignIn('google', button);
          return;
        }

        showMessage('This provider is not configured yet in the local Matrix gate flow.');
      });
    });

    const requestedProvider = getRequestedOAuthProvider();
    if (requestedProvider === 'google') {
      const googleButton = socialButtons.find((button) => button.value === 'google');
      window.requestAnimationFrame(() => {
        startOAuthSignIn('google', googleButton || submitButton);
      });
    }

    if (!form || !submitButton || !emailInput) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage();
      const mode = matrix.getModeFromLocation();
      const email = sanitizeEmail(emailInput.value);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMessage('Enter a valid email address.');
        return;
      }

      clearAttemptStatus(PASSWORD_ATTEMPT_SCOPE, email);
      clearAttemptStatus(OTP_ATTEMPT_SCOPE, email);
      clearAttemptStatus(OTP_RESEND_SCOPE, email);
      matrix.setPendingAuth({ mode, email });

      if (mode === 'login') {
        window.location.href = 'create-account-password.html?mode=login';
        return;
      }
      window.location.href = 'create-account-password.html?mode=signup';
    });
  };

  const handlePasswordStep = () => {
    decorateFields();
    unlockAuthInputs();
    bindVisibilityToggle();
    syncPendingEmailIntoPasswordPage();

    const form = document.querySelector('form[id="_r_1j_"]') || document.querySelector('form[action="/create-account/password"]');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const passwordInput = form ? form.querySelector('input[name="new-password"]') : null;
    const pending = matrix.getPendingAuth();
    const passwordRequirementController = matrix.getModeFromLocation() === 'signup'
      ? createPasswordRequirementController(passwordInput)
      : null;

    if (!form || !submitButton || !passwordInput) return;
    if (!pending || !pending.email) {
      window.location.replace('log-in-or-create-account.html?mode=' + matrix.getModeFromLocation());
      return;
    }

    if (!passwordRequirementController) {
      setPasswordRequirementState({ visible: false, invalid: false, complete: false });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage();
      const mode = matrix.getModeFromLocation();
      const password = String(passwordInput.value || '');
      const minPasswordLength = mode === 'signup' ? SIGNUP_PASSWORD_MIN_LENGTH : DEFAULT_PASSWORD_MIN_LENGTH;

      if (passwordRequirementController) {
        passwordRequirementController.markSubmitted();
      }

      if (password.length < minPasswordLength) {
        if (mode === 'signup') {
          return;
        }
        showMessage(`Use at least ${minPasswordLength} characters in the password.`);
        return;
      }
      if (password.length > config.passwordMaxLength) {
        showMessage(`Use at most ${config.passwordMaxLength} characters in the password.`);
        return;
      }

      if (mode === 'login' && enforceThrottle(PASSWORD_ATTEMPT_SCOPE, pending.email, 'sign-in')) {
        return;
      }

      if (!requireClient()) return;

      try {
        setBusy(submitButton, true, mode === 'signup' ? 'Sending code...' : 'Signing in...');

        if (mode === 'signup') {
          matrix.setPendingAuth({
            ...pending,
            mode,
            email: pending.email,
            password
          });
          window.location.href = 'about-you.html?mode=signup';
          return;
        }

        const { data, error } = await client.auth.signInWithPassword({
          email: pending.email,
          password
        });
        if (error) throw error;

        clearAttemptStatus(PASSWORD_ATTEMPT_SCOPE, pending.email);
        passwordInput.value = '';
        matrix.startAuthenticatedSession(data && data.user ? data.user : { email: pending.email }, { provider: 'email' });
        matrix.clearPendingAuth();
        goToIndex();
      } catch (error) {
        passwordInput.value = '';
        registerFailedAttempt(PASSWORD_ATTEMPT_SCOPE, pending.email, 'sign-in');
        showMessage(error && error.message ? error.message : 'Authentication failed.');
      } finally {
        setBusy(submitButton, false);
      }
    });
  };

  const handleVerificationStep = () => {
    decorateFields();
    unlockAuthInputs();
    syncPendingEmailIntoVerificationPage();

    const verifyForm = document.querySelector('form[id="_r_5_"]') || document.querySelector('form[action="/email-verification"]');
    const resendButton = document.querySelector('button[value="resend"]');
    const verifyButton = verifyForm ? verifyForm.querySelector('button[value="validate"]') : null;
    const codeInput = verifyForm ? verifyForm.querySelector('input[name="code"]') : null;
    const pending = matrix.getPendingAuth();
    let hasTriedVerification = false;

    if (!verifyForm || !verifyButton || !codeInput) return;
    if (!pending || !pending.email) {
      window.location.replace('log-in-or-create-account.html?mode=' + matrix.getModeFromLocation());
      return;
    }

    const normalizeCodeField = () => {
      const token = sanitizeCode(codeInput.value);
      if (codeInput.value !== token) {
        codeInput.value = token;
      }

      syncFloatingFieldState(codeInput);
      return token;
    };

    codeInput.addEventListener('input', () => {
      normalizeCodeField();
      clearVerificationFieldError();
    });

    verifyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage();
      hasTriedVerification = true;

      const token = normalizeCodeField();

      if (!token.length) {
        setVerificationFieldError(VERIFICATION_REQUIRED_MESSAGE);
        return;
      }

      if (token.length !== config.otpLength) {
        setVerificationFieldError(getVerificationLengthMessage());
        return;
      }

      clearVerificationFieldError();

      if (enforceThrottle(OTP_ATTEMPT_SCOPE, pending.email, 'verification')) {
        return;
      }

      if (!requireClient()) return;

      try {
        setBusy(verifyButton, true, 'Verifying...');
        const { data, error } = await client.auth.verifyOtp({
          email: pending.email,
          token,
          type: 'email'
        });
        if (error) throw error;

        if (pending.mode === 'signup') {
          const pendingPassword = typeof pending.password === 'string' ? pending.password : '';
          if (pendingPassword.length < SIGNUP_PASSWORD_MIN_LENGTH) {
            showMessage('Choose a password before confirming the code.');
            window.location.href = 'create-account-password.html?mode=signup';
            return;
          }

          const { data: updatedUserData, error: updateError } = await client.auth.updateUser({
            password: pendingPassword
          });
          if (updateError) throw updateError;
          clearAttemptStatus(OTP_ATTEMPT_SCOPE, pending.email);
          clearAttemptStatus(OTP_RESEND_SCOPE, pending.email);
          matrix.startAuthenticatedSession(
            updatedUserData && updatedUserData.user ? updatedUserData.user : (data && data.user ? data.user : { email: pending.email }),
            { provider: 'email' }
          );
          matrix.clearPendingAuth();
          goToIndex();
          return;
        }

        clearAttemptStatus(OTP_ATTEMPT_SCOPE, pending.email);
        clearAttemptStatus(OTP_RESEND_SCOPE, pending.email);
        matrix.startAuthenticatedSession(data && data.user ? data.user : { email: pending.email }, { provider: 'email' });
        matrix.clearPendingAuth();
        goToIndex();
      } catch (error) {
        registerFailedAttempt(OTP_ATTEMPT_SCOPE, pending.email, 'verification');
        setVerificationFieldError(error && error.message ? error.message : 'Unable to verify the code.');
      } finally {
        setBusy(verifyButton, false);
      }
    });

    if (resendButton) {
      resendButton.type = 'button';
      resendButton.addEventListener('click', async (event) => {
        event.preventDefault();
        clearMessage();

        if (enforceThrottle(OTP_RESEND_SCOPE, pending.email, 'verification code resend')) {
          return;
        }

        if (!requireClient()) return;
        try {
          setBusy(resendButton, true, 'Sending again...');
          const { error } = await client.auth.signInWithOtp({
            email: pending.email,
            options: {
              shouldCreateUser: pending.mode === 'signup'
            }
          });
          if (error) throw error;
          startCooldown(OTP_RESEND_SCOPE, pending.email, OTP_RESEND_COOLDOWN_MS, 'resend_cooldown');
          showMessage('A new verification code was sent to your email.', 'success');
        } catch (error) {
          showMessage(error && error.message ? error.message : 'Unable to resend the code.');
        } finally {
          setBusy(resendButton, false);
        }
      });
    }
  };

  const handleAboutYouStep = () => {
    decorateFields();
    unlockAuthInputs();
    syncAboutYouDefaults();
    const AGE_ERROR_MESSAGE = 'Enter a valid age to continue';
    const AGE_ERROR_ID = 'react-aria5631790494-_r_s_';

    const form =
      document.querySelector('form[id="_r_h_"]') ||
      document.querySelector('form[id="_r_3_"]') ||
      document.querySelector('form[action="/about-you"]');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const nameInput = form ? form.querySelector('input[name="name"]') : null;
    const ageInput = form ? form.querySelector('input[name="age"]') : null;
    const pending = matrix.getPendingAuth();

    if (!form || !submitButton || !nameInput || !ageInput) return;
    if (!pending || !pending.email || pending.mode !== 'signup') {
      window.location.replace('log-in-or-create-account.html?mode=signup');
      return;
    }

    const clearErrors = () => {
      clearAboutYouFieldError('name');
      clearAboutYouFieldError('age');
      const birthdayInput = form.querySelector('input[name="birthday"]');
      if (birthdayInput instanceof HTMLElement) {
        birthdayInput.removeAttribute('aria-invalid');
        birthdayInput.removeAttribute('aria-describedby');
      }
    };

    nameInput.addEventListener('input', () => {
      syncFloatingFieldState(nameInput);
      clearAboutYouFieldError('name');
    });

    const syncAgeFieldState = () => {
      syncFloatingFieldState(ageInput);
      clearAboutYouFieldError('age');
    };

    ageInput.addEventListener('input', syncAgeFieldState);
    ageInput.addEventListener('change', syncAgeFieldState);
    ageInput.addEventListener('blur', syncAgeFieldState);

    clearErrors();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage();
      clearErrors();

      const name = String(nameInput.value || '').trim();
      const ageValue = String(ageInput.value || '').trim();
      const age = Number(ageValue);
      const isAgeValid = Number.isInteger(age) && age >= 5 && age <= 130;

      let hasError = false;

      if (!name) {
        setAboutYouFieldError('name', 'Please enter name to continue', 'react-aria5631790494-_r_n_');
        hasError = true;
      }

      if (!isAgeValid) {
        setAboutYouFieldError('age', AGE_ERROR_MESSAGE, AGE_ERROR_ID);
        hasError = true;
      }

      if (hasError) {
        return;
      }

      try {
        setBusy(submitButton, true);
        matrix.setPendingAuth({
          ...pending,
          name,
          age
          });
          window.location.href =
            'what-brings-you-to-chatgpt.html?next=' +
            encodeURIComponent(
              'how-do-you-plan-to-use-chatgpt.html?next=' +
                encodeURIComponent('log-in-or-create-account.html?mode=signup')
            );
        } catch (error) {
          showMessage(error && error.message ? error.message : 'Unable to continue.');
        } finally {
        setBusy(submitButton, false);
      }
    });
  };

  const init = () => {
    if (!matrix) return;
    unlockAuthInputs();
    window.requestAnimationFrame(unlockAuthInputs);
    window.setTimeout(unlockAuthInputs, 150);
    refreshFloatingFieldStates();
    window.requestAnimationFrame(refreshFloatingFieldStates);
    window.setTimeout(refreshFloatingFieldStates, 150);
    const page = getPageName();
    if (page === AUTH_PAGE_EMAIL) {
      handleEmailStep();
    } else if (page === AUTH_PAGE_PASSWORD) {
      handlePasswordStep();
    } else if (page === AUTH_PAGE_VERIFY) {
      handleVerificationStep();
    } else if (page === AUTH_PAGE_ABOUT) {
      handleAboutYouStep();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
