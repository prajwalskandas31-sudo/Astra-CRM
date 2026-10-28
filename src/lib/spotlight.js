// Mouse-follow glow, as on the login fields: exposes the pointer position inside the hovered
// surface to CSS as --spot-x / --spot-y (styled in src/styles/astra-orbit.css). Purely visual.
const SURFACES = '.directory-card, .metric-card, .eod-metric-box, input, textarea';

export function installSpotlight() {
  if (typeof window === 'undefined' || window.matchMedia?.('(pointer: coarse)').matches) return;

  let frame = 0;
  let lastEvent = null;

  document.addEventListener('pointermove', (event) => {
    lastEvent = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const target = lastEvent.target instanceof Element ? lastEvent.target.closest(SURFACES) : null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--spot-x', `${lastEvent.clientX - rect.left}px`);
      target.style.setProperty('--spot-y', `${lastEvent.clientY - rect.top}px`);
    });
  }, { passive: true });
}
