const dialog = document.querySelector('#start-dialog');
document.querySelectorAll('[data-open-start]').forEach(button => {
  button.addEventListener('click', () => dialog.showModal());
});
document.querySelectorAll('.close-dialog').forEach(button => {
  button.addEventListener('click', () => dialog.close());
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});

// Selection stays in this prototype session; it does not create or persist projects.
const projectOptions = [...document.querySelectorAll('[data-project]')];
const selectionStatus = document.querySelector('#selection-status');
projectOptions.forEach(option => {
  option.addEventListener('click', () => {
    projectOptions.forEach(candidate => candidate.setAttribute('aria-pressed', String(candidate === option)));
    selectionStatus.textContent = 'Seleccionaste: ' + option.dataset.title + '.';
  });
});
