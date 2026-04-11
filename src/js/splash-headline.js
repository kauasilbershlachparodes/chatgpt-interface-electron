// src/js/splash-headline.js
(() => {
  const STORAGE_KEY = 'stage-splash-headline-index';
  const HEADLINES = [
    'What\u2019s on the agenda today?',
    'What are you working on?',
    'What\u2019s on your mind today?',
    'Where should we begin?'
  ];

  const getSerialization = () => window.MatrixSession && window.MatrixSession.SerializationSecurity
    ? window.MatrixSession.SerializationSecurity
    : null;

  const normalizeHeadlineState = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const index = Number.parseInt(String(payload.index ?? -1), 10);
    return {
      index: Number.isInteger(index) ? index : -1
    };
  };

  const getNextHeadline = () => {
    if (typeof window.__stageSplashHeadlineValue === 'string' && window.__stageSplashHeadlineValue) {
      return window.__stageSplashHeadlineValue;
    }

    let currentIndex = -1;
    const serialization = getSerialization();

    if (serialization) {
      const state = serialization.readStorage(STORAGE_KEY, {
        storage: 'local',
        type: 'stage.splash.headline',
        normalize: normalizeHeadlineState
      });
      currentIndex = state && Number.isInteger(state.index) ? state.index : -1;
    } else {
      try {
        currentIndex = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || '-1', 10);
      } catch (error) {
        currentIndex = -1;
      }
    }

    const normalizedIndex = Number.isInteger(currentIndex) && currentIndex >= 0
      ? currentIndex % HEADLINES.length
      : -1;
    const nextIndex = (normalizedIndex + 1 + HEADLINES.length) % HEADLINES.length;

    if (serialization) {
      serialization.writeStorage(STORAGE_KEY, { index: nextIndex }, {
        storage: 'local',
        type: 'stage.splash.headline',
        normalize: normalizeHeadlineState
      });
    } else {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(nextIndex));
      } catch (error) {
        // ignore storage failures
      }
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
