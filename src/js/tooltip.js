// src/js/tooltip.js
(() => {
  const OPEN_DELAY = 150;
  const GAP = 8;
  const VIEWPORT_PADDING = 8;

  const TOOLTIPS = [
    {
      selector: '.composer-btn#composer-plus-btn',
      owner: 'composer-plus-btn',
      type: 'plus'
    },
    {
      selector: 'button[aria-label="Start dictation"]',
      owner: 'start-dictation-btn',
      type: 'dictation'
    },
    {
      selector: 'button[aria-label="Start Voice"]',
      owner: 'start-voice-btn',
      type: 'voice'
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

  const createTooltip = (type) => {
    const tooltipId = `radix-${Math.random().toString(36).slice(2)}`;

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate(0px, 0px)';
    wrapper.style.minWidth = 'max-content';
    wrapper.style.setProperty('--radix-popper-transform-origin', '50% 0px');
    wrapper.style.zIndex = '50';
    wrapper.style.setProperty('--radix-popper-available-width', `${window.innerWidth}px`);
    wrapper.style.setProperty('--radix-popper-available-height', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-width', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-height', '0px');
    wrapper.hidden = true;

    if (type === 'plus') {
      // Mantido intacto em relação ao tooltip original
      wrapper.innerHTML = `
        <div data-side="bottom" data-align="center" data-state="closed" class="relative z-50 transition-opacity select-none px-2 py-1 rounded-lg overflow-hidden dark bg-black max-w-xs touch:hidden" style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height);">
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
    } else if (type === 'dictation') {
      wrapper.innerHTML = `
        <div data-side="bottom" data-align="center" data-state="closed" class="relative z-50 transition-opacity select-none px-2 py-1 rounded-lg overflow-hidden dark bg-black max-w-xs" style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height);">
          <div class="flex items-center gap-1">
            <div>
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Dictate')}</div>
            </div>
          </div>
          <span id="${tooltipId}" role="tooltip" style="position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;">
            <div class="flex items-center gap-1">
              <div>
                <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Dictate')}</div>
              </div>
            </div>
          </span>
        </div>
      `;
    } else if (type === 'voice') {
      wrapper.innerHTML = `
        <div data-side="bottom" data-align="center" data-state="closed" class="relative z-50 transition-opacity select-none px-2 py-1 rounded-lg overflow-hidden dark bg-black max-w-xs" style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height);">
          <div class="flex items-center gap-1">
            <div>
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Use Voice')}</div>
            </div>
          </div>
          <span id="${tooltipId}" role="tooltip" style="position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;">
            <div class="flex items-center gap-1">
              <div>
                <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml('Use Voice')}</div>
              </div>
            </div>
          </span>
        </div>
      `;
    }

    document.body.appendChild(wrapper);

    return {
      wrapper,
      surface: wrapper.firstElementChild,
      srOnly: wrapper.querySelector('[role="tooltip"]')
    };
  };

  const bindTooltip = ({ selector, owner, type }) => {
    const btn = document.querySelector(selector);

    if (!btn || document.querySelector(`[data-radix-popper-content-wrapper][data-tooltip-owner="${owner}"]`)) {
      return;
    }

    const { wrapper, surface, srOnly } = createTooltip(type);
    wrapper.setAttribute('data-tooltip-owner', owner);

    let openTimer = null;
    let rafId = null;
    let isOpen = false;

    const updatePosition = () => {
      const rect = btn.getBoundingClientRect();
      const tooltipRect = surface.getBoundingClientRect();
      const x = Math.round(rect.left + rect.width / 2 - tooltipRect.width / 2);
      const y = Math.round(rect.bottom + GAP);
      const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING);
      const safeX = Math.min(Math.max(VIEWPORT_PADDING, x), maxX);
      const availableHeight = Math.max(0, Math.round(window.innerHeight - y));

      wrapper.style.transform = `translate(${safeX}px, ${y}px)`;
      wrapper.style.setProperty('--radix-popper-available-width', `${window.innerWidth}px`);
      wrapper.style.setProperty('--radix-popper-available-height', `${availableHeight}px`);
      wrapper.style.setProperty('--radix-popper-anchor-width', `${Math.round(rect.width)}px`);
      wrapper.style.setProperty('--radix-popper-anchor-height', `${Math.round(rect.height)}px`);
    };

    const openNow = () => {
      wrapper.hidden = false;
      surface.setAttribute('data-state', 'delayed-open');
      btn.setAttribute('aria-describedby', srOnly.id);

      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        updatePosition();
        isOpen = true;
      });
    };

    const show = () => {
      clearTimeout(openTimer);
      openTimer = window.setTimeout(openNow, OPEN_DELAY);
    };

    const hide = () => {
      clearTimeout(openTimer);

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      surface.setAttribute('data-state', 'closed');
      wrapper.hidden = true;
      btn.removeAttribute('aria-describedby');
      isOpen = false;
    };

    btn.addEventListener('mouseenter', show);
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('focus', show);
    btn.addEventListener('blur', hide);
    btn.addEventListener('click', hide);
    btn.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hide();
    });

    window.addEventListener('resize', () => {
      if (isOpen) updatePosition();
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (isOpen) updatePosition();
    }, { passive: true, capture: true });
  };

  const init = () => {
    TOOLTIPS.forEach(bindTooltip);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();