(() => {
  const DEFAULT_LOGIN_URL = 'log-in-or-create-account.html?mode=signup';

  const isVerificationUrl = (value) => /^email-verification(?:\.html)?(?:\?|$)/i.test(String(value || '').trim());
  const isTourUrl = (value) => /^ask-anything-tour(?:\.html)?(?:\?|$)/i.test(String(value || '').trim());

  const getNextUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = String(params.get('next') || '').trim();
      return window.MatrixSession && typeof window.MatrixSession.sanitizeNextUrl === 'function'
        ? window.MatrixSession.sanitizeNextUrl(next, DEFAULT_LOGIN_URL, [/^email-verification(?:\.html)?(?:\?|$)/i, /^ask-anything-tour(?:\.html)?(?:\?|$)/i])
        : (!next || isVerificationUrl(next) || isTourUrl(next) ? DEFAULT_LOGIN_URL : next);
    } catch (_error) {
      return DEFAULT_LOGIN_URL;
    }
  };

  const init = () => {
    const matrix = window.MatrixSession;
    const dialog = document.querySelector('[data-ask-anything-dialog]');
    const nextButtons = Array.from(document.querySelectorAll('[data-ask-anything-next]'));
    const skipButtons = Array.from(document.querySelectorAll('[data-ask-anything-skip]'));

    if (!(dialog instanceof HTMLDialogElement) || !nextButtons.length || !skipButtons.length) {
      return;
    }

    const pending = matrix && typeof matrix.getPendingAuth === 'function'
      ? matrix.getPendingAuth()
      : null;

    if (!pending || pending.mode !== 'signup') {
      window.location.replace(DEFAULT_LOGIN_URL);
      return;
    }

    const goNext = () => {
      window.location.href = getNextUrl();
    };

    nextButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.addEventListener('click', goNext);
      }
    });

    skipButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.addEventListener('click', goNext);
      }
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
