import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeInputCss, extractThemeExtend, buildUpgradeNotes, themeComment } from './upgrade';

test('upgradeInputCss replaces v3 directives with the v4 import', () => {
  const out = upgradeInputCss('@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n.x { color: red; }\n');
  assert.ok(out.indexOf('@import "tailwindcss";') === 0);
  assert.equal(out.indexOf('@tailwind'), -1);
  assert.ok(out.indexOf('.x { color: red; }') !== -1);
});

test('upgradeInputCss does not duplicate an existing v4 import', () => {
  const out = upgradeInputCss('@import "tailwindcss";\n.x {}\n');
  assert.equal(out.match(/@import "tailwindcss";/g)!.length, 1);
});

test('upgradeInputCss strips a BOM', () => {
  const out = upgradeInputCss('\uFEFF@tailwind base;\n');
  assert.ok(out.indexOf('\uFEFF') === -1);
  assert.ok(out.indexOf('@import "tailwindcss";') === 0);
});

test('extractThemeExtend pulls the extend body', () => {
  const cfg = "module.exports = {\n  theme: { extend: { colors: { brand: '#123' } } },\n};\n";
  assert.equal(extractThemeExtend(cfg), "colors: { brand: '#123' }");
});

test('extractThemeExtend returns undefined when there is no theme', () => {
  assert.equal(extractThemeExtend('module.exports = { content: [] };'), undefined);
});

test('buildUpgradeNotes mentions theme and plugins when present', () => {
  const notes = buildUpgradeNotes("module.exports = { theme: { extend: {} }, plugins: [] };");
  assert.ok(notes.some((n) => n.indexOf('theme') !== -1));
  assert.ok(notes.some((n) => n.indexOf('plugins') !== -1));
});

test('themeComment prefixes each line', () => {
  const comment = themeComment('colors: {}');
  assert.ok(comment.indexOf(' * colors: {}') !== -1);
  assert.equal(themeComment(undefined), '');
});
