// src/js/composer-plus-menu.js
(() => {
  const GAP = 8;
  const X_OFFSET = -7;
  const Y_OFFSET = 0;
  const VIEWPORT_MARGIN = 8;
  const WEB_SEARCH_STORAGE_KEY = 'stage-composer-web-search-enabled';

  const ICONS = {
    addPhotos: '712359',
    webSearch: '6b0d8c',
    createImage: '266724',
    deepResearch: '5d3112',
    gpt5: 'b7a3ee',
  };

  const navigateToAuth = (mode) => {
    const normalizedMode = mode === 'signup' ? 'signup' : 'login';
    const matrix = window.MatrixSession;
    if (matrix) {
      matrix.clearPendingAuth?.();
      matrix.setPendingAuth?.({ mode: normalizedMode, email: '' });
    }
    window.location.href = `log-in-or-create-account.html?mode=${normalizedMode}`;
  };

  const openAuthFlow = (mode = 'login') => {
    if (typeof window.openNoAuthLoginModal === 'function') {
      window.openNoAuthLoginModal(mode, { collapseSidebar: true });
      return;
    }
    navigateToAuth(mode);
  };

  const readWebSearchEnabled = () => {
    try {
      return window.localStorage.getItem(WEB_SEARCH_STORAGE_KEY) === 'true';
    } catch (_error) {
      return false;
    }
  };

  const writeWebSearchEnabled = (value) => {
    try {
      window.localStorage.setItem(WEB_SEARCH_STORAGE_KEY, value ? 'true' : 'false');
    } catch (_error) {
      // noop
    }
  };

  const buildMenuMarkup = (triggerId, menuId) => {
    const webSearchEnabled = readWebSearchEnabled();
    const webSearchState = webSearchEnabled ? 'checked' : 'unchecked';
    const webSearchChecked = webSearchEnabled ? 'true' : 'false';

    return `
      <div
        data-side="bottom"
        data-align="start"
        role="menu"
        aria-orientation="vertical"
        data-state="closed"
        data-radix-menu-content=""
        dir="ltr"
        id="${menuId}"
        aria-labelledby="${triggerId}"
        class="z-50 max-w-xs rounded-2xl popover bg-token-main-surface-primary dark:bg-[#353535] shadow-long py-1.5 data-[unbound-width]:min-w-[unset] data-[custom-padding]:py-0 MA-gxq_content [--trigger-width:calc(var(--radix-dropdown-menu-trigger-width)-2*var(--radix-align-offset))] min-w-(--trigger-width) max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto select-none content-sheet-section:flex content-sheet-section:flex-col content-sheet-section:gap-3"
        tabindex="-1"
        data-orientation="vertical"
        style="outline: none; --radix-align-offset: -7px; --min-items: 5.8; --radix-dropdown-menu-content-transform-origin: var(--radix-popper-transform-origin); --radix-dropdown-menu-content-available-width: var(--radix-popper-available-width); --radix-dropdown-menu-content-available-height: var(--radix-popper-available-height); --radix-dropdown-menu-trigger-width: var(--radix-popper-anchor-width); --radix-dropdown-menu-trigger-height: var(--radix-popper-anchor-height); pointer-events: auto;"
      >
        <div role="group" class="empty:hidden [:not(:has(div:not([role=group])))]:hidden before:bg-token-border-default content-sheet:before:my-3 content-sheet:before:mx-6 before:mx-4 before:my-1 before:block before:h-px first:before:hidden [&:nth-child(1_of_:has(div:not([role=group])))]:before:hidden content-sheet:content-sheet-inset-section">
          <div role="menuitem" tabindex="0" class="group __menu-item" data-orientation="vertical" data-radix-collection-item="" data-plus-action="add-photos">
            <div class="flex min-w-0 items-center gap-1.5">
              <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#${ICONS.addPhotos}" fill="currentColor"></use></svg>
              </div>
              <div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">Add photos</div></div>
            </div>
            <div class="trailing highlight text-token-text-tertiary">
              <div class="box-trim-text-0.25 inline-flex whitespace-pre *:inline-flex *:font-sans *:not-last:after:px-0.5 *:not-last:after:content-['+'] touch:hidden"><kbd aria-label="Control"><span class="min-w-[1em]">Ctrl</span></kbd><kbd><span class="min-w-[1em]">U</span></kbd></div>
            </div>
          </div>
        </div>
        <div role="group" class="empty:hidden [:not(:has(div:not([role=group])))]:hidden before:bg-token-border-default content-sheet:before:my-3 content-sheet:before:mx-6 before:mx-4 before:my-1 before:block before:h-px first:before:hidden [&:nth-child(1_of_:has(div:not([role=group])))]:before:hidden">
          <div role="group">
            <div role="menuitemradio" aria-checked="${webSearchChecked}" tabindex="0" class="group __menu-item" data-state="${webSearchState}" data-orientation="vertical" data-radix-collection-item="" data-plus-action="toggle-web-search">
              <div class="flex min-w-0 items-center gap-1.5">
                <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="icon" aria-hidden="true"><use href="#${ICONS.webSearch}" fill="currentColor"></use></svg>
                </div>
                <div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">Web search</div></div>
              </div>
              <div class="trailing" data-trailing-style="radio-check"><div class="icon-sm group-radix-state-checked:hidden"></div></div>
            </div>
          </div>
        </div>
        <div role="group" class="empty:hidden [:not(:has(div:not([role=group])))]:hidden before:bg-token-border-default content-sheet:before:my-3 content-sheet:before:mx-6 before:mx-4 before:my-1 before:block before:h-px first:before:hidden [&:nth-child(1_of_:has(div:not([role=group])))]:before:hidden">
          <div class="__menu-label">Log in to use...</div>
          <div role="menuitem" data-disabled="true" tabindex="0" class="group __menu-item" data-orientation="vertical" data-radix-collection-item="">
            <div class="flex min-w-0 items-center gap-1.5">
              <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#${ICONS.createImage}" fill="currentColor"></use></svg>
              </div>
              <div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">Create image</div></div>
            </div>
            <div class="trailing highlight text-token-text-tertiary"><a data-trailing-button="" class="__menu-item-trailing-lnk" href="/" data-plus-login="login">Log in</a></div>
          </div>
          <div role="menuitem" data-disabled="true" tabindex="0" class="group __menu-item" data-orientation="vertical" data-radix-collection-item="">
            <div class="flex min-w-0 items-center gap-1.5">
              <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#${ICONS.deepResearch}" fill="currentColor"></use></svg>
              </div>
              <div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">Deep research</div></div>
            </div>
            <div class="trailing highlight text-token-text-tertiary"><a data-trailing-button="" class="__menu-item-trailing-lnk" href="/" data-plus-login="login">Log in</a></div>
          </div>
          <div role="menuitem" data-disabled="true" tabindex="0" class="group __menu-item" data-orientation="vertical" data-radix-collection-item="">
            <div class="flex min-w-0 items-center gap-1.5">
              <div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#${ICONS.gpt5}" fill="currentColor"></use></svg>
              </div>
              <div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">GPT-5</div></div>
            </div>
            <div class="trailing highlight text-token-text-tertiary"><a data-trailing-button="" class="__menu-item-trailing-lnk" href="/" data-plus-login="login">Log in</a></div>
          </div>
        </div>
      </div>
    `;
  };

  const initComposerPlusMenu = () => {
    const trigger = document.querySelector('#composer-plus-btn[data-testid="composer-plus-btn"]');
    if (!(trigger instanceof HTMLElement) || trigger.dataset.composerPlusMenuBound === 'true') {
      return;
    }

    trigger.dataset.composerPlusMenuBound = 'true';

    const triggerId = trigger.id || `radix-composer-plus-trigger-${Math.random().toString(36).slice(2)}`;
    const menuId = `radix-composer-plus-menu-${Math.random().toString(36).slice(2)}`;
    const triggerStateHost = trigger.closest('span[data-state]');

    trigger.id = triggerId;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('data-state', 'closed');

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.setAttribute('data-composer-plus-menu', '');
    wrapper.setAttribute('dir', 'ltr');
    wrapper.hidden = true;
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate(0px, 0px)';
    wrapper.style.minWidth = 'max-content';
    wrapper.style.width = '0px';
    wrapper.style.height = '0px';
    wrapper.style.overflow = 'visible';
    wrapper.style.zIndex = '50';
    wrapper.style.pointerEvents = 'none';
    wrapper.innerHTML = buildMenuMarkup(triggerId, menuId);
    document.body.appendChild(wrapper);

    let menu = wrapper.firstElementChild;
    if (!(menu instanceof HTMLElement)) {
      return;
    }

    menu.style.pointerEvents = 'auto';
    menu.style.display = 'inline-block';
    menu.style.width = 'max-content';
    menu.style.height = 'auto';

    let isOpen = false;

    const getInput = (id) => document.getElementById(id);

    const syncWebSearchState = () => {
      const webSearchItem = wrapper.querySelector('[data-plus-action="toggle-web-search"]');
      if (!(webSearchItem instanceof HTMLElement)) {
        return;
      }
      const enabled = readWebSearchEnabled();
      webSearchItem.setAttribute('data-state', enabled ? 'checked' : 'unchecked');
      webSearchItem.setAttribute('aria-checked', enabled ? 'true' : 'false');
    };

    const syncTriggerState = () => {
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      trigger.setAttribute('data-state', isOpen ? 'open' : 'closed');
      if (triggerStateHost instanceof HTMLElement) {
        triggerStateHost.setAttribute('data-state', isOpen ? 'open' : 'closed');
      }
    };

    const updatePosition = () => {
      wrapper.hidden = false;

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const x = Math.round(Math.min(
        Math.max(VIEWPORT_MARGIN, triggerRect.left + X_OFFSET),
        window.innerWidth - menuRect.width - VIEWPORT_MARGIN
      ));
      const y = Math.round(Math.min(
        Math.max(VIEWPORT_MARGIN, triggerRect.bottom + GAP + Y_OFFSET),
        window.innerHeight - menuRect.height - VIEWPORT_MARGIN
      ));
      const availableWidth = Math.max(0, window.innerWidth - x - VIEWPORT_MARGIN);
      const availableHeight = Math.max(0, window.innerHeight - y - VIEWPORT_MARGIN);
      const transformOriginY = Math.max(0, Math.round(triggerRect.bottom - y));

      wrapper.style.transform = `translate(${x}px, ${y}px)`;
      wrapper.style.setProperty('--radix-popper-transform-origin', `0% ${transformOriginY}px`);
      wrapper.style.setProperty('--radix-popper-available-width', `${availableWidth}px`);
      wrapper.style.setProperty('--radix-popper-available-height', `${availableHeight}px`);
      wrapper.style.setProperty('--radix-popper-anchor-width', `${Math.round(triggerRect.width)}px`);
      wrapper.style.setProperty('--radix-popper-anchor-height', `${Math.round(triggerRect.height)}px`);
    };

    const closeMenu = ({ focusTrigger = false } = {}) => {
      if (!isOpen) {
        return;
      }

      isOpen = false;
      wrapper.hidden = true;
      menu.setAttribute('data-state', 'closed');
      wrapper.style.pointerEvents = 'none';
      syncTriggerState();

      if (focusTrigger) {
        window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
      }
    };

    const openMenu = () => {
      if (isOpen) {
        return;
      }

      document.dispatchEvent(new CustomEvent('stage:close-click-popovers', {
        detail: { source: 'composer-plus-menu', owner: 'composer-plus-btn' }
      }));

      isOpen = true;
      wrapper.hidden = false;
      wrapper.style.pointerEvents = 'auto';
      menu.setAttribute('data-state', 'open');
      syncWebSearchState();
      syncTriggerState();
      updatePosition();
      window.requestAnimationFrame(() => menu.focus({ preventScroll: true }));
    };

    const toggleMenu = () => {
      if (isOpen) {
        closeMenu({ focusTrigger: false });
      } else {
        openMenu();
      }
    };

    const triggerInputClick = (id) => {
      const input = getInput(id);
      if (input instanceof HTMLInputElement) {
        input.click();
      }
    };

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    menu.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const loginLink = target.closest('[data-plus-login]');
      if (loginLink instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        closeMenu({ focusTrigger: false });
        openAuthFlow(loginLink.getAttribute('data-plus-login') || 'login');
        return;
      }

      const actionItem = target.closest('[data-plus-action]');
      if (!(actionItem instanceof HTMLElement)) {
        return;
      }

      const action = actionItem.getAttribute('data-plus-action');
      if (action === 'add-photos') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu({ focusTrigger: false });
        triggerInputClick('upload-photos');
        return;
      }

      if (action === 'toggle-web-search') {
        event.preventDefault();
        event.stopPropagation();
        const nextValue = !readWebSearchEnabled();
        writeWebSearchEnabled(nextValue);
        syncWebSearchState();
      }
    });

    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    menu.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    document.addEventListener('pointerdown', (event) => {
      if (!isOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!wrapper.contains(target) && !trigger.contains(target)) {
        closeMenu({ focusTrigger: false });
      }
    });

    document.addEventListener('stage:close-click-popovers', (event) => {
      if (event?.detail?.source === 'composer-plus-menu') {
        return;
      }
      closeMenu({ focusTrigger: false });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu({ focusTrigger: false });
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && String(event.key).toLowerCase() === 'u') {
        const active = document.activeElement;
        const isTypingContext = active instanceof HTMLElement && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable
        );
        if (!isTypingContext) {
          event.preventDefault();
          closeMenu({ focusTrigger: false });
          triggerInputClick('upload-photos');
        }
      }
    });

    window.addEventListener('resize', () => {
      if (isOpen) {
        updatePosition();
      }
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (isOpen) {
        updatePosition();
      }
    }, { passive: true, capture: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        closeMenu({ focusTrigger: false });
      }
    });

    window.addEventListener('blur', () => {
      closeMenu({ focusTrigger: false });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComposerPlusMenu, { once: true });
  } else {
    initComposerPlusMenu();
  }
})();
