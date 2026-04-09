// src/js/splash-headline.js
(() => {
  const STORAGE_KEY = 'stage-splash-headline-index';
  const HEADLINES = [
    'What\u2019s on the agenda today?',
    'What are you working on?',
    'What\u2019s on your mind today?',
    'Where should we begin?'
  ];

  const getNextHeadline = () => {
    if (typeof window.__stageSplashHeadlineValue === 'string' && window.__stageSplashHeadlineValue) {
      return window.__stageSplashHeadlineValue;
    }

    let currentIndex = -1;

    try {
      currentIndex = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || '-1', 10);
    } catch (error) {
      currentIndex = -1;
    }

    const normalizedIndex = Number.isInteger(currentIndex) && currentIndex >= 0
      ? currentIndex % HEADLINES.length
      : -1;
    const nextIndex = (normalizedIndex + 1 + HEADLINES.length) % HEADLINES.length;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextIndex));
    } catch (error) {
      // ignore storage failures
    }

    window.__stageSplashHeadlineValue = HEADLINES[nextIndex];
    return window.__stageSplashHeadlineValue;
  };

  const applySplashHeadlineRotation = () => {
    const containers = Array.from(document.querySelectorAll('[data-splash-headline-option="ON_YOUR_MIND"] .text-pretty.whitespace-pre-wrap'));
    if (!containers.length) {
      return false;
    }

    const nextHeadline = getNextHeadline();
    containers.forEach((node) => {
      node.textContent = nextHeadline;
    });

    return true;
  };

  if (!applySplashHeadlineRotation() && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySplashHeadlineRotation, { once: true });
  }
})();
