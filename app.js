const dialog = document.querySelector('#start-dialog');
document.querySelector('[data-open-start]').addEventListener('click', () => {
  window.location.href = 'circuits.html';
});
document.querySelectorAll('.close-dialog').forEach((button) => {
  button.addEventListener('click', () => dialog.close());
});
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    dialog.close();
});

// The copied kit owns tab selection; add standard arrow-key navigation.
const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.setAttribute('tabindex', active ? '0' : '-1');
      document.getElementById(item.getAttribute('aria-controls')).hidden =
        !active;
    });
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    const openLink = document.querySelector('[data-preview-open]');
    if (openLink)
      openLink.setAttribute(
        'href',
        panel.querySelector('a').getAttribute('href'),
      );
  });
  tab.addEventListener('keydown', (event) => {
    const offset =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    next.click();
    next.focus();
  });
});

// Translate generated pause controls without changing the vendor runtime.
new MutationObserver(() => {
  document
    .querySelectorAll(
      '.mo-mq__pause[aria-label="Pause"], .mo-mq__pause[aria-label="Play"]',
    )
    .forEach((button) => {
      button.setAttribute(
        'aria-label',
        button.getAttribute('aria-label') === 'Pause'
          ? 'Pausar animación'
          : 'Reanudar animación',
      );
    });
}).observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['aria-label'],
});

// Only the homepage's decorative robot moves; editor state is never touched.
const heroMotion = document.querySelector('[data-hero-motion]');
const motionToggle = document.querySelector('[data-toggle-motion]');
motionToggle?.addEventListener('click', () => {
  const paused = heroMotion.classList.toggle('motion-paused');
  motionToggle.setAttribute('aria-pressed', String(paused));
  motionToggle.setAttribute(
    'aria-label',
    paused ? 'Reanudar animaciones' : 'Pausar animaciones',
  );
  motionToggle.querySelector('span').textContent = paused
    ? 'Reanudar animación'
    : 'Pausar animación';
  motionToggle
    .querySelector('use')
    .setAttribute('href', paused ? '#home-play' : '#home-pause');
});
