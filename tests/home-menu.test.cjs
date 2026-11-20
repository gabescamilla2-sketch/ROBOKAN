const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function setup() {
  const element = (dataset = {}) => ({ dataset, events: {}, attrs: {}, textContent: '', addEventListener(n, fn) { this.events[n] = fn; }, setAttribute(n, value) { this.attrs[n] = value; } });
  const dialog = Object.assign(element(), { open: false, showModal() { this.open = true; }, close() { this.open = false; }, getBoundingClientRect() { return { left: 10, top: 10, right: 100, bottom: 100 }; } });
  const options = [...html.matchAll(/data-project="([^"]+)" data-title="([^"]+)"/g)].map(match => element({ project: match[1], title: match[2] }));
  const openers = [...html.matchAll(/data-open-start/g)].map(() => element());
  const closers = [element()];
  const status = element();
  const document = { querySelector(s) { return s === '#start-dialog' ? dialog : status; }, querySelectorAll(s) { return s === '[data-open-start]' ? openers : s === '[data-project]' ? options : closers; } };
  vm.runInNewContext(code, { document });
  return { dialog, options, openers, closers, status };
}
test('both existing start buttons open the robot menu and close returns home', () => {
  const s = setup(); assert.equal(s.openers.length, 2);
  for (const opener of s.openers) { opener.events.click(); assert.equal(s.dialog.open, true); s.closers[0].events.click(); assert.equal(s.dialog.open, false); }
});
for (const id of ['avoider', 'line-follower', 'blank']) {
  test('select project through its button: ' + id, () => {
    const s = setup(); const selected = s.options.find(option => option.dataset.project === id); assert.ok(selected);
    s.options[0].events.click(); selected.events.click();
    assert.equal(selected.attrs['aria-pressed'], 'true');
    assert.equal(s.options.filter(option => option.attrs['aria-pressed'] === 'true').length, 1);
    assert.equal(s.status.textContent, 'Seleccionaste: ' + selected.dataset.title + '.');
  });
}
test('existing backdrop behavior closes only outside the dialog', () => {
  const s = setup(); s.openers[0].events.click(); s.dialog.events.click({target:s.dialog,clientX:50,clientY:50}); assert.equal(s.dialog.open,true);
  s.dialog.events.click({target:s.dialog,clientX:5,clientY:5}); assert.equal(s.dialog.open,false);
});
