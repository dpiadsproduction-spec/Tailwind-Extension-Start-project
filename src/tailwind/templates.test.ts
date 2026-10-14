import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inputCssTemplate,
  configTemplate,
  defaultHtml,
  defaultFileContent,
  scopedCssTemplate,
  plainPageCssTemplate,
  tailwindPageCssTemplate,
  ownInputCssTemplate,
  pageJsTemplate,
  pageHtmlTemplate
} from './templates';
import { MANAGED_MARK, PAGE_SCOPED_MARK } from './imports';

test('inputCssTemplate starts with managed mark and includes directives', () => {
  const out = inputCssTemplate('@import "tailwindcss";\n');
  assert.ok(out.indexOf('/* ' + MANAGED_MARK + ' */') === 0);
  assert.ok(out.indexOf('@import "tailwindcss";') !== -1);
});

test('configTemplate renders content globs', () => {
  const out = configTemplate(['./index.html', './src/**/*.{js,ts}']);
  assert.ok(out.indexOf('"./index.html"') !== -1);
  assert.ok(out.indexOf('"./src/**/*.{js,ts}"') !== -1);
  assert.ok(out.indexOf('module.exports') !== -1);
});

test('defaultHtml links the stylesheet and uses tailwind classes', () => {
  const out = defaultHtml('../style.css');
  assert.ok(out.indexOf('href="../style.css"') !== -1);
  assert.ok(out.indexOf('class="text-3xl') !== -1);
});

test('defaultFileContent routes by extension and special names', () => {
  assert.equal(defaultFileContent('input.css', 'style.css', '@tailwind base;', 'generic'), '@tailwind base;');
  assert.ok(defaultFileContent('tailwind.config.js', 'style.css', '', 'next').indexOf('./app/**') !== -1);
  assert.ok(defaultFileContent('a.html', 'style.css', '', 'generic').indexOf('<html') !== -1);
  assert.equal(defaultFileContent('a.css', 'style.css', '', 'generic'), '/* a.css */\n');
  assert.equal(defaultFileContent('a.js', 'style.css', '', 'generic'), '// a.js\n');
});

test('page css templates carry the correct markers', () => {
  assert.ok(scopedCssTemplate('about').indexOf(PAGE_SCOPED_MARK) !== -1);
  assert.ok(plainPageCssTemplate('about').indexOf(PAGE_SCOPED_MARK) !== -1);
  assert.ok(tailwindPageCssTemplate('about').indexOf('@apply') !== -1);
  assert.ok(tailwindPageCssTemplate('about').indexOf(PAGE_SCOPED_MARK) === -1);
  assert.ok(ownInputCssTemplate('about', '@import "tailwindcss";\n').indexOf('@import "tailwindcss";') !== -1);
});

test('pageJsTemplate wraps in DOMContentLoaded', () => {
  assert.ok(pageJsTemplate('about').indexOf('DOMContentLoaded') !== -1);
});

test('pageHtmlTemplate injects extra link and script when provided', () => {
  const out = pageHtmlTemplate('about', '../style.css', '../pages/about.css', '../pages/about.js');
  assert.ok(out.indexOf('href="../style.css"') !== -1);
  assert.ok(out.indexOf('href="../pages/about.css"') !== -1);
  assert.ok(out.indexOf('<script src="../pages/about.js" defer></script>') !== -1);
});
