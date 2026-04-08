(() => {
  const init = () => {
    const matrix = window.MatrixSession;
    if (!matrix) return;

    const loginButton = document.querySelector('[data-testid="login-button"]');
    const signupButton = document.querySelector('[data-testid="signup-button"]');
    const tryFirstButton = Array.from(document.querySelectorAll('button')).find((button) => /try it first/i.test(button.textContent || ''));

    if (loginButton) {
      loginButton.type = 'button';
      loginButton.addEventListener('click', () => {
        matrix.clearPendingAuth();
        matrix.setPendingAuth({ mode: 'login', email: '' });
        window.location.href = 'log-in-or-create-account.html?mode=login';
      });
    }

    if (signupButton) {
      signupButton.type = 'button';
      signupButton.addEventListener('click', () => {
        matrix.clearPendingAuth();
        matrix.setPendingAuth({ mode: 'signup', email: '' });
        window.location.href = 'log-in-or-create-account.html?mode=signup';
      });
    }

    if (tryFirstButton) {
      tryFirstButton.type = 'button';
      tryFirstButton.addEventListener('click', () => {
        matrix.clearPendingAuth();
        matrix.startGuestSession();
        window.location.href = 'index.html';
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
