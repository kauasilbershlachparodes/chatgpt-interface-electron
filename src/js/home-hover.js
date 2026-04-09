// src/js/home-hover.js
(() => {
  const ROTATION_DEG = 60;
  const DURATION_MS = 300;
  const HOVER_OPACITY = '0.7';

  const initHomeHover = () => {
    const homeLink = document.querySelector('a[data-sidebar-item="true"][aria-label="Home"][href="/"]');
    const icon = homeLink?.querySelector('svg');

    if (!(homeLink instanceof HTMLElement) || !(icon instanceof SVGElement) || homeLink.dataset.homeHoverBound === 'true') {
      return;
    }

    homeLink.dataset.homeHoverBound = 'true';
    icon.style.transformOrigin = '50% 50%';
    icon.style.transition = `transform ${DURATION_MS}ms ease, opacity ${DURATION_MS}ms ease`;
    let currentRotationDeg = 0;

    const onMouseEnter = () => {
      currentRotationDeg += ROTATION_DEG;
      icon.style.transform = `rotate(${currentRotationDeg}deg)`;
      icon.style.opacity = HOVER_OPACITY;
    };

    const onMouseLeave = () => {
      icon.style.opacity = '';
    };

    homeLink.addEventListener('mouseenter', onMouseEnter);
    homeLink.addEventListener('mouseleave', onMouseLeave);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeHover, { once: true });
  } else {
    initHomeHover();
  }
})();
