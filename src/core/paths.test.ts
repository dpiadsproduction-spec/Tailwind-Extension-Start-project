import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRelPath, dirOf, baseName, slugify, relativeHref, resolveHref, toPosix } from './paths';

test('toPosix converts backslashes', () => {
  assert.equal(toPosix('a\\b\\c'), 'a/b/c');
});

test('sanitizeRelPath strips empty, dot and dotdot segments', () => {
  assert.equal(sanitizeRelPath('  a//b/./c/../d '), 'a/b/c/d');
  assert.equal(sanitizeRelPath('a\\b\\c.css'), 'a/b/c.css');
  assert.equal(sanitizeRelPath('/abs/path'), 'abs/path');
  assert.equal(sanitizeRelPath('..'), '');
});

test('dirOf returns parent folder', () => {
  assert.equal(dirOf('a/b/c.html'), 'a/b');
  assert.equal(dirOf('x.css'), '');
});

test('baseName returns file name', () => {
  assert.equal(baseName('a/b/c.html'), 'c.html');
  assert.equal(baseName('c.html'), 'c.html');
});

test('slugify produces safe base', () => {
  assert.equal(slugify('About Us!.HTML'), 'about-us-html');
});

test('relativeHref computes ../ depth correctly', () => {
  assert.equal(relativeHref('index.html', 'style.css'), 'style.css');
  assert.equal(relativeHref('pages/about.html', 'style.css'), '../style.css');
  assert.equal(relativeHref('a/b/c.html', 'a/d/x.css'), '../d/x.css');
  assert.equal(relativeHref('a/b/c.html', 'a/b/d.css'), 'd.css');
});

test('resolveHref resolves relative links', () => {
  assert.equal(resolveHref('pages', '../style.css'), 'style.css');
  assert.equal(resolveHref('', 'style.css'), 'style.css');
  assert.equal(resolveHref('a/b', '../../x.css'), 'x.css');
  assert.equal(resolveHref('pages', 'https://x/y.css'), 'https://x/y.css');
  assert.equal(resolveHref('pages', 'style.css?v=1#a'), 'pages/style.css');
});
