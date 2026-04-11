(() => {
        const anchor = document.getElementById('cookie-consent-anchor');
        if (!anchor) {
          return;
        }
        const root = document.documentElement;
        const slot = document.getElementById('cookie-consent-slot');

        const cookieName = 'matrix_cookie_consent';
        const storageKey = 'matrix_cookie_consent';
        const preferencesStorageKey = 'matrix_cookie_preferences';
        const maxAge = 60 * 60 * 24 * 180;
        const modalRoot = document.getElementById('cookie-preferences-root');
        const modal = document.getElementById('modal-cookie-preferences');
        const modalCloseButton = modalRoot?.querySelector(
          '[data-testid="close-button"]',
        );
        const analyticsToggle = modalRoot?.querySelector(
          'button[role="switch"][aria-labelledby="_r_q_"]',
        );
        const marketingToggle = modalRoot?.querySelector(
          'button[role="switch"][aria-labelledby="_r_s_"]',
        );

        if (slot && anchor.parentElement !== slot) {
          slot.appendChild(anchor);
        }

        const getStoredPreferences = () => {
          try {
            const parsed = JSON.parse(
              window.localStorage.getItem(preferencesStorageKey) || '{}',
            );

            return {
              analytics: Boolean(parsed.analytics),
              marketing: Boolean(parsed.marketing),
            };
          } catch (error) {
            return {
              analytics: false,
              marketing: false,
            };
          }
        };

        const setStoredPreferences = (preferences) => {
          try {
            window.localStorage.setItem(
              preferencesStorageKey,
              JSON.stringify(preferences),
            );
          } catch (error) {
          }
        };

        const setToggleState = (button, checked) => {
          if (!button) {
            return;
          }

          const state = checked ? 'checked' : 'unchecked';
          button.setAttribute('aria-checked', checked ? 'true' : 'false');
          button.setAttribute('data-state', state);

          const thumb = button.querySelector('span');
          if (thumb) {
            thumb.setAttribute('data-state', state);
          }
        };

        const syncPreferenceToggles = (preferences = getStoredPreferences()) => {
          setToggleState(analyticsToggle, preferences.analytics);
          setToggleState(marketingToggle, preferences.marketing);
        };

        const openPreferencesModal = () => {
          if (!modalRoot) {
            return;
          }

          syncPreferenceToggles();
          modalRoot.hidden = false;
          document.documentElement.setAttribute(
            'data-cookie-modal-open',
            'true',
          );
        };

        const closePreferencesModal = () => {
          if (!modalRoot) {
            return;
          }

          modalRoot.hidden = true;
          root.removeAttribute('data-cookie-modal-open');
        };

        const persistDecision = (value, preferencesOverride = null) => {
          if (preferencesOverride) {
            setStoredPreferences(preferencesOverride);
            syncPreferenceToggles(preferencesOverride);
          }

          try {
            window.localStorage.setItem(storageKey, value);
          } catch (error) {
          }

          document.cookie = `${encodeURIComponent(cookieName)}=${encodeURIComponent(
            value,
          )}; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.documentElement.setAttribute(
            'data-cookie-banner-hidden',
            'true',
          );
          anchor.style.display = 'none';
          closePreferencesModal();
        };

        const bind = (id, handler) => {
          const element = document.getElementById(id);
          if (!element) {
            return;
          }

          element.addEventListener('click', handler);
        };

        bind('cookie-consent-close', () => persistDecision('dismissed'));
        bind('cookie-consent-reject', () =>
          persistDecision('rejected', {
            analytics: false,
            marketing: false,
          }),
        );
        bind('cookie-consent-accept', () =>
          persistDecision('accepted', {
            analytics: true,
            marketing: true,
          }),
        );
        bind('cookie-consent-manage', openPreferencesModal);
        bind('cookie-consent-manage-inline', openPreferencesModal);

        modalCloseButton?.addEventListener('click', closePreferencesModal);

        modal?.addEventListener('click', (event) => {
          if (event.target === modal) {
            closePreferencesModal();
          }
        });

        document.addEventListener('keydown', (event) => {
          if (
            event.key === 'Escape' &&
            document.documentElement.getAttribute('data-cookie-modal-open') ===
              'true'
          ) {
            closePreferencesModal();
          }
        });

        analyticsToggle?.addEventListener('click', () => {
          const preferences = getStoredPreferences();
          const next = {
            ...preferences,
            analytics: !preferences.analytics,
          };

          setStoredPreferences(next);
          syncPreferenceToggles(next);
        });

        marketingToggle?.addEventListener('click', () => {
          const preferences = getStoredPreferences();
          const next = {
            ...preferences,
            marketing: !preferences.marketing,
          };

          setStoredPreferences(next);
          syncPreferenceToggles(next);
        });

        const footerCookieLink = Array.from(
          document.querySelectorAll('a.cursor-pointer'),
        ).find((element) =>
          /cookie preferences/i.test(element.textContent || ''),
        );

        footerCookieLink?.addEventListener('click', (event) => {
          event.preventDefault();
          openPreferencesModal();
        });

        syncPreferenceToggles();
      })();
