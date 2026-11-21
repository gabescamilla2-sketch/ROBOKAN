const dialog = document.querySelector('#start-dialog');
document.querySelector('[data-open-start]').addEventListener('click', () => { window.location.href = 'circuits.html'; });
document.querySelectorAll('.close-dialog').forEach(button => {
  button.addEventListener('click', () => dialog.close());
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});

// The copied kit owns tab selection; add standard arrow-key navigation.
const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((tab, index) => {
  tab.addEventListener('keydown', event => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    next.click();
    next.focus();
  });
});

// Translate generated pause controls without changing the vendor runtime.
new MutationObserver(() => {
  document.querySelectorAll('.mo-mq__pause[aria-label="Pause"], .mo-mq__pause[aria-label="Play"]').forEach(button => {
    button.setAttribute('aria-label', button.getAttribute('aria-label') === 'Pause' ? 'Pausar animación' : 'Reanudar animación');
  });
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
