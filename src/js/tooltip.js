// src/js/tooltip.js
(() => {
  const TOOLTIP_TEXT = "Add files and more";
  const SHORTCUT_TEXT = "/";
  const OPEN_DELAY = 150;

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));

  const createTooltip = () => {
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
    wrapper.style.setProperty('--radix-popper-available-height', `${window.innerHeight}px`);
    wrapper.style.setProperty('--radix-popper-anchor-width', '0px');
    wrapper.style.setProperty('--radix-popper-anchor-height', '0px');
    wrapper.hidden = true;

    wrapper.innerHTML = `
      <div
        data-side="bottom"
        data-align="center"
        data-state="closed"
        class="relative z-50 transition-opacity select-none px-2 py-1 rounded-lg overflow-hidden dark bg-black max-w-xs touch:hidden"
        style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height); opacity: 0;"
      >
        <div class="flex items-center gap-1">
          <div class="flex gap-2">
            <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml(TOOLTIP_TEXT)}</div>
            <div class="text-token-text-tertiary text-xs font-medium whitespace-pre-wrap text-center">
              <kbd class="bg-token-bg-tertiary -me-1 inline-grid aspect-square w-4 items-center justify-center rounded-sm text-[11px]"><span>${escapeHtml(SHORTCUT_TEXT)}</span></kbd>
            </div>
          </div>
        </div>
        <span
          id="${tooltipId}"
          role="tooltip"
          style="position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;"
        >
          <div class="flex items-center gap-1">
            <div class="flex gap-2">
              <div class="text-token-text-primary text-xs font-semibold whitespace-pre-wrap text-center">${escapeHtml(TOOLTIP_TEXT)}</div>
              <div class="text-token-text-tertiary text-xs font-medium whitespace-pre-wrap text-center">
                <kbd class="bg-token-bg-tertiary -me-1 inline-grid aspect-square w-4 items-center justify-center rounded-sm text-[11px]"><span>${escapeHtml(SHORTCUT_TEXT)}</span></kbd>
              </div>
            </div>
          </div>
        </span>
      </div>
    `;

    document.body.appendChild(wrapper);

    return {
      wrapper,
      surface: wrapper.firstElementChild,
      srOnly: wrapper.querySelector('[role="tooltip"]')
    };
  };

  const init = () => {
    const btn = document.querySelector('.composer-btn#composer-plus-btn');
    if (!btn || document.querySelector('[data-radix-popper-content-wrapper][data-tooltip-owner="composer-plus-btn"]')) {
      return;
    }

    const { wrapper, surface, srOnly } = createTooltip();
    wrapper.setAttribute('data-tooltip-owner', 'composer-plus-btn');

    let openTimer = null;
    let isOpen = false;

    const updatePosition = () => {
      const rect = btn.getBoundingClientRect();
      const tooltipRect = surface.getBoundingClientRect();
      const gap = 8;
      const x = Math.round(rect.left + (rect.width / 2) - (tooltipRect.width / 2));
      const y = Math.round(rect.bottom + gap);
      const maxX = Math.max(8, window.innerWidth - tooltipRect.width - 8);
      const safeX = Math.min(Math.max(8, x), maxX);

      wrapper.style.transform = `translate(${safeX}px, ${y}px)`;
      wrapper.style.setProperty('--radix-popper-available-width', `${window.innerWidth}px`);
      wrapper.style.setProperty('--radix-popper-available-height', `${Math.max(0, window.innerHeight - y)}px`);
      wrapper.style.setProperty('--radix-popper-anchor-width', `${Math.round(rect.width)}px`);
      wrapper.style.setProperty('--radix-popper-anchor-height', `${Math.round(rect.height)}px`);
    };

    const show = () => {
      clearTimeout(openTimer);
      openTimer = window.setTimeout(() => {
        wrapper.hidden = false;
        surface.setAttribute('data-state', 'delayed-open');
        updatePosition();
        surface.style.opacity = '1';
        btn.setAttribute('aria-describedby', srOnly.id);
        isOpen = true;
      }, OPEN_DELAY);
    };

    const hide = () => {
      clearTimeout(openTimer);
      surface.setAttribute('data-state', 'closed');
      surface.style.opacity = '0';
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
