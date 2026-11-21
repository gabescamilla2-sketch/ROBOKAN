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

// Preserve project selection and open the matching local circuit workbench explicitly.
const projectOptions = [...document.querySelectorAll('[data-project]')];
const selectionStatus = document.querySelector('#selection-status');
const openCircuit = document.querySelector('#open-circuit');
projectOptions.forEach(option => {
  option.addEventListener('click', () => {
    projectOptions.forEach(candidate => candidate.setAttribute('aria-pressed', String(candidate === option)));
    selectionStatus.textContent = 'Seleccionaste: ' + option.dataset.title + '.';
    if (openCircuit) {
      openCircuit.href = './circuit.html?project=' + encodeURIComponent(option.dataset.project);
      openCircuit.hidden = false;
    }
  });
});
