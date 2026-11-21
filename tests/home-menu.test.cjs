const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function setup(t) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const observers = [];
  const NativeObserver = dom.window.MutationObserver;
  dom.window.MutationObserver = class extends NativeObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  t.after(() => { observers.forEach(observer => observer.disconnect()); dom.window.close(); });
  const dialog = dom.window.document.querySelector('#start-dialog');
  dialog.close = () => dialog.removeAttribute('open');
  dialog.getBoundingClientRect = () => ({ left: 10, top: 10, right: 100, bottom: 100 });
  dom.window.eval(code);
  return dom.window;
}
test('start button targets the new circuit page', () => {
  assert.match(code, /window\.location\.href\s*=\s*'circuits\.html'/);
  assert.ok(html.includes('data-open-start'));
  assert.ok(fs.existsSync(path.join(root, 'circuits.html')));
});
test('home script initializes with browser APIs', t => {
  const window = setup(t);
  assert.ok(window.document.querySelector('[data-open-start]'));
});
test('arrow keys select and focus the next language tab', t => {
  const window = setup(t);
  const tabs = [...window.document.querySelectorAll('[role="tab"]')];
  let clicked = false;
  tabs[1].addEventListener('click', () => { clicked = true; });
  tabs[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  assert.equal(clicked, true);
  assert.equal(window.document.activeElement, tabs[1]);
});
test('arrow keys wrap to the last tab', t => {
  const window = setup(t);
  const tabs = [...window.document.querySelectorAll('[role="tab"]')];
  tabs[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  assert.equal(window.document.activeElement, tabs.at(-1));
});
test('mutation observer translates generated animation controls', async t => {
  const window = setup(t);
  const button = window.document.createElement('button');
  button.className = 'mo-mq__pause';
  button.setAttribute('aria-label', 'Pause');
  window.document.body.append(button);
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.equal(button.getAttribute('aria-label'), 'Pausar animación');
});
