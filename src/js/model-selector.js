// src/js/model-selector.js
(() => {
  const GAP = 0;
  const X_OFFSET = -4;
  const Y_OFFSET = 0;
  const VIEWPORT_MARGIN = 8;

  const navigateToAuth = (mode) => {
    const matrix = window.MatrixSession;
    if (matrix) {
      matrix.clearPendingAuth?.();
      matrix.setPendingAuth?.({ mode, email: '' });
    }
    window.location.href = `log-in-or-create-account.html?mode=${mode}`;
  };

  const initModelSelectorUpsell = () => {
    const trigger = document.querySelector('[data-testid="model-switcher-dropdown-button"][aria-label="Model selector"]');
    if (!(trigger instanceof HTMLElement) || trigger.dataset.modelSelectorBound === 'true') {
      return;
    }

    const matrix = window.MatrixSession;
    const session = matrix?.getSession?.();
    if (session?.role === 'authenticated') {
      return;
    }

    trigger.dataset.modelSelectorBound = 'true';

    const triggerId = trigger.id || `radix-model-trigger-${Math.random().toString(36).slice(2)}`;
    const menuId = `radix-model-menu-${Math.random().toString(36).slice(2)}`;
    trigger.id = triggerId;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('data-state', 'closed');

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
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

    wrapper.innerHTML = `
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
        class="z-50 max-w-xs rounded-2xl popover bg-token-main-surface-primary dark:bg-[#353535] shadow-long py-1.5 data-[unbound-width]:min-w-[unset] data-[custom-padding]:py-0 MA-gxq_content [--trigger-width:calc(var(--radix-dropdown-menu-trigger-width)-2*var(--radix-align-offset))] min-w-[max(var(--trigger-width),min(125px,95vw))] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto select-none max-sm:max-h-[min(var(--radix-dropdown-menu-content-available-height),calc(100svh-5rem))]"
        tabindex="-1"
        data-orientation="vertical"
        style="outline: none; --radix-align-offset: -4px; --radix-dropdown-menu-content-transform-origin: var(--radix-popper-transform-origin); --radix-dropdown-menu-content-available-width: var(--radix-popper-available-width); --radix-dropdown-menu-content-available-height: var(--radix-popper-available-height); --radix-dropdown-menu-trigger-width: var(--radix-popper-anchor-width); --radix-dropdown-menu-trigger-height: var(--radix-popper-anchor-height); pointer-events: auto;"
      >
        <div class="-mt-4 flex max-w-[calc(100vw-2rem)] flex-col">
          <img class="max-xs:hidden h-[132px] object-fill" alt="" src="src/cdn/no-auth-upsell-m8ypcpwf.webp">
          <div class="flex flex-col px-4 pt-5 pb-2">
            <p class="text-token-text-primary mb-1 text-lg font-medium text-pretty">Try advanced features for free</p>
            <p class="text-token-text-secondary text-sm text-pretty">Get smarter responses, upload files, create images, and more by logging in.</p>
            <div class="mt-5 flex flex-row flex-wrap justify-start gap-2">
              <button class="btn relative group-focus-within/dialog:focus-visible:[outline-width:1.5px] group-focus-within/dialog:focus-visible:[outline-offset:2.5px] group-focus-within/dialog:focus-visible:[outline-style:solid] group-focus-within/dialog:focus-visible:[outline-color:var(--text-primary)] btn-primary" data-model-login>
                <div class="flex items-center justify-center">Log in</div>
              </button>
              <button class="btn relative group-focus-within/dialog:focus-visible:[outline-width:1.5px] group-focus-within/dialog:focus-visible:[outline-offset:2.5px] group-focus-within/dialog:focus-visible:[outline-style:solid] group-focus-within/dialog:focus-visible:[outline-color:var(--text-primary)] btn-secondary" data-model-signup>
                <div class="flex items-center justify-center">Sign up for free</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const menu = wrapper.firstElementChild;
    if (!(menu instanceof HTMLElement)) {
      return;
    }

    menu.style.pointerEvents = 'auto';
    menu.style.display = 'inline-block';
    menu.style.width = 'max-content';
    menu.style.height = 'auto';

    let isOpen = false;

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
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('data-state', 'closed');

      if (focusTrigger) {
        window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
      }
    };

    const openMenu = () => {
      if (isOpen) {
        return;
      }

      isOpen = true;
      wrapper.hidden = false;
      menu.setAttribute('data-state', 'open');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('data-state', 'open');
      updatePosition();
    };

    const toggleMenu = () => {
      if (isOpen) {
        closeMenu({ focusTrigger: false });
      } else {
        openMenu();
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
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    menu.querySelector('[data-model-login]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigateToAuth('login');
    });

    menu.querySelector('[data-model-signup]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigateToAuth('signup');
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

    document.addEventListener('stage:close-click-popovers', () => {
      closeMenu({ focusTrigger: false });
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
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModelSelectorUpsell, { once: true });
  } else {
    initModelSelectorUpsell();
  }
})();
