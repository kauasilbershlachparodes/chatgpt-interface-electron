// src/js/sidebar.js
(() => {
  const SIDEBAR_STORAGE_KEY = 'stage-slideover-sidebar-state';
  const MOBILE_BREAKPOINT = '(max-width: 767px)';

  const initSidebarToggle = () => {
    const sidebar = document.getElementById('stage-slideover-sidebar');
    const tinyBar = document.getElementById('stage-sidebar-tiny-bar');
    const closeButton = document.querySelector('[data-testid="close-sidebar-button"][aria-controls="stage-slideover-sidebar"]');
    const openButton = tinyBar?.querySelector('button[aria-controls="stage-slideover-sidebar"][aria-label="Open sidebar"]');
    const mobileOpenButton = document.querySelector('[data-testid="open-sidebar-button"][aria-controls="stage-slideover-sidebar"]');
    const mobileQuery = window.matchMedia(MOBILE_BREAKPOINT);

    if (!sidebar || !tinyBar || !closeButton || !openButton) {
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-sidebar-mobile-backdrop', '');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.zIndex = '59';
    backdrop.style.background = 'rgba(0, 0, 0, 0.55)';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
    backdrop.style.transition = 'opacity 150ms ease';
    const backdropHost = sidebar.parentElement || document.body;
    if (backdropHost === document.body) {
      document.body.appendChild(backdrop);
    } else {
      backdropHost.insertBefore(backdrop, sidebar);
    }

    const column = sidebar.firstElementChild;
    const expandedPane = column
      ? Array.from(column.children).find((element) => element !== tinyBar && element instanceof HTMLElement)
      : null;

    if (!(expandedPane instanceof HTMLElement)) {
      return;
    }

    const scrollNav = expandedPane.querySelector('nav[aria-label="Chat history"]');
    const mobileOptionalSection = expandedPane.querySelector('[class*="[@media(max-height:700px)]:hidden"]');
    const navGrowSpacers = scrollNav
      ? Array.from(scrollNav.children).filter((element) =>
          element instanceof HTMLElement && (
            element.classList.contains('grow') ||
            element.classList.contains('flex-grow')
          )
        )
      : [];

    if (sidebar.dataset.sidebarToggleBound === 'true') {
      return;
    }
    sidebar.dataset.sidebarToggleBound = 'true';

    const syncStateContainer = tinyBar.querySelector('[data-state]');
    const fullStateContainer = closeButton.closest('[data-state]');

    let desktopExpanded = true;
    let mobileOpen = false;

    const isMobile = () => mobileQuery.matches;

    const setDesktopState = (expanded, options = {}) => {
      const { persist = true, focusTarget = null } = options;

      desktopExpanded = expanded;
      sidebar.dataset.sidebarState = expanded ? 'expanded' : 'collapsed';
      sidebar.dataset.sidebarMode = 'desktop';
      sidebar.style.display = '';
      sidebar.style.position = '';
      sidebar.style.inset = '';
      sidebar.style.height = '';
      sidebar.style.zIndex = '';
      sidebar.style.boxShadow = '';
      sidebar.style.width = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.minWidth = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.maxWidth = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.backgroundColor = expanded
        ? 'var(--sidebar-bg, var(--bg-elevated-secondary))'
        : 'var(--sidebar-bg, var(--bg-primary))';

      backdrop.hidden = true;
      backdrop.style.opacity = '0';
      backdrop.style.pointerEvents = 'none';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      tinyBar.style.display = '';
      tinyBar.style.opacity = expanded ? '0' : '1';
      tinyBar.style.pointerEvents = expanded ? 'none' : 'auto';
      if (expanded) {
        tinyBar.setAttribute('inert', '');
        tinyBar.setAttribute('aria-hidden', 'true');
      } else {
        tinyBar.removeAttribute('inert');
        tinyBar.removeAttribute('aria-hidden');
      }

      expandedPane.style.display = '';
      expandedPane.style.opacity = expanded ? '1' : '0';
      expandedPane.style.pointerEvents = expanded ? 'auto' : 'none';
      expandedPane.style.visibility = expanded ? 'visible' : 'hidden';
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.overflowY = '';
        scrollNav.style.webkitOverflowScrolling = '';
        scrollNav.style.overscrollBehavior = '';
      }
      if (mobileOptionalSection instanceof HTMLElement) {
        mobileOptionalSection.style.display = '';
      }
      navGrowSpacers.forEach((spacer) => {
        spacer.style.display = '';
        spacer.style.flexGrow = '';
        spacer.style.minHeight = '';
      });
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.justifyContent = '';
      }
      if (expanded) {
        expandedPane.removeAttribute('aria-hidden');
        expandedPane.removeAttribute('inert');
      } else {
        expandedPane.setAttribute('aria-hidden', 'true');
        expandedPane.setAttribute('inert', '');
      }

      closeButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      closeButton.setAttribute('aria-label', expanded ? 'Close sidebar' : 'Open sidebar');
      openButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (mobileOpenButton) {
        mobileOpenButton.setAttribute('aria-expanded', 'false');
      }

      if (syncStateContainer) {
        syncStateContainer.setAttribute('data-state', expanded ? 'closed' : 'open');
      }
      if (fullStateContainer) {
        fullStateContainer.setAttribute('data-state', expanded ? 'open' : 'closed');
      }
      closeButton.setAttribute('data-state', expanded ? 'open' : 'closed');

      if (persist) {
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, expanded ? 'expanded' : 'collapsed');
        } catch (error) {
          // ignore storage failures
        }
      }

      if (focusTarget instanceof HTMLElement) {
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
    };

    const setMobileState = (open, options = {}) => {
      const { focusTarget = null } = options;

      mobileOpen = open;
      sidebar.dataset.sidebarState = open ? 'expanded' : 'collapsed';
      sidebar.dataset.sidebarMode = 'mobile';
      sidebar.style.position = open ? 'fixed' : '';
      sidebar.style.inset = open ? '0 auto 0 0' : '';
      sidebar.style.height = open ? '100dvh' : '';
      sidebar.style.zIndex = open ? '61' : '';
      sidebar.style.boxShadow = open ? 'var(--sharp-edge-side-shadow, 0 0 0 1px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.35))' : '';
      sidebar.style.width = 'var(--sidebar-width)';
      sidebar.style.minWidth = 'var(--sidebar-width)';
      sidebar.style.maxWidth = 'min(100vw, var(--sidebar-width))';
      sidebar.style.backgroundColor = 'var(--sidebar-bg, var(--bg-elevated-secondary))';
      sidebar.style.display = open ? 'block' : 'none';

      backdrop.hidden = !open;
      backdrop.style.opacity = open ? '1' : '0';
      backdrop.style.pointerEvents = open ? 'auto' : 'none';
      document.documentElement.style.overflow = open ? 'hidden' : '';
      document.body.style.overflow = open ? 'hidden' : '';

      tinyBar.style.display = 'none';
      tinyBar.style.opacity = '0';
      tinyBar.style.pointerEvents = 'none';
      tinyBar.setAttribute('inert', '');
      tinyBar.setAttribute('aria-hidden', 'true');

      expandedPane.style.display = 'block';
      expandedPane.style.opacity = open ? '1' : '0';
      expandedPane.style.pointerEvents = open ? 'auto' : 'none';
      expandedPane.style.visibility = open ? 'visible' : 'hidden';
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.overflowY = 'auto';
        scrollNav.style.webkitOverflowScrolling = 'touch';
        scrollNav.style.overscrollBehavior = 'contain';
      }
      if (mobileOptionalSection instanceof HTMLElement) {
        mobileOptionalSection.style.display = 'block';
      }
      navGrowSpacers.forEach((spacer) => {
        spacer.style.display = 'none';
        spacer.style.flexGrow = '0';
        spacer.style.minHeight = '0';
      });
      if (scrollNav instanceof HTMLElement) {
        scrollNav.style.justifyContent = 'flex-start';
      }
      if (open) {
        expandedPane.removeAttribute('aria-hidden');
        expandedPane.removeAttribute('inert');
      } else {
        expandedPane.setAttribute('aria-hidden', 'true');
        expandedPane.setAttribute('inert', '');
      }

      closeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      closeButton.setAttribute('aria-label', 'Close sidebar');
      openButton.setAttribute('aria-expanded', 'false');
      if (mobileOpenButton) {
        mobileOpenButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      if (syncStateContainer) {
        syncStateContainer.setAttribute('data-state', 'closed');
      }
      if (fullStateContainer) {
        fullStateContainer.setAttribute('data-state', open ? 'open' : 'closed');
      }
      closeButton.setAttribute('data-state', open ? 'open' : 'closed');

      if (focusTarget instanceof HTMLElement) {
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
    };

    const syncResponsiveState = () => {
      if (isMobile()) {
        setMobileState(mobileOpen, { focusTarget: null });
      } else {
        setDesktopState(desktopExpanded, { persist: false, focusTarget: null });
      }
    };

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (isMobile()) {
        setMobileState(false, { focusTarget: mobileOpenButton });
      } else {
        setDesktopState(false, { focusTarget: openButton });
      }
    });

    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      setDesktopState(true, { focusTarget: closeButton });
    });

    if (mobileOpenButton) {
      mobileOpenButton.addEventListener('click', (event) => {
        event.preventDefault();
        setMobileState(!mobileOpen, { focusTarget: mobileOpen ? mobileOpenButton : closeButton });
      });
    }

    backdrop.addEventListener('click', () => {
      if (isMobile() && mobileOpen) {
        setMobileState(false, { focusTarget: mobileOpenButton });
      }
    });

    tinyBar.addEventListener('dblclick', () => {
      if (!isMobile() && sidebar.dataset.sidebarState === 'collapsed') {
        setDesktopState(true, { focusTarget: closeButton });
      }
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\' && !isMobile()) {
        event.preventDefault();
        setDesktopState(sidebar.dataset.sidebarState === 'collapsed', {
          focusTarget: sidebar.dataset.sidebarState === 'collapsed' ? closeButton : openButton
        });
      }

      if (event.key === 'Escape' && isMobile() && mobileOpen) {
        event.preventDefault();
        setMobileState(false, { focusTarget: mobileOpenButton });
      }
    });

    const isInitiallyCollapsedInMarkup = (
      sidebar.style.width === 'var(--sidebar-rail-width)' ||
      sidebar.dataset.sidebarState === 'collapsed' ||
      closeButton.getAttribute('aria-expanded') === 'false'
    );

    desktopExpanded = !isInitiallyCollapsedInMarkup;
    mobileOpen = false;
    syncResponsiveState();

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncResponsiveState);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(syncResponsiveState);
    }

    window.addEventListener('resize', syncResponsiveState, { passive: true });
  };


  const initSidebarHelpMenu = () => {
    const helpLabel = Array.from(document.querySelectorAll('[data-sidebar-item="true"] .truncate')).find((node) =>
      node.textContent.trim() === 'Help'
    );
    const helpTrigger = helpLabel?.closest('[data-sidebar-item="true"]');
    const sidebar = document.getElementById('stage-slideover-sidebar');

    if (!helpTrigger || !sidebar || helpTrigger.dataset.helpMenuBound === 'true') {
      return;
    }
    helpTrigger.dataset.helpMenuBound = 'true';

    const triggerId = helpTrigger.id || `radix-help-trigger-${Math.random().toString(36).slice(2)}`;
    const menuId = `radix-help-menu-${Math.random().toString(36).slice(2)}`;
    helpTrigger.id = triggerId;
    helpTrigger.setAttribute('role', 'button');
    helpTrigger.setAttribute('tabindex', '0');
    helpTrigger.setAttribute('aria-haspopup', 'menu');
    helpTrigger.setAttribute('aria-expanded', 'false');
    helpTrigger.setAttribute('data-state', 'closed');

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.setAttribute('dir', 'ltr');
    wrapper.hidden = true;
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate(0px, 0px)';
    wrapper.style.minWidth = 'max-content';
    wrapper.style.zIndex = '50';
    wrapper.style.pointerEvents = 'none';

    wrapper.innerHTML = `
      <div
        data-side="top"
        data-align="start"
        role="menu"
        aria-orientation="vertical"
        data-state="closed"
        data-radix-menu-content=""
        dir="ltr"
        id="${menuId}"
        aria-labelledby="${triggerId}"
        class="z-50 max-w-xs rounded-2xl popover bg-token-main-surface-primary dark:bg-[#353535] shadow-long py-1.5 data-[unbound-width]:min-w-[unset] data-[custom-padding]:py-0 MA-gxq_content [--trigger-width:calc(var(--radix-dropdown-menu-trigger-width)-2*var(--radix-align-offset))] min-w-(--trigger-width) max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto select-none min-w-[calc(var(--sidebar-width)-12px)]"
        tabindex="-1"
        data-orientation="vertical"
        style="outline: none; --radix-dropdown-menu-content-transform-origin: var(--radix-popper-transform-origin); --radix-dropdown-menu-content-available-width: var(--radix-popper-available-width); --radix-dropdown-menu-content-available-height: var(--radix-popper-available-height); --radix-dropdown-menu-trigger-width: var(--radix-popper-anchor-width); --radix-dropdown-menu-trigger-height: var(--radix-popper-anchor-height); pointer-events: auto;"
      >
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://help.openai.com/en/collections/3742473-chatgpt" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#975ff3" fill="currentColor"></use></svg></div>Help center</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://help.openai.com/en/articles/6825453-chatgpt-release-notes" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#4a920d" fill="currentColor"></use></svg></div>Release notes</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/policies" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#c6a95f" fill="currentColor"></use></svg></div>Terms &amp; policies</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
        <a tabindex="-1" class="group __menu-item hoverable" rel="noopener noreferrer" role="menuitem" data-orientation="vertical" data-radix-collection-item="" href="https://openai.com/chatgpt/download" target="_blank">
          <div class="flex min-w-0 items-center gap-1.5"><div class="flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#b834c9" fill="currentColor"></use></svg></div>Download apps</div>
          <div class="trailing highlight text-token-text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" data-rtl-flip="" class="icon-sm"><use href="#e51fba" fill="currentColor"></use></svg></div>
        </a>
      </div>
    `;

    document.body.appendChild(wrapper);
    const menu = wrapper.firstElementChild;
    menu.style.pointerEvents = 'auto';
    menu.style.touchAction = 'pan-y';
    menu.style.webkitOverflowScrolling = 'touch';
    menu.style.overscrollBehavior = 'contain';
    const menuItems = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
    let isOpen = false;

    const updatePosition = () => {
      wrapper.hidden = false;
      const sidebarRect = sidebar.getBoundingClientRect();
      const triggerRect = helpTrigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 6;
      const gap = 8;
      const mobile = window.matchMedia(MOBILE_BREAKPOINT).matches;
      const preferredX = sidebarRect.left + margin;
      const maxViewportX = window.innerWidth - menuRect.width - margin;
      const x = Math.round(Math.max(margin, Math.min(preferredX, maxViewportX)));
      const preferredY = triggerRect.top - menuRect.height - gap;
      const maxViewportY = window.innerHeight - menuRect.height - margin;
      const y = Math.round(Math.max(margin, Math.min(preferredY, maxViewportY)));
      const availableWidth = Math.max(0, (mobile ? sidebarRect.right : window.innerWidth) - x);
      const availableHeight = Math.max(0, triggerRect.top - margin);
      const transformOriginY = Math.max(0, Math.round(triggerRect.top - y));

      wrapper.style.zIndex = mobile ? '75' : '50';
      wrapper.style.willChange = mobile ? 'transform' : '';
      wrapper.style.pointerEvents = isOpen ? 'auto' : 'none';
      wrapper.style.transform = `translate(${x}px, ${y}px)`;
      menu.style.maxHeight = `${availableHeight}px`;
      menu.style.webkitOverflowScrolling = 'touch';
      menu.style.overscrollBehavior = mobile ? 'contain' : 'auto';
      menu.style.touchAction = mobile ? 'pan-y' : 'auto';
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
      wrapper.style.pointerEvents = 'none';
      menu.setAttribute('data-state', 'closed');
      helpTrigger.setAttribute('aria-expanded', 'false');
      helpTrigger.setAttribute('data-state', 'closed');
      if (focusTrigger) {
        window.requestAnimationFrame(() => helpTrigger.focus({ preventScroll: true }));
      }
    };

    const openMenu = () => {
      if (isOpen) {
        return;
      }
      isOpen = true;
      wrapper.hidden = false;
      wrapper.style.pointerEvents = 'auto';
      menu.setAttribute('data-state', 'open');
      helpTrigger.setAttribute('aria-expanded', 'true');
      helpTrigger.setAttribute('data-state', 'open');
      updatePosition();
      menuItems().forEach((item) => {
        item.style.touchAction = 'manipulation';
      });
    };

    const toggleMenu = () => {
      if (isOpen) {
        closeMenu({ focusTrigger: false });
      } else {
        openMenu();
      }
    };

    helpTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });

    helpTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!isOpen) {
          openMenu();
          window.requestAnimationFrame(() => {
            menuItems()[0]?.focus({ preventScroll: true });
          });
        } else {
          menuItems()[0]?.focus({ preventScroll: true });
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    menu.addEventListener('keydown', (event) => {
      const items = menuItems();
      const currentIndex = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0]?.focus({ preventScroll: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1]?.focus({ preventScroll: true });
      } else if (event.key === 'Tab') {
        closeMenu({ focusTrigger: false });
      }
    });

    menu.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    menu.addEventListener('pointerup', (event) => {
      event.stopPropagation();
    });

    menu.addEventListener('touchstart', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('touchmove', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('touchend', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('scroll', (event) => {
      event.stopPropagation();
    }, { passive: true });

    menu.addEventListener('click', (event) => {
      const item = event.target.closest('[role="menuitem"]');
      if (!item) {
        return;
      }

      const mobile = window.matchMedia(MOBILE_BREAKPOINT).matches;
      if (mobile) {
        const href = item.getAttribute('href');
        const target = item.getAttribute('target') || '_self';
        event.preventDefault();
        event.stopPropagation();
        closeMenu({ focusTrigger: false });
        if (href) {
          if (target === '_blank') {
            window.open(href, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = href;
          }
        }
        return;
      }

      closeMenu({ focusTrigger: false });
    });

    document.addEventListener('pointerdown', (event) => {
      if (!isOpen) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!wrapper.contains(target) && !helpTrigger.contains(target)) {
        closeMenu({ focusTrigger: false });
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
  };

  const initAll = () => {
    initSidebarToggle();
    initSidebarHelpMenu();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll, { once: true });
  } else {
    initAll();
  }
})();
