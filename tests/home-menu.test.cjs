const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function setup(t) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
  });
  const observers = [];
  const NativeObserver = dom.window.MutationObserver;
  dom.window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super(callback);
      observers.push(this);
    }
  };
  t.after(() => {
    observers.forEach((observer) => observer.disconnect());
    dom.window.close();
  });
  const dialog = dom.window.document.querySelector('#start-dialog');
  dialog.close = () => dialog.removeAttribute('open');
  dialog.getBoundingClientRect = () => ({
    left: 10,
    top: 10,
    right: 100,
    bottom: 100,
  });
  dom.window.eval(code);
  return dom.window;
}
test('start button targets the new circuit page', () => {
  assert.match(code, /window\.location\.href\s*=\s*'circuits\.html'/);
  assert.ok(html.includes('data-open-start'));
  assert.ok(fs.existsSync(path.join(root, 'circuits.html')));
});
test('home script initializes with browser APIs', (t) => {
  const window = setup(t);
  assert.ok(window.document.querySelector('[data-open-start]'));
});
test('arrow keys select and focus the next language tab', (t) => {
  const window = setup(t);
  const tabs = [...window.document.querySelectorAll('[role="tab"]')];
  let clicked = false;
  tabs[1].addEventListener('click', () => {
    clicked = true;
  });
  tabs[0].dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(clicked, true);
  assert.equal(window.document.activeElement, tabs[1]);
});
test('arrow keys wrap to the last tab', (t) => {
  const window = setup(t);
  const tabs = [...window.document.querySelectorAll('[role="tab"]')];
  tabs[0].dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(window.document.activeElement, tabs.at(-1));
});
test('mutation observer translates generated animation controls', async (t) => {
  const window = setup(t);
  const button = window.document.createElement('button');
  button.className = 'mo-mq__pause';
  button.setAttribute('aria-label', 'Pause');
  window.document.body.append(button);
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  assert.equal(button.getAttribute('aria-label'), 'Pausar animación');
});

test('home presents real interface captures without a fabricated workbench', () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const captures = [
    ...document.querySelectorAll('img[data-interface-capture]'),
  ];
  assert.ok(captures.length >= 2);
  for (const image of captures) {
    assert.ok(image.getAttribute('alt'));
    assert.ok(fs.existsSync(path.join(root, image.getAttribute('src'))));
  }
  assert.equal(document.querySelector('.workbench'), null);
  assert.equal(document.querySelector('.robot'), null);
  dom.window.close();
});

test('home tool tabs update screenshot visibility and editor destination', (t) => {
  const window = setup(t);
  const document = window.document;
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) =>
    document.getElementById(tab.getAttribute('aria-controls')),
  );
  tabs[0].click();
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[1].hidden, true);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].getAttribute('tabindex'), '0');
  assert.equal(
    document.querySelector('[data-preview-open]').getAttribute('href'),
    'circuits.html',
  );
  tabs[0].dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);
  assert.equal(
    document.querySelector('[data-preview-open]').getAttribute('href'),
    'blocks.html',
  );
});

test('home uses the supplied logos and keeps an empty footer reserve', () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  assert.ok(document.querySelector('.nav__logo img[data-brand-logo]'));
  assert.ok(document.querySelector('footer img[data-brand-logo]'));
  const reserve = document.querySelector('[data-footer-reserve]');
  assert.ok(reserve);
  assert.equal(reserve.textContent.trim(), '');
  assert.equal(document.querySelector('.home-wordmark'), null);
  const walker = document.createTreeWalker(
    document.body,
    dom.window.NodeFilter.SHOW_TEXT,
  );
  let node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement.closest('script,style'))
      assert.doesNotMatch(node.textContent, /ROBOKAN/i);
  }
  dom.window.close();
});

test('home robot animation can be paused and resumed', (t) => {
  const window = setup(t);
  const document = window.document;
  const robot = document.querySelector('[data-hero-robot]');
  assert.ok(robot);
  assert.match(robot.getAttribute('src'), /assets\/home\/robot\.webp$/);
  const control = document.querySelector('[data-toggle-motion]');
  const panel = document.querySelector('[data-hero-motion]');
  assert.ok(control);
  control.click();
  assert.equal(control.getAttribute('aria-pressed'), 'true');
  assert.ok(panel.classList.contains('motion-paused'));
  control.click();
  assert.equal(control.getAttribute('aria-pressed'), 'false');
  assert.equal(panel.classList.contains('motion-paused'), false);
});
