// src/js/sidebar.js
(() => {
  const SIDEBAR_STORAGE_KEY = 'stage-slideover-sidebar-state';

  const initSidebarToggle = () => {
    const sidebar = document.getElementById('stage-slideover-sidebar');
    const tinyBar = document.getElementById('stage-sidebar-tiny-bar');
    const closeButton = document.querySelector('[data-testid="close-sidebar-button"][aria-controls="stage-slideover-sidebar"]');
    const openButton = tinyBar?.querySelector('button[aria-controls="stage-slideover-sidebar"][aria-label="Open sidebar"]');

    if (!sidebar || !tinyBar || !closeButton || !openButton) {
      return;
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

    const setExpanded = (expanded, options = {}) => {
      const { persist = true, focusTarget = null } = options;

      sidebar.dataset.sidebarState = expanded ? 'expanded' : 'collapsed';
      sidebar.style.width = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.minWidth = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';
      sidebar.style.maxWidth = expanded ? 'var(--sidebar-width)' : 'var(--sidebar-rail-width)';

      tinyBar.style.opacity = expanded ? '0' : '1';
      tinyBar.style.pointerEvents = expanded ? 'none' : 'auto';
      if (expanded) {
        tinyBar.setAttribute('inert', '');
        tinyBar.setAttribute('aria-hidden', 'true');
      } else {
        tinyBar.removeAttribute('inert');
        tinyBar.removeAttribute('aria-hidden');
      }

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

    const collapse = () => setExpanded(false, { focusTarget: openButton });
    const expand = () => setExpanded(true, { focusTarget: closeButton });
    const toggle = () => {
      const isExpanded = sidebar.dataset.sidebarState !== 'collapsed';
      setExpanded(!isExpanded, { focusTarget: isExpanded ? openButton : closeButton });
    };

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      collapse();
    });

    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      expand();
    });

    tinyBar.addEventListener('dblclick', () => {
      if (sidebar.dataset.sidebarState === 'collapsed') {
        expand();
      }
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        toggle();
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

    setExpanded(initialExpanded, { persist: false });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle, { once: true });
  } else {
    initSidebarToggle();
  }
})();
