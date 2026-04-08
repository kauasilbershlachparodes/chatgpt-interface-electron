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

    let initialExpanded = true;
    try {
      const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (savedState === 'collapsed') {
        initialExpanded = false;
      }
    } catch (error) {
      // ignore storage failures
    }

    desktopExpanded = initialExpanded;
    mobileOpen = false;
    syncResponsiveState();

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncResponsiveState);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(syncResponsiveState);
    }

    window.addEventListener('resize', syncResponsiveState, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle, { once: true });
  } else {
    initSidebarToggle();
  }
})();
