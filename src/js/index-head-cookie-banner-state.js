(() => {
        const cookieName = 'matrix_cookie_consent';
        const storageKey = 'matrix_cookie_consent';

        const getCookieValue = (name) => {
          const cookies = String(document.cookie || '').split(';');
          const prefix = `${encodeURIComponent(name)}=`;

          for (const rawCookie of cookies) {
            const cookie = rawCookie.trim();
            if (!cookie.startsWith(prefix)) {
              continue;
            }

            return decodeURIComponent(cookie.slice(prefix.length));
          }

          return '';
        };

        let consentValue = getCookieValue(cookieName);

        if (!consentValue) {
          try {
            consentValue = window.localStorage.getItem(storageKey) || '';
          } catch (error) {
            consentValue = '';
          }
        }

        if (consentValue) {
          document.documentElement.setAttribute(
            'data-cookie-banner-hidden',
            'true',
          );
        }
      })();
