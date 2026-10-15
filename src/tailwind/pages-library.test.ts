import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_TEMPLATES, findTemplate, composePage } from './pages-library';

test('all expected templates exist with unique ids', () => {
  const ids = PAGE_TEMPLATES.map((t) => t.id);
  for (const expected of ['basic', 'hero', 'header', 'footer', 'cards', 'form', 'pricing', 'dashboard', 'notfound']) {
    assert.ok(ids.indexOf(expected as never) !== -1, 'missing ' + expected);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('every template produces a non-empty body', () => {
  for (const t of PAGE_TEMPLATES) {
    const body = t.body('عنوان');
    assert.ok(body.length > 0, t.id + ' empty');
  }
});

test('findTemplate returns the matching template', () => {
  assert.equal(findTemplate('hero')?.id, 'hero');
  assert.equal(findTemplate('nope' as never), undefined);
});

test('composePage builds a valid HTML shell with links', () => {
  const t = findTemplate('hero');
  assert.ok(t);
  const html = composePage({
    template: t as NonNullable<typeof t>,
    title: 'مرحبا',
    sharedHref: '../style.css',
    extraHref: '../pages/home.css',
    scriptHref: '../pages/home.js'
  });
  assert.ok(html.indexOf('<!DOCTYPE html>') === 0);
  assert.ok(html.indexOf('href="../style.css"') !== -1);
  assert.ok(html.indexOf('href="../pages/home.css"') !== -1);
  assert.ok(html.indexOf('<script src="../pages/home.js" defer></script>') !== -1);
  assert.ok(html.indexOf('مرحبا') !== -1);
});

test('composePage escapes the title', () => {
  const t = findTemplate('basic');
  const html = composePage({ template: t as NonNullable<typeof t>, title: '<b>x</b>', sharedHref: 'style.css' });
  assert.ok(html.indexOf('<title>&lt;b&gt;x&lt;/b&gt;</title>') !== -1);
  assert.equal(html.indexOf('<b>x</b>'), -1);
});
