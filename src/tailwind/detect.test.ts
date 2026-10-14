import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMajor, isTailwindProject } from './detect';

test('v4 cli presence wins', () => {
  assert.equal(detectMajor({ hasV4Cli: true, tailwindMajor: 3, cssText: '@tailwind base;' }), 4);
});

test('tailwind major is used when v4 cli absent', () => {
  assert.equal(detectMajor({ hasV4Cli: false, tailwindMajor: 3 }), 3);
  assert.equal(detectMajor({ hasV4Cli: false, tailwindMajor: 4 }), 4);
});

test('css content detection when package unknown', () => {
  assert.equal(detectMajor({ hasV4Cli: false, cssText: '@import "tailwindcss";' }), 4);
  assert.equal(detectMajor({ hasV4Cli: false, cssText: '@tailwind base;\n@tailwind utilities;' }), 3);
});

test('fallback is used when nothing detected', () => {
  assert.equal(detectMajor({ hasV4Cli: false, fallback: 3 }), 3);
  assert.equal(detectMajor({ hasV4Cli: false }), 4);
});

test('isTailwindProject flags', () => {
  assert.equal(isTailwindProject({ hasConfig: true, hasInput: false }), true);
  assert.equal(isTailwindProject({ hasConfig: false, hasInput: true }), true);
  assert.equal(isTailwindProject({ hasConfig: false, hasInput: false }), false);
});
