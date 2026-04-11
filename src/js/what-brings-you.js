(() => {
  const STORAGE_KEY = 'matrix.onboarding.what_brings_you.v1';
  const DEFAULT_LOGIN_URL = 'log-in-or-create-account.html?mode=signup';
  const PLAN_PAGE_URL = 'how-do-you-plan-to-use-chatgpt.html';

  const safeParse = (value) => {
    if (!value || typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  };

  const readState = () => {
    try {
      return safeParse(window.sessionStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      return null;
    }
  };

  const writeState = (payload) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_error) {
      // noop
    }
  };

  const buildPlanUrl = (finalNext = DEFAULT_LOGIN_URL) =>
    `${PLAN_PAGE_URL}?next=${encodeURIComponent(String(finalNext || DEFAULT_LOGIN_URL).trim() || DEFAULT_LOGIN_URL)}`;

  const isPlanUrl = (value) => /^how-do-you-plan-to-use-chatgpt(?:\.html)?(?:\?|$)/i.test(String(value || '').trim());

  const isVerificationUrl = (value) => /^email-verification(?:\.html)?(?:\?|$)/i.test(String(value || '').trim());

  const getNextUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = String(params.get('next') || '').trim();
      const safeNext = window.MatrixSession && typeof window.MatrixSession.sanitizeNextUrl === 'function'
        ? window.MatrixSession.sanitizeNextUrl(next, DEFAULT_LOGIN_URL, [/^email-verification(?:\.html)?(?:\?|$)/i])
        : next;

      if (!safeNext) {
        return buildPlanUrl(DEFAULT_LOGIN_URL);
      }

      if (isPlanUrl(safeNext)) {
        return safeNext;
      }

      if (isVerificationUrl(safeNext)) {
        return buildPlanUrl(DEFAULT_LOGIN_URL);
      }

      return buildPlanUrl(safeNext);
    } catch (_error) {
      return buildPlanUrl(DEFAULT_LOGIN_URL);
    }
  };

  const setMessage = (message = '') => {
    const host = document.querySelector('[data-purpose-message]');
    if (!(host instanceof HTMLElement)) {
      if (message) {
        window.alert(message);
      }
      return;
    }

    host.textContent = message;
    host.classList.toggle('hidden', !message);
  };

  const setBusy = (buttons, isBusy) => {
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = isBusy;
    });
  };

  const init = () => {
    const matrix = window.MatrixSession;
    const dialog = document.querySelector('[data-what-brings-you-dialog]');
    const optionButtons = Array.from(
      document.querySelectorAll('[data-purpose-option]'),
    );
    const nextButton = document.querySelector('[data-purpose-next]');
    const skipButton = document.querySelector('[data-purpose-skip]');

    if (
      !(dialog instanceof HTMLDialogElement) ||
      !(nextButton instanceof HTMLButtonElement) ||
      !(skipButton instanceof HTMLButtonElement) ||
      !optionButtons.length
    ) {
      return;
    }

    const pending = matrix && typeof matrix.getPendingAuth === 'function'
      ? matrix.getPendingAuth()
      : null;

    if (!pending || !pending.email || pending.mode !== 'signup') {
      window.location.replace('log-in-or-create-account.html?mode=signup');
      return;
    }

    let selectedValues = [];
    const persisted = readState();
    if (persisted && Array.isArray(persisted.selected)) {
      selectedValues = persisted.selected
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    } else if (
      persisted &&
      typeof persisted.selected === 'string' &&
      persisted.selected.trim()
    ) {
      selectedValues = [persisted.selected.trim()];
    } else if (pending && Array.isArray(pending.onboardingPurposes)) {
      selectedValues = pending.onboardingPurposes
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    } else if (
      pending &&
      typeof pending.onboardingPurpose === 'string' &&
      pending.onboardingPurpose.trim()
    ) {
      selectedValues = [pending.onboardingPurpose.trim()];
    }

    const render = () => {
      optionButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;

        const value = String(button.dataset.purposeValue || '').trim();
        const isSelected = selectedValues.includes(value);
        button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        button.classList.toggle(
          'bg-token-interactive-bg-secondary-selected',
          isSelected,
        );
        button.classList.toggle(
          'max-sm:bg-token-interactive-bg-secondary-selected',
          isSelected,
        );
        button.classList.toggle(
          'hover:bg-token-interactive-bg-secondary-hover',
          !isSelected,
        );
        button.classList.toggle(
          'max-sm:bg-token-interactive-bg-secondary-hover',
          !isSelected,
        );

        if (isSelected) {
          button.dataset.state = 'selected';
        } else {
          delete button.dataset.state;
        }
      });

      nextButton.dataset.enabled = 'true';
      nextButton.disabled = false;
    };

    const persistSelection = (isSkipped) => {
      writeState({
        selected: selectedValues,
        skipped: Boolean(isSkipped),
        updatedAt: Date.now(),
      });
    };

    const submitAndContinue = async (isSkipped) => {
      try {
        setMessage('');
        setBusy([nextButton, skipButton], true);

        if (matrix && typeof matrix.setPendingAuth === 'function') {
          matrix.setPendingAuth({
            ...pending,
            onboardingPurpose: isSkipped ? '' : selectedValues[0] || '',
            onboardingPurposes: isSkipped ? [] : selectedValues,
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
        setBusy([nextButton, skipButton], false);
        render();
      }
    };

    optionButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;

      button.addEventListener('click', () => {
        const value = String(button.dataset.purposeValue || '').trim();
        if (!value) return;

        if (selectedValues.includes(value)) {
          selectedValues = selectedValues.filter((entry) => entry !== value);
        } else {
          selectedValues = [...selectedValues, value];
        }

        setMessage('');
        persistSelection(false);
        render();
      });
    });

    nextButton.addEventListener('click', async () => {
      await submitAndContinue(false);
    });

    skipButton.addEventListener('click', async () => {
      selectedValues = [];
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
