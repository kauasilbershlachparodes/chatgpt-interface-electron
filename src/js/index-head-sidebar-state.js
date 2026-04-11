(() => {
        const storageKey = 'stage-slideover-sidebar-state';
        const cookieKey = 'stage_slideover_sidebar_state';
        let persistedState = null;

        try {
          const storedValue = window.localStorage.getItem(storageKey);
          if (storedValue === 'expanded' || storedValue === 'collapsed') {
            persistedState = storedValue;
          }
        } catch (error) {
          persistedState = null;
        }

        if (!persistedState) {
          const cookies = String(document.cookie || '').split(';');
          for (const rawCookie of cookies) {
            const cookie = rawCookie.trim();
            if (!cookie.startsWith(`${cookieKey}=`)) {
              continue;
            }

            const value = decodeURIComponent(cookie.slice(cookieKey.length + 1));
            if (value === 'expanded' || value === 'collapsed') {
              persistedState = value;
              break;
            }
          }
        }

        if (persistedState === 'expanded' || persistedState === 'collapsed') {
          document.documentElement.setAttribute('data-sidebar-desktop-state', persistedState);
        }
      })();
