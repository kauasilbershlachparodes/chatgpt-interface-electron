// src/js/tooltip.js
(() => {
  const OPEN_DELAY = 150;
  const GAP = 8;
  const VIEWPORT_PADDING = 8;
  const POINTER_FOCUS_SUPPRESSION_MS = 350;

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

  const createTooltipInner = (type, side, tooltipId) => {
    const baseClass = 'relative z-50 transition-opacity select-none px-2 py-1 rounded-lg overflow-hidden dark bg-black max-w-xs';
    const commonStyle = 'style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height);"';

    if (type === 'plus') {
      return `
        <div data-side="bottom" data-align="center" data-state="closed" class="${baseClass} touch:hidden" ${commonStyle}>
          <div class="flex items-center gap-1">
            <div class="flex gap-2">
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Add files and more')}</div>
              <div class="text-token-text-tertiary text-xs font-medium whitespace-pre-wrap text-center"><kbd class="bg-token-bg-tertiary -me-1 inline-grid aspect-square w-4 items-center justify-center rounded-sm text-[11px]"><span>${escapeHtml('/')}</span></kbd></div>
            </div>
          </div>
          <span id="${tooltipId}" role="tooltip" style="position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;">
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

    const labelByType = {
      dictation: 'Dictate',
      voice: 'Use Voice',
      'close-sidebar': 'Close sidebar',
      'open-sidebar': 'Open sidebar'
    };

    const label = labelByType[type];
    const dataSide = side === 'right' ? 'right' : 'bottom';

    return `
      <div data-side="${escapeHtml(dataSide)}" data-align="center" data-state="closed" class="${baseClass}" ${commonStyle}>
        <div class="flex items-center gap-1">
          <div>
            <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml(label)}</div>
          </div>
        </div>
        <span id="${tooltipId}" role="tooltip" style="position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;">
          <div class="flex items-center gap-1">
            <div>
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml(label)}</div>
            </div>
          </div>
        </span>
      </div>
    `;
  };

  const createTooltip = ({ owner, type, side }) => {
    const tooltipId = `radix-${Math.random().toString(36).slice(2)}`;
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.setAttribute('data-tooltip-owner', owner);
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate(0px, 0px)';
    wrapper.style.minWidth = 'max-content';
    wrapper.style.zIndex = '50';
    wrapper.style.setProperty('--radix-popper-transform-origin', side === 'right' ? '0px 50%' : '50% 0px');
    wrapper.style.setProperty('--radix-popper-available-width', `${window.innerWidth}px`);
    wrapper.style.setProperty('--radix-popper-available-height', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-width', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-height', '0px');
    wrapper.hidden = true;
    wrapper.innerHTML = createTooltipInner(type, side, tooltipId);
    document.body.appendChild(wrapper);

    return {
      wrapper,
      surface: wrapper.firstElementChild,
      srOnly: wrapper.querySelector('[role="tooltip"]')
    };
  };

  const removeStaleWrappers = () => {
    document.querySelectorAll('[data-radix-popper-content-wrapper][data-tooltip-owner]').forEach((node) => {
      node.remove();
    });
  };

  const isElementAvailable = (element) => (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.hidden &&
    element.getClientRects().length > 0
  );

  const destroyPreviousManager = () => {
    if (window.__stageTooltipManager && typeof window.__stageTooltipManager.destroy === 'function') {
      window.__stageTooltipManager.destroy();
    }
  };

  const createManager = () => {
    let activeOwner = null;
    let suppressFocusUntil = 0;
    let keyboardMode = false;
    const instances = new Map();
    const cleanup = [];

    const hideInstance = (instance) => {
      if (!instance) {
        return;
      }

      window.clearTimeout(instance.openTimer);
      instance.openTimer = null;

      if (instance.rafId) {
        window.cancelAnimationFrame(instance.rafId);
        instance.rafId = null;
      }

      instance.surface.setAttribute('data-state', 'closed');
      instance.wrapper.hidden = true;
      instance.button?.removeAttribute('aria-describedby');
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
        y = Math.round(rect.top + (rect.height - tooltipRect.height) / 2);
        instance.wrapper.style.setProperty('--radix-popper-transform-origin', '0px 50%');
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
      instance.surface.setAttribute('data-state', 'delayed-open');
      instance.button.setAttribute('aria-describedby', instance.srOnly.id);

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
      if (!instance || !isElementAvailable(instance.button)) {
        return;
      }

      window.clearTimeout(instance.openTimer);
      instance.openTimer = window.setTimeout(() => openNow(instance), OPEN_DELAY);
    };

    const shouldOpenFromFocus = () => keyboardMode && Date.now() >= suppressFocusUntil;

    const bindTooltip = (config) => {
      const button = config.getElement();
      if (!isElementAvailable(button) || button.dataset.tooltipBound === 'true') {
        return;
      }

      const parts = createTooltip(config);
      const instance = {
        owner: config.owner,
        side: config.side,
        button,
        openTimer: null,
        rafId: null,
        isOpen: false,
        ...parts
      };

      instances.set(config.owner, instance);
      button.dataset.tooltipBound = 'true';

      const onMouseEnter = () => {
        keyboardMode = false;
        scheduleOpen(instance);
      };

      const onMouseLeave = () => {
        hideInstance(instance);
      };

      const onFocus = () => {
        if (shouldOpenFromFocus()) {
          scheduleOpen(instance);
        }
      };

      const onBlur = () => {
        hideInstance(instance);
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

      cleanup.push(() => {
        button.removeEventListener('mouseenter', onMouseEnter);
        button.removeEventListener('mouseleave', onMouseLeave);
        button.removeEventListener('focus', onFocus);
        button.removeEventListener('blur', onBlur);
        button.removeEventListener('pointerdown', onPointerDown);
        button.removeEventListener('click', onClick);
        button.removeEventListener('keydown', onKeyDown);
        delete button.dataset.tooltipBound;
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

    document.addEventListener('keydown', onDocumentKeyDown, true);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('scroll', onWindowScroll, { passive: true, capture: true });
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    cleanup.push(() => document.removeEventListener('keydown', onDocumentKeyDown, true));
    cleanup.push(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true));
    cleanup.push(() => window.removeEventListener('resize', onWindowResize, { passive: true }));
    cleanup.push(() => window.removeEventListener('scroll', onWindowScroll, { passive: true, capture: true }));
    cleanup.push(() => window.removeEventListener('blur', onWindowBlur));
    cleanup.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

    TOOLTIPS.forEach(bindTooltip);

    return {
      destroy() {
        hideAll();
        cleanup.splice(0).forEach((fn) => fn());
        instances.forEach((instance) => instance.wrapper.remove());
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
