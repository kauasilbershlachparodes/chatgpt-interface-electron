(() => {
  const STORAGE_KEY = 'matrix.onboarding.usage_plan.v1';
  const DEFAULT_LOGIN_URL = 'log-in-or-create-account.html?mode=signup';
  const TOUR_PAGE_URL = 'ask-anything-tour.html';

  const safeParse = (value) => {
    if (!value || typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  };

  const getSerialization = () => window.MatrixSession && window.MatrixSession.SerializationSecurity
    ? window.MatrixSession.SerializationSecurity
    : null;

  const normalizeState = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const selected = typeof payload.selected === 'string' ? payload.selected.trim().slice(0, 80) : '';

    return {
      selected,
      skipped: Boolean(payload.skipped),
      updatedAt: Number.isFinite(payload.updatedAt) ? Number(payload.updatedAt) : Date.now()
    };
  };

  const readState = () => {
    const serialization = getSerialization();
    if (serialization) {
      return serialization.readStorage(STORAGE_KEY, {
        storage: 'session',
        type: 'matrix.onboarding.usage-plan',
        normalize: normalizeState
      });
    }

    try {
      return normalizeState(safeParse(window.sessionStorage.getItem(STORAGE_KEY)));
    } catch (_error) {
      return null;
    }
  };

  const writeState = (payload) => {
    const serialization = getSerialization();
    if (serialization) {
      serialization.writeStorage(STORAGE_KEY, payload, {
        storage: 'session',
        type: 'matrix.onboarding.usage-plan',
        normalize: normalizeState
      });
      return;
    }

    try {
      const normalized = normalizeState(payload);
      if (normalized) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch (_error) {
      // noop
    }
  };

  const buildTourUrl = (finalNext = DEFAULT_LOGIN_URL) => {
    const normalizedFinalNext = String(finalNext || DEFAULT_LOGIN_URL).trim() || DEFAULT_LOGIN_URL;
    return `${TOUR_PAGE_URL}?next=${encodeURIComponent(normalizedFinalNext)}`;
  };

  const isVerificationUrl = (value) => /^email-verification(?:\.html)?(?:\?|$)/i.test(String(value || '').trim());
  const isTourUrl = (value) => /^ask-anything-tour(?:\.html)?(?:\?|$)/i.test(String(value || '').trim());

  const getNextUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = String(params.get('next') || '').trim();
      const safeNext = window.MatrixSession && typeof window.MatrixSession.sanitizeNextUrl === 'function'
        ? window.MatrixSession.sanitizeNextUrl(next, DEFAULT_LOGIN_URL, [/^email-verification(?:\.html)?(?:\?|$)/i])
        : next;

      if (!safeNext || isVerificationUrl(safeNext)) {
        return buildTourUrl(DEFAULT_LOGIN_URL);
      }
      if (isTourUrl(safeNext)) {
        return safeNext;
      }
      return buildTourUrl(safeNext);
    } catch (_error) {
      return buildTourUrl(DEFAULT_LOGIN_URL);
    }
  };

  const setMessage = (message = '') => {
    const host = document.querySelector('[data-usage-message]');
    if (!(host instanceof HTMLElement)) {
      if (message) {
        window.alert(message);
      }
      return;
    }

    host.textContent = message;
    host.classList.toggle('hidden', !message);
  };

  const init = () => {
    const matrix = window.MatrixSession;
    const dialog = document.querySelector('[data-usage-dialog]');
    const optionButtons = Array.from(document.querySelectorAll('[data-usage-option]'));
    const continueButton = document.querySelector('[data-usage-continue]');
    const skipButton = document.querySelector('[data-usage-skip]');

    if (
      !(dialog instanceof HTMLDialogElement) ||
      !(continueButton instanceof HTMLButtonElement) ||
      !(skipButton instanceof HTMLButtonElement) ||
      !optionButtons.length
    ) {
      return;
    }

    const pending = matrix && typeof matrix.getPendingAuth === 'function'
      ? matrix.getPendingAuth()
      : null;

    if (!pending || !pending.email || pending.mode !== 'signup') {
      window.location.replace(DEFAULT_LOGIN_URL);
      return;
    }

    let selectedValue = '';
    const persisted = readState();

    if (persisted && typeof persisted.selected === 'string' && persisted.selected.trim()) {
      selectedValue = persisted.selected.trim();
    } else if (
      pending &&
      typeof pending.onboardingUsageMode === 'string' &&
      pending.onboardingUsageMode.trim()
    ) {
      selectedValue = pending.onboardingUsageMode.trim();
    }

    const render = () => {
      optionButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;

        const value = String(button.dataset.usageValue || '').trim();
        const isSelected = value && value === selectedValue;
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        button.classList.toggle('bg-token-interactive-bg-secondary-selected', isSelected);
        button.classList.toggle('max-sm:bg-token-interactive-bg-secondary-selected', isSelected);
        button.classList.toggle('hover:bg-token-interactive-bg-secondary-hover', !isSelected);
        button.classList.toggle('max-sm:bg-token-interactive-bg-secondary-hover', !isSelected);
      });

      const canContinue = Boolean(selectedValue);
      continueButton.disabled = !canContinue;
      continueButton.classList.toggle('cursor-not-allowed', !canContinue);
      if (canContinue) {
        continueButton.removeAttribute('data-visually-disabled');
      } else {
        continueButton.setAttribute('data-visually-disabled', 'true');
      }
    };

    const persistSelection = (isSkipped) => {
      writeState({
        selected: isSkipped ? '' : selectedValue,
        skipped: Boolean(isSkipped),
        updatedAt: Date.now(),
      });
    };

    const setBusy = (isBusy) => {
      continueButton.disabled = isBusy || !selectedValue;
      skipButton.disabled = isBusy;
    };

    const submitAndContinue = async (isSkipped) => {
      if (!isSkipped && !selectedValue) {
        render();
        return;
      }

      try {
        setMessage('');
        setBusy(true);

        if (matrix && typeof matrix.setPendingAuth === 'function') {
          matrix.setPendingAuth({
            ...pending,
            onboardingUsageMode: isSkipped ? '' : selectedValue,
          });
        }

        persistSelection(isSkipped);
        window.location.href = getNextUrl();
      } catch (error) {
        setMessage(
          error && error.message
            ? error.message
            : 'Unable to continue right now.',
        );
      } finally {
        setBusy(false);
        render();
      }
    };

    optionButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;

      button.addEventListener('click', () => {
        const value = String(button.dataset.usageValue || '').trim();
        if (!value) return;

        selectedValue = value;
        setMessage('');
        persistSelection(false);
        render();
      });
    });

    continueButton.addEventListener('click', async () => {
      await submitAndContinue(false);
    });

    skipButton.addEventListener('click', async () => {
      selectedValue = '';
      await submitAndContinue(true);
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
    });

    render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
