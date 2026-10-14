import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANAGED_MARK,
  PAGE_SCOPED_MARK,
  importLine,
  hasManagedImport,
  hasPageScopedMark,
  isTailwindPowered,
  isV4Entry,
  addManagedImport,
  removeManagedImport,
  removeImportsUnder
} from './imports';

test('importLine formats a managed @import', () => {
  assert.equal(importLine('pages/about.css'), '@import "./pages/about.css";');
});

test('addManagedImport creates a managed block when mark is missing', () => {
  const input = '@tailwind base;\n@tailwind utilities;\n';
  const out = addManagedImport(input, 'pages/about.css');
  assert.ok(out.indexOf('/* ' + MANAGED_MARK + ' */') === 0);
  assert.ok(out.indexOf('@import "./pages/about.css";') !== -1);
  assert.ok(out.indexOf('@tailwind base;') !== -1);
});

test('addManagedImport inserts after the mark when present', () => {
  const input = '/* ' + MANAGED_MARK + ' */\n\n@tailwind base;\n';
  const out = addManagedImport(input, 'a.css');
  const idx = out.indexOf(MANAGED_MARK);
  assert.ok(out.indexOf('@import "./a.css";') > idx);
  assert.equal(addManagedImport(out, 'a.css'), out, 'idempotent');
});

test('removeManagedImport removes only the matching line', () => {
  const input = '/* ' + MANAGED_MARK + ' */\n@import "./a.css";\n@import "./b.css";\n\n@tailwind base;\n';
  const out = removeManagedImport(input, 'a.css');
  assert.equal(out.indexOf('@import "./a.css";'), -1);
  assert.ok(out.indexOf('@import "./b.css";') !== -1);
  assert.equal(removeManagedImport(out, 'a.css'), out, 'no-op when absent');
});

test('removeImportsUnder removes all imports under a directory', () => {
  const input =
    '/* ' + MANAGED_MARK + ' */\n@import "./pages/a.css";\n@import "./pages/sub/b.css";\n@import "./other.css";\n';
  const out = removeImportsUnder(input, 'pages');
  assert.equal(out.indexOf('./pages/a.css'), -1);
  assert.equal(out.indexOf('./pages/sub/b.css'), -1);
  assert.ok(out.indexOf('./other.css') !== -1);
});

test('mark and powered detection helpers', () => {
  assert.equal(hasPageScopedMark('x /* ' + PAGE_SCOPED_MARK + ' */'), true);
  assert.equal(hasPageScopedMark('plain'), false);
  assert.equal(isTailwindPowered('.a { @apply p-4; }'), true);
  assert.equal(isTailwindPowered('@screen md { }'), true);
  assert.equal(isTailwindPowered('.a { color: red; }'), false);
  assert.equal(isV4Entry('@import "tailwindcss";'), true);
  assert.equal(isV4Entry('@import \'tailwindcss\' prefix(tw);'), true);
  assert.equal(isV4Entry('@tailwind base;'), false);
});

test('hasManagedImport', () => {
  assert.equal(hasManagedImport('@import "./a.css";', 'a.css'), true);
  assert.equal(hasManagedImport('@import "./a.css";', 'b.css'), false);
});
