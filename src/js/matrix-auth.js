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
      otpLength: bridgeConfig.otpLength || inlineConfig.otpLength || 8,
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

  const setBusy = (button, isBusy, busyText = 'Please wait...') => {
    if (!(button instanceof HTMLElement)) return;
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent.trim();
    }
    button.disabled = isBusy;
    button.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
    button.textContent = isBusy ? busyText : button.dataset.originalLabel;
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
    });
  };

  const bindVisibilityToggle = () => {
    const toggleButton = document.querySelector('button[aria-controls="_r_1j_-new-password"]');
    const passwordInput = document.querySelector('input[name="new-password"]');
    if (!toggleButton || !passwordInput) return;

    toggleButton.addEventListener('click', () => {
      const nextVisible = passwordInput.type === 'password';
      passwordInput.type = nextVisible ? 'text' : 'password';
      toggleButton.setAttribute('aria-pressed', nextVisible ? 'true' : 'false');
      toggleButton.setAttribute('aria-label', nextVisible ? 'Hide password' : 'Show password');
    });
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
      title.textContent = mode === 'signup' ? 'Enter verification code' : 'Verify your sign in';
    }
    if (subtitle) {
      subtitle.innerHTML = `Enter the verification code we just sent to <strong class="_emailAddress_jwi2b_1">${email || 'your email address'}</strong>`;
    }
    if (resendButton) resendButton.textContent = 'Resend code';
    if (verifyButton) verifyButton.textContent = mode === 'signup' ? 'Continue' : 'Sign in';
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

    if (!verifyForm || !verifyButton || !codeInput) return;
    if (!pending || !pending.email) {
      window.location.replace('log-in-or-create-account.html?mode=' + matrix.getModeFromLocation());
      return;
    }

    verifyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage();
      const token = sanitizeCode(codeInput.value);

      if (token.length !== config.otpLength) {
        showMessage(`Enter the ${config.otpLength}-digit code.`);
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
          window.location.href = 'create-account-password.html?mode=signup';
          return;
        }

        matrix.startAuthenticatedSession(data && data.user ? data.user : { email: pending.email });
        matrix.clearPendingAuth();
        goToIndex();
      } catch (error) {
        showMessage(error && error.message ? error.message : 'Unable to verify the code.');
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
