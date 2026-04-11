(() => {
  const init = () => {
    const anchor = document.getElementById('google-one-tap-anchor');
    const closeButton = document.getElementById('google-one-tap-close');
    const continueButton = document.getElementById('google-one-tap-continue');

    if (closeButton instanceof HTMLButtonElement && closeButton.dataset.bound !== 'true') {
      closeButton.dataset.bound = 'true';
      closeButton.addEventListener('click', () => {
        if (anchor instanceof HTMLElement) {
          anchor.style.display = 'none';
        }
      });
    }

    if (continueButton instanceof HTMLButtonElement && continueButton.dataset.bound !== 'true') {
      continueButton.dataset.bound = 'true';
      continueButton.addEventListener('click', () => {
        if (typeof window.openMatrixGoogleAuthPopup === 'function') {
          window.openMatrixGoogleAuthPopup('login', { source: 'google_one_tap' });
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
