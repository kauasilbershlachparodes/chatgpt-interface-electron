// src/js/tooltip.js
(() => {
  const OPEN_DELAY = 150;
  const GAP = 8;
  const VIEWPORT_PADDING = 8;
  const POINTER_FOCUS_SUPPRESSION_MS = 350;
  const INTERACTIVE_CLOSE_DELAY = 120;
  const SEARCH_CHATS_CARD_Y_OFFSET = 16;
  const HIDDEN_TOOLTIP_STYLE = 'position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;';

  const isProbablyVisibleElement = (element) => (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.hidden &&
    element.getClientRects().length > 0 &&
    window.getComputedStyle(element).display !== 'none' &&
    window.getComputedStyle(element).visibility !== 'hidden' &&
    !element.closest('[aria-hidden="true"], [inert]')
  );

  const findSidebarItemByLabel = (label) => {
    const normalizedLabel = String(label).trim().toLowerCase();
    const labels = Array.from(document.querySelectorAll('[data-sidebar-item="true"] .truncate'));
    const labelNode = labels.find((node) => (node.textContent || '').trim().toLowerCase() === normalizedLabel);
    return labelNode ? labelNode.closest('[data-sidebar-item="true"]') : null;
  };

  const findTinyBarItemBySrOnly = (label) => {
    const normalizedLabel = String(label).trim().toLowerCase();
    const labels = Array.from(document.querySelectorAll('#stage-sidebar-tiny-bar [data-sidebar-item="true"] .sr-only'));
    const labelNode = labels.find((node) => (node.textContent || '').trim().toLowerCase() === normalizedLabel);
    return labelNode ? labelNode.closest('[data-sidebar-item="true"]') : null;
  };

  const findVisibleSidebarItem = (label) => {
    const expandedItem = findSidebarItemByLabel(label);
    const collapsedItem = findTinyBarItemBySrOnly(label);

    if (isProbablyVisibleElement(expandedItem)) {
      return expandedItem;
    }

    if (isProbablyVisibleElement(collapsedItem)) {
      return collapsedItem;
    }

    return expandedItem || collapsedItem;
  };

  const navigateToAuth = (mode) => {
    const matrix = window.MatrixSession;
    if (matrix) {
      matrix.clearPendingAuth?.();
      matrix.setPendingAuth?.({ mode, email: '' });
    }
    window.location.href = `log-in-or-create-account.html?mode=${mode}`;
  };

  const TOOLTIPS = [
    {
      owner: 'composer-plus-btn',
      type: 'plus',
      side: 'bottom',
      getElement: () => document.querySelector('.composer-btn#composer-plus-btn')
    },
    {
      owner: 'start-dictation-btn',
      type: 'dictation',
      side: 'bottom',
      getElement: () => document.querySelector('button[aria-label="Start dictation"]')
    },
    {
      owner: 'start-voice-btn',
      type: 'voice',
      side: 'bottom',
      getElement: () => document.querySelector('button[aria-label="Start Voice"]')
    },
    {
      owner: 'close-sidebar-btn',
      type: 'close-sidebar',
      side: 'bottom',
      getElement: () => document.querySelector('[data-testid="close-sidebar-button"][aria-controls="stage-slideover-sidebar"]')
    },
    {
      owner: 'open-sidebar-btn',
      type: 'open-sidebar',
      side: 'right',
      getElement: () => document.querySelector('#stage-sidebar-tiny-bar button[aria-controls="stage-slideover-sidebar"]')
    },
    {
      owner: 'new-chat-btn',
      type: 'new-chat',
      side: 'right',
      getElement: () => document.querySelector('#stage-sidebar-tiny-bar [data-testid="create-new-chat-button"]')
    },
    {
      owner: 'images-btn',
      type: 'images',
      side: 'right',
      getElement: () => document.querySelector('#stage-sidebar-tiny-bar [data-testid="sidebar-item-library"]')
    },
    {
      owner: 'search-chats-sidebar',
      type: 'search-chats-card',
      side: 'right',
      align: 'start',
      interactive: true,
      getElement: () => findVisibleSidebarItem('Search chats')
    }
  ];

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));

  const createTooltipInner = (type, side, align, tooltipId) => {
    const baseClass = 'relative z-50 transition-opacity select-none px-2 py-1 rounded-lg overflow-hidden dark bg-black max-w-xs';
    const commonStyle = 'style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height);"';
    const hiddenTooltipOpen = `<span id="${tooltipId}" role="tooltip" style="${HIDDEN_TOOLTIP_STYLE}">`;

    if (type === 'search-chats-card') {
      return `
        <div data-side="right" data-align="start" data-state="closed" role="dialog" class="z-50" style="--radix-hover-card-content-transform-origin: var(--radix-popper-transform-origin); --radix-hover-card-content-available-width: var(--radix-popper-available-width); --radix-hover-card-content-available-height: var(--radix-popper-available-height); --radix-hover-card-trigger-width: var(--radix-popper-anchor-width); --radix-hover-card-trigger-height: var(--radix-popper-anchor-height);">
          <div style="opacity: 1; transform: none;">
            <div class="z-50 popover overflow-auto rounded-2xl dark:bg-[#353535] bg-clip-padding bg-token-main-surface-primary shadow-long w-[340px] p-0">
              <div class="bg-cover bg-center bg-no-repeat" style="height: 136px; background-image: url('https://openaiassets.blob.core.windows.net/$web/chatgpt/clients/noauth/home_popup_search.webp');"></div>
              <div class="bg-token-bg-elevated-primary px-4 py-6">
                <p class="text-token-text-primary text-lg leading-6">${escapeHtml('Search your chat history')}</p>
                <p class="text-token-text-tertiary mt-2 text-sm leading-5">${escapeHtml('Log in to save conversations, search past answers, and pick up where you left off.')}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="btn relative group-focus-within/dialog:focus-visible:[outline-width:1.5px] group-focus-within/dialog:focus-visible:[outline-offset:2.5px] group-focus-within/dialog:focus-visible:[outline-style:solid] group-focus-within/dialog:focus-visible:[outline-color:var(--text-primary)] btn-primary" data-testid="unsupported-nav-login" tabindex="-1">
                    <div class="flex items-center justify-center">${escapeHtml('Log in')}</div>
                  </button>
                  <button class="btn relative group-focus-within/dialog:focus-visible:[outline-width:1.5px] group-focus-within/dialog:focus-visible:[outline-offset:2.5px] group-focus-within/dialog:focus-visible:[outline-style:solid] group-focus-within/dialog:focus-visible:[outline-color:var(--text-primary)] btn-secondary" data-testid="unsupported-nav-signup" tabindex="-1">
                    <div class="flex items-center justify-center">${escapeHtml('Sign up for free')}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (type === 'plus') {
      return `
        <div data-side="bottom" data-align="center" data-state="closed" class="${baseClass} touch:hidden" ${commonStyle}>
          <div class="flex items-center gap-1">
            <div class="flex gap-2">
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Add files and more')}</div>
              <div class="text-token-text-tertiary text-xs font-medium whitespace-pre-wrap text-center"><kbd class="bg-token-bg-tertiary -me-1 inline-grid aspect-square w-4 items-center justify-center rounded-sm text-[11px]"><span>${escapeHtml('/')}</span></kbd></div>
            </div>
          </div>
          ${hiddenTooltipOpen}
            <div class="flex items-center gap-1">
              <div class="flex gap-2">
                <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Add files and more')}</div>
                <div class="text-token-text-tertiary text-xs font-medium whitespace-pre-wrap text-center"><kbd class="bg-token-bg-tertiary -me-1 inline-grid aspect-square w-4 items-center justify-center rounded-sm text-[11px]"><span>${escapeHtml('/')}</span></kbd></div>
              </div>
            </div>
          </span>
        </div>
      `;
    }

    if (type === 'new-chat') {
      const shortcut = `
        <div class="inline-flex items-center text-token-text-tertiary text-xs font-medium whitespace-pre text-center leading-none touch:hidden">
          <div class="inline-flex items-center whitespace-pre *:inline-flex *:items-center *:font-sans *:not-last:after:px-0.5 *:not-last:after:content-['+']">
            <kbd aria-label="Control"><span class="min-w-[1em]">${escapeHtml('Ctrl')}</span></kbd>
            <kbd aria-label="Shift"><span class="min-w-[1em]">${escapeHtml('Shift')}</span></kbd>
            <kbd><span class="min-w-[1em]">${escapeHtml('O')}</span></kbd>
          </div>
        </div>
      `;

      return `
        <div data-side="right" data-align="center" data-state="closed" class="${baseClass}" ${commonStyle}>
          <div class="flex items-center gap-1">
            <div class="flex items-center gap-2">
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('New chat')}</div>
              ${shortcut}
            </div>
          </div>
          ${hiddenTooltipOpen}
            <div class="flex items-center gap-1">
              <div class="flex items-center gap-2">
                <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('New chat')}</div>
                ${shortcut}
              </div>
            </div>
          </span>
        </div>
      `;
    }

    const labelByType = {
      images: 'Images',
      dictation: 'Dictate',
      voice: 'Use Voice',
      'close-sidebar': 'Close sidebar',
      'open-sidebar': 'Open sidebar'
    };

    const label = labelByType[type];
    const dataSide = side === 'right' ? 'right' : 'bottom';
    const dataAlign = align === 'start' ? 'start' : 'center';

    return `
      <div data-side="${escapeHtml(dataSide)}" data-align="${escapeHtml(dataAlign)}" data-state="closed" class="${baseClass}" ${commonStyle}>
        <div class="flex items-center gap-1">
          <div>
            <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml(label)}</div>
          </div>
        </div>
        ${hiddenTooltipOpen}
          <div class="flex items-center gap-1">
            <div>
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml(label)}</div>
            </div>
          </div>
        </span>
      </div>
    `;
  };

  const createTooltip = ({ owner, type, side, align = 'center', interactive = false }) => {
    const tooltipId = `radix-${Math.random().toString(36).slice(2)}`;
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.setAttribute('data-tooltip-owner', owner);
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
    wrapper.style.setProperty('--radix-popper-transform-origin', side === 'right' && align === 'start' ? '0px 0px' : side === 'right' ? '0px 50%' : '50% 0px');
    wrapper.style.setProperty('--radix-popper-available-width', `${window.innerWidth}px`);
    wrapper.style.setProperty('--radix-popper-available-height', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-width', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-height', '0px');
    wrapper.hidden = true;
    wrapper.innerHTML = createTooltipInner(type, side, align, tooltipId);
    document.body.appendChild(wrapper);

    const surface = wrapper.firstElementChild;
    const dialog = wrapper.querySelector('[role="dialog"]');
    const dialogFrame = wrapper.querySelector('[role="dialog"] > div');
    const interactiveSurface = wrapper.querySelector('.popover');

    if (surface instanceof HTMLElement) {
      surface.style.width = 'max-content';
      surface.style.height = 'auto';
    }

    if (dialog instanceof HTMLElement) {
      dialog.style.display = 'inline-block';
      dialog.style.width = 'max-content';
      dialog.style.height = 'auto';
    }

    if (dialogFrame instanceof HTMLElement) {
      dialogFrame.style.display = 'inline-block';
      dialogFrame.style.width = 'max-content';
      dialogFrame.style.height = 'auto';
    }

    return {
      wrapper,
      surface,
      srOnly: wrapper.querySelector('[role="tooltip"]'),
      dialog,
      dialogFrame,
      interactiveSurface,
      interactive
    };
  };

  const removeStaleWrappers = () => {
    document.querySelectorAll('[data-radix-popper-content-wrapper][data-tooltip-owner]').forEach((node) => {
      node.remove();
    });
  };

  const isHelpMenuOpen = () => document.documentElement.getAttribute('data-help-menu-open') === 'true';

  const isElementAvailable = (element) => (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.hidden &&
    element.getClientRects().length > 0
  );

  const applyForcedHoverState = (instance) => {
    if (!instance?.interactive || !(instance.button instanceof HTMLElement) || instance.hoverStateApplied) {
      return;
    }

    const computed = window.getComputedStyle(instance.button);
    const highlightedBackground = computed.getPropertyValue('--menu-item-highlighted').trim();
    instance.hoverStateSnapshot = {
      backgroundColor: instance.button.style.backgroundColor,
      dataRevealed: instance.button.getAttribute('data-revealed'),
      dataHighlighted: instance.button.getAttribute('data-highlighted')
    };

    instance.button.setAttribute('data-revealed', '');
    instance.button.setAttribute('data-highlighted', '');
    if (highlightedBackground) {
      instance.button.style.backgroundColor = highlightedBackground;
    }
    instance.hoverStateApplied = true;
  };

  const clearForcedHoverState = (instance) => {
    if (!instance?.hoverStateApplied || !(instance.button instanceof HTMLElement)) {
      return;
    }

    const snapshot = instance.hoverStateSnapshot || {};
    instance.button.style.backgroundColor = snapshot.backgroundColor || '';
    if (snapshot.dataRevealed === null) {
      instance.button.removeAttribute('data-revealed');
    } else {
      instance.button.setAttribute('data-revealed', snapshot.dataRevealed);
    }
    if (snapshot.dataHighlighted === null) {
      instance.button.removeAttribute('data-highlighted');
    } else {
      instance.button.setAttribute('data-highlighted', snapshot.dataHighlighted);
    }
    instance.hoverStateSnapshot = null;
    instance.hoverStateApplied = false;
  };

  const applyForcedRevealState = (instance) => {
    if (!instance?.interactive || !(instance.button instanceof HTMLElement) || instance.revealStateApplied) {
      return;
    }

    const computed = window.getComputedStyle(instance.button);
    const openBackground = computed.getPropertyValue('--menu-item-open').trim();
    instance.revealStateSnapshot = {
      backgroundColor: instance.button.style.backgroundColor,
      dataRevealed: instance.button.getAttribute('data-revealed'),
      dataForceHoverActive: instance.button.getAttribute('data-force-hover-active')
    };

    instance.button.setAttribute('data-revealed', '');
    instance.button.setAttribute('data-force-hover-active', 'reveal');
    if (openBackground) {
      instance.button.style.backgroundColor = openBackground;
    }
    instance.revealStateApplied = true;
  };

  const clearForcedRevealState = (instance) => {
    if (!instance?.revealStateApplied || !(instance.button instanceof HTMLElement)) {
      return;
    }

    const snapshot = instance.revealStateSnapshot || {};
    instance.button.style.backgroundColor = snapshot.backgroundColor || '';
    if (snapshot.dataRevealed === null) {
      instance.button.removeAttribute('data-revealed');
    } else {
      instance.button.setAttribute('data-revealed', snapshot.dataRevealed);
    }
    if (snapshot.dataForceHoverActive === null) {
      instance.button.removeAttribute('data-force-hover-active');
    } else {
      instance.button.setAttribute('data-force-hover-active', snapshot.dataForceHoverActive);
    }
    instance.revealStateSnapshot = null;
    instance.revealStateApplied = false;
  };

  const destroyPreviousManager = () => {
    if (window.__stageTooltipManager && typeof window.__stageTooltipManager.destroy === 'function') {
      window.__stageTooltipManager.destroy();
    }
  };

  const createManager = () => {
    let activeOwner = null;
    let suppressFocusUntil = 0;
    let keyboardMode = false;
    let bindRafId = null;
    const instances = new Map();
    const cleanup = [];

    const updateSuppressedInteractionState = () => {
      const helpMenuOpen = isHelpMenuOpen();
      instances.forEach((instance) => {
        if (!(instance.button instanceof HTMLElement)) {
          return;
        }

        const shouldSuppress = helpMenuOpen && (
          instance.side === 'right' ||
          instance.owner === 'close-sidebar-btn'
        );
        if (shouldSuppress) {
          instance.button.style.cursor = 'default';
          instance.button.style.pointerEvents = 'none';
        } else {
          instance.button.style.cursor = '';
          instance.button.style.pointerEvents = '';
        }
      });
    };

    const hideInstance = (instance) => {
      if (!instance) {
        return;
      }

      window.clearTimeout(instance.openTimer);
      instance.openTimer = null;
      window.clearTimeout(instance.closeTimer);
      instance.closeTimer = null;

      if (instance.rafId) {
        window.cancelAnimationFrame(instance.rafId);
        instance.rafId = null;
      }

      instance.surface.setAttribute('data-state', 'closed');
      instance.wrapper.hidden = true;
      instance.wrapper.style.pointerEvents = 'none';
      if (instance.surface instanceof HTMLElement) {
        instance.surface.style.pointerEvents = 'none';
      }
      if (instance.dialog instanceof HTMLElement) {
        instance.dialog.style.pointerEvents = 'none';
      }
      if (instance.dialogFrame instanceof HTMLElement) {
        instance.dialogFrame.style.pointerEvents = 'none';
      }
      if (instance.interactiveSurface instanceof HTMLElement) {
        instance.interactiveSurface.style.pointerEvents = 'none';
      }
      instance.button?.removeAttribute('aria-describedby');
      clearForcedHoverState(instance);
      clearForcedRevealState(instance);
      instance.isOpen = false;

      if (activeOwner === instance.owner) {
        activeOwner = null;
      }
    };

    const hideAll = ({ exceptOwner = null } = {}) => {
      instances.forEach((instance) => {
        if (instance.owner !== exceptOwner) {
          hideInstance(instance);
        }
      });
    };

    const unbindInstance = (instance) => {
      if (!instance) {
        return;
      }

      hideInstance(instance);
      instance.cleanupFns?.splice(0).forEach((fn) => fn());
      instance.wrapper.remove();
      instances.delete(instance.owner);
    };

    const updatePosition = (instance) => {
      if (!instance || !instance.isOpen || !isElementAvailable(instance.button)) {
        hideInstance(instance);
        return;
      }

      const rect = instance.button.getBoundingClientRect();
      const tooltipRect = instance.surface.getBoundingClientRect();

      let x;
      let y;

      if (instance.side === 'right') {
        x = Math.round(rect.right + GAP);
        y = instance.align === 'start'
          ? Math.round(rect.top - (instance.owner === 'search-chats-sidebar' ? SEARCH_CHATS_CARD_Y_OFFSET : 0))
          : Math.round(rect.top + (rect.height - tooltipRect.height) / 2);
        instance.wrapper.style.setProperty('--radix-popper-transform-origin', instance.align === 'start' ? '0px 0px' : '0px 50%');
      } else {
        x = Math.round(rect.left + rect.width / 2 - tooltipRect.width / 2);
        y = Math.round(rect.bottom + GAP);
        instance.wrapper.style.setProperty('--radix-popper-transform-origin', '50% 0px');
      }

      const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING);
      const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING);
      const safeX = Math.min(Math.max(VIEWPORT_PADDING, x), maxX);
      const safeY = Math.min(Math.max(VIEWPORT_PADDING, y), maxY);

      instance.wrapper.style.transform = `translate(${safeX}px, ${safeY}px)`;
      instance.wrapper.style.setProperty('--radix-popper-available-width', `${window.innerWidth - safeX}px`);
      instance.wrapper.style.setProperty('--radix-popper-available-height', `${window.innerHeight - safeY}px`);
      instance.wrapper.style.setProperty('--radix-popper-anchor-width', `${Math.round(rect.width)}px`);
      instance.wrapper.style.setProperty('--radix-popper-anchor-height', `${Math.round(rect.height)}px`);
    };

    const openNow = (instance) => {
      if (!instance || !isElementAvailable(instance.button)) {
        hideInstance(instance);
        return;
      }

      hideAll({ exceptOwner: instance.owner });

      instance.wrapper.hidden = false;
      instance.wrapper.style.pointerEvents = 'none';
      if (instance.surface instanceof HTMLElement) {
        instance.surface.style.pointerEvents = 'none';
      }
      if (instance.dialog instanceof HTMLElement) {
        instance.dialog.style.pointerEvents = 'none';
      }
      if (instance.dialogFrame instanceof HTMLElement) {
        instance.dialogFrame.style.pointerEvents = 'none';
      }
      if (instance.interactiveSurface instanceof HTMLElement) {
        instance.interactiveSurface.style.pointerEvents = instance.interactive ? 'auto' : 'none';
      }
      instance.surface.setAttribute('data-state', instance.interactive ? 'open' : 'delayed-open');
      if (instance.srOnly?.id) {
        instance.button.setAttribute('aria-describedby', instance.srOnly.id);
      }

      if (instance.rafId) {
        window.cancelAnimationFrame(instance.rafId);
      }

      instance.rafId = window.requestAnimationFrame(() => {
        instance.isOpen = true;
        activeOwner = instance.owner;
        updatePosition(instance);
      });
    };

    const scheduleOpen = (instance) => {
      if (!instance || !isElementAvailable(instance.button) || isHelpMenuOpen()) {
        return;
      }

      if (instance.owner === 'composer-plus-btn' && instance.button.getAttribute('aria-expanded') === 'true') {
        return;
      }

      window.clearTimeout(instance.openTimer);
      window.clearTimeout(instance.closeTimer);
      instance.closeTimer = null;
      instance.openTimer = window.setTimeout(() => openNow(instance), OPEN_DELAY);
    };

    const scheduleHide = (instance) => {
      if (!instance) {
        return;
      }

      window.clearTimeout(instance.closeTimer);
      instance.closeTimer = window.setTimeout(() => {
        hideInstance(instance);
      }, instance.interactive ? INTERACTIVE_CLOSE_DELAY : 0);
    };

    const shouldOpenFromFocus = () => keyboardMode && Date.now() >= suppressFocusUntil;

    const bindTooltip = (config) => {
      const button = config.getElement();
      const existingInstance = instances.get(config.owner);

      if (existingInstance && existingInstance.button === button && isElementAvailable(button)) {
        return;
      }

      if (existingInstance && existingInstance.button !== button) {
        unbindInstance(existingInstance);
      }

      if (!isElementAvailable(button) || button.dataset.tooltipBound === 'true') {
        return;
      }

      const parts = createTooltip(config);
      const instance = {
        owner: config.owner,
        side: config.side,
        align: config.align || 'center',
        button,
        openTimer: null,
        closeTimer: null,
        rafId: null,
        isOpen: false,
        hoverStateApplied: false,
        hoverStateSnapshot: null,
        revealStateApplied: false,
        revealStateSnapshot: null,
        cleanupFns: [],
        ...parts
      };

      instances.set(config.owner, instance);
      button.dataset.tooltipBound = 'true';
      updateSuppressedInteractionState();

      const onMouseEnter = () => {
        if (isHelpMenuOpen()) {
          return;
        }
        keyboardMode = false;
        document.dispatchEvent(new CustomEvent('stage:close-click-popovers', {
          detail: { source: 'tooltip', owner: instance.owner }
        }));
        clearForcedRevealState(instance);
        applyForcedHoverState(instance);
        scheduleOpen(instance);
      };

      const onMouseLeave = () => {
        clearForcedHoverState(instance);
        scheduleHide(instance);
      };

      const onFocus = () => {
        if (isHelpMenuOpen()) {
          return;
        }
        if (shouldOpenFromFocus()) {
          scheduleOpen(instance);
        }
      };

      const onBlur = () => {
        scheduleHide(instance);
      };

      const onPointerDown = () => {
        keyboardMode = false;
        suppressFocusUntil = Date.now() + POINTER_FOCUS_SUPPRESSION_MS;
        hideAll();
      };

      const onClick = () => {
        suppressFocusUntil = Date.now() + POINTER_FOCUS_SUPPRESSION_MS;
        hideAll();
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          hideAll();
        }
      };

      button.addEventListener('mouseenter', onMouseEnter);
      button.addEventListener('mouseleave', onMouseLeave);
      button.addEventListener('focus', onFocus);
      button.addEventListener('blur', onBlur);
      button.addEventListener('pointerdown', onPointerDown);
      button.addEventListener('click', onClick);
      button.addEventListener('keydown', onKeyDown);

      if (instance.interactive) {
        const onSurfaceMouseEnter = () => {
          window.clearTimeout(instance.closeTimer);
          instance.closeTimer = null;
          clearForcedHoverState(instance);
          applyForcedRevealState(instance);
        };

        const onSurfaceMouseLeave = () => {
          clearForcedRevealState(instance);
          scheduleHide(instance);
        };

        const onLoginClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideAll();
          if (typeof window.openNoAuthLoginModal === 'function') {
            window.openNoAuthLoginModal('login', { collapseSidebar: true });
            return;
          }
          navigateToAuth('login');
        };

        const onSignupClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideAll();
          if (typeof window.openNoAuthLoginModal === 'function') {
            window.openNoAuthLoginModal('signup', { collapseSidebar: true });
            return;
          }
          navigateToAuth('signup');
        };

        const interactiveTarget = instance.interactiveSurface || instance.dialog || instance.surface;

        interactiveTarget?.addEventListener('mouseenter', onSurfaceMouseEnter);
        interactiveTarget?.addEventListener('mouseleave', onSurfaceMouseLeave);
        instance.wrapper.querySelector('[data-testid="unsupported-nav-login"]')?.addEventListener('click', onLoginClick);
        instance.wrapper.querySelector('[data-testid="unsupported-nav-signup"]')?.addEventListener('click', onSignupClick);

        instance.cleanupFns.push(() => {
          interactiveTarget?.removeEventListener('mouseenter', onSurfaceMouseEnter);
          interactiveTarget?.removeEventListener('mouseleave', onSurfaceMouseLeave);
          instance.wrapper.querySelector('[data-testid="unsupported-nav-login"]')?.removeEventListener('click', onLoginClick);
          instance.wrapper.querySelector('[data-testid="unsupported-nav-signup"]')?.removeEventListener('click', onSignupClick);
        });
      }

      instance.cleanupFns.push(() => {
        button.removeEventListener('mouseenter', onMouseEnter);
        button.removeEventListener('mouseleave', onMouseLeave);
        button.removeEventListener('focus', onFocus);
        button.removeEventListener('blur', onBlur);
        button.removeEventListener('pointerdown', onPointerDown);
        button.removeEventListener('click', onClick);
        button.removeEventListener('keydown', onKeyDown);
        button.removeAttribute('data-tooltip-bound');
      });
    };

    const bindAvailableTooltips = () => {
      TOOLTIPS.forEach(bindTooltip);
      updateSuppressedInteractionState();
    };

    const scheduleBind = () => {
      if (bindRafId) {
        return;
      }

      bindRafId = window.requestAnimationFrame(() => {
        bindRafId = null;
        bindAvailableTooltips();
      });
    };

    const onDocumentKeyDown = (event) => {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        keyboardMode = true;
      }
      if (event.key === 'Escape') {
        hideAll();
      }
    };

    const onDocumentPointerDown = (event) => {
      keyboardMode = false;
      suppressFocusUntil = Date.now() + POINTER_FOCUS_SUPPRESSION_MS;

      const target = event.target;
      if (!(target instanceof Node)) {
        hideAll();
        return;
      }

      const clickedInsideTooltip = Array.from(instances.values()).some((instance) =>
        instance.wrapper.contains(target) || instance.button.contains(target)
      );

      if (!clickedInsideTooltip) {
        hideAll();
      }
    };

    const onWindowResize = () => {
      if (activeOwner) {
        updatePosition(instances.get(activeOwner));
      }
    };

    const onWindowScroll = () => {
      if (activeOwner) {
        updatePosition(instances.get(activeOwner));
      }
    };

    const onWindowBlur = () => {
      hideAll();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        hideAll();
      }
    };

    const onHelpMenuStateChange = () => {
      hideAll();
      updateSuppressedInteractionState();
    };

    document.addEventListener('keydown', onDocumentKeyDown, true);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('stage:help-menu-state', onHelpMenuStateChange);
    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('scroll', onWindowScroll, { passive: true, capture: true });
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    cleanup.push(() => document.removeEventListener('keydown', onDocumentKeyDown, true));
    cleanup.push(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true));
    cleanup.push(() => document.removeEventListener('stage:help-menu-state', onHelpMenuStateChange));
    cleanup.push(() => window.removeEventListener('resize', onWindowResize, { passive: true }));
    cleanup.push(() => window.removeEventListener('scroll', onWindowScroll, { passive: true, capture: true }));
    cleanup.push(() => window.removeEventListener('blur', onWindowBlur));
    cleanup.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

    bindAvailableTooltips();

    const observerTarget = document.body || document.documentElement;
    if (observerTarget) {
      const observer = new MutationObserver(() => {
        scheduleBind();
      });

      observer.observe(observerTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'inert', 'data-state', 'aria-expanded']
      });

      cleanup.push(() => observer.disconnect());
    }

    cleanup.push(() => {
      if (bindRafId) {
        window.cancelAnimationFrame(bindRafId);
        bindRafId = null;
      }
    });

    return {
      destroy() {
        hideAll();
        cleanup.splice(0).forEach((fn) => fn());
        Array.from(instances.values()).forEach(unbindInstance);
        instances.clear();
        activeOwner = null;
      }
    };
  };

  const init = () => {
    destroyPreviousManager();
    removeStaleWrappers();
    window.__stageTooltipManager = createManager();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
