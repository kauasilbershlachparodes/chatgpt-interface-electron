(() => {
  const AUTH_PAGE_EMAIL = 'log-in-or-create-account.html';
  const AUTH_PAGE_PASSWORD = 'create-account-password.html';
  const AUTH_PAGE_VERIFY = 'email-verification.html';
  const DEFAULT_PROJECT_URL = 'https://xkkrbnxqtrfjzbasvocz.supabase.co';
  const DEFAULT_ANON_KEY = 'sb_publishable_MhEwBmkNjTFAMSZniI5XzQ_45tNsIYX';

  const getConfig = () => {
    const bridgeConfig = window.electronAPI && window.electronAPI.authConfig ? window.electronAPI.authConfig : {};
    const inlineConfig = window.__MATRIX_SUPABASE_CONFIG__ || window.__ILLUMINATI_SUPABASE_CONFIG__ || {};
    return {
      supabaseUrl: bridgeConfig.supabaseUrl || inlineConfig.supabaseUrl || DEFAULT_PROJECT_URL,
      anonKey: bridgeConfig.anonKey || bridgeConfig.supabaseKey || inlineConfig.anonKey || inlineConfig.supabaseKey || DEFAULT_ANON_KEY,
      otpLength: bridgeConfig.otpLength || inlineConfig.otpLength || 6,
      emailMaxLength: bridgeConfig.emailMaxLength || inlineConfig.emailMaxLength || 254,
      passwordMaxLength: bridgeConfig.passwordMaxLength || inlineConfig.passwordMaxLength || 72
    };
  };

  const config = getConfig();
  const matrix = window.MatrixSession;
  const client = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(config.supabaseUrl, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce'
        }
      })
    : null;

  const getPageName = () => window.location.pathname.split('/').pop() || '';

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
  const VERIFICATION_REQUIRED_MESSAGE = 'The verification code is required';
  const getVerificationLengthMessage = () => `The verification code should be exactly ${config.otpLength} characters long`;
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
    showMessage('Supabase client is not available on this page.');
    return false;
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

    const footprint = field.closest('._fieldFootprint_18qcl_59');
    if (!footprint) return;

    const hasValue = String(field.value || '').trim().length > 0;
    const isFocused = document.activeElement === field;

    footprint.classList.toggle('_hasValue_18qcl_151', hasValue);

    if (isFocused) {
      field.setAttribute('data-focused', '');
      field.setAttribute('data-focus-within', '');
    } else {
      field.removeAttribute('data-focused');
      field.removeAttribute('data-focus-within');
    }
  };

  const refreshFloatingFieldStates = () => {
    document
      .querySelectorAll('input._target_18qcl_134, textarea._target_18qcl_134')
      .forEach((field) => syncFloatingFieldState(field));
  };

  const bindFloatingFieldState = (field) => {
    if (!(field instanceof HTMLElement)) return;

    if (field.dataset.floatingStateBound === 'true') {
      syncFloatingFieldState(field);
      return;
    }

    field.dataset.floatingStateBound = 'true';

    const handleStateSync = () => syncFloatingFieldState(field);

    field.addEventListener('focus', handleStateSync);
    field.addEventListener('blur', handleStateSync);
    field.addEventListener('input', handleStateSync);
    field.addEventListener('change', handleStateSync);

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
      passwordInput.minLength = 8;
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
      button.addEventListener('click', (event) => {
        event.preventDefault();
        showMessage('This provider is not configured yet in the local Matrix gate flow.');
      });
    });

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

      matrix.setPendingAuth({ mode, email });

      if (mode === 'login') {
        window.location.href = 'create-account-password.html?mode=login';
        return;
      }

      if (!requireClient()) return;

      try {
        setBusy(submitButton, true, 'Sending code...');
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true
          }
        });
        if (error) throw error;
        window.location.href = 'email-verification.html?mode=signup';
      } catch (error) {
        showMessage(error && error.message ? error.message : 'Unable to send the verification code.');
      } finally {
        setBusy(submitButton, false);
      }
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

    if (!form || !submitButton || !passwordInput) return;
    if (!pending || !pending.email) {
      window.location.replace('log-in-or-create-account.html?mode=' + matrix.getModeFromLocation());
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage();
      const mode = matrix.getModeFromLocation();
      const password = String(passwordInput.value || '');

      if (password.length < 8) {
        showMessage('Use at least 8 characters in the password.');
        return;
      }
      if (password.length > config.passwordMaxLength) {
        showMessage(`Use at most ${config.passwordMaxLength} characters in the password.`);
        return;
      }
      if (!requireClient()) return;

      try {
        setBusy(submitButton, true, mode === 'signup' ? 'Saving password...' : 'Signing in...');

        if (mode === 'signup') {
          const { data, error } = await client.auth.updateUser({ password });
          if (error) throw error;
          matrix.startAuthenticatedSession(data && data.user ? data.user : { email: pending.email });
          matrix.clearPendingAuth();
          goToIndex();
          return;
        }

        const { data, error } = await client.auth.signInWithPassword({
          email: pending.email,
          password
        });
        if (error) throw error;
        matrix.startAuthenticatedSession(data && data.user ? data.user : { email: pending.email });
        matrix.clearPendingAuth();
        goToIndex();
      } catch (error) {
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
          window.location.href = 'create-account-password.html?mode=signup';
          return;
        }

        matrix.startAuthenticatedSession(data && data.user ? data.user : { email: pending.email });
        matrix.clearPendingAuth();
        goToIndex();
      } catch (error) {
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
          showMessage('A new verification code was sent to your email.', 'success');
        } catch (error) {
          showMessage(error && error.message ? error.message : 'Unable to resend the code.');
        } finally {
          setBusy(resendButton, false);
        }
      });
    }
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
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
