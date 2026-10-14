import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter } from './adapter';

test('createAdapter returns v3 adapter', () => {
  const a = createAdapter(3);
  assert.equal(a.major(), 3);
  assert.equal(a.cliPackage(), 'tailwindcss');
  assert.deepEqual(a.buildArgs('input.css', 'style.css'), ['tailwindcss', '-i', 'input.css', '-o', 'style.css']);
  assert.equal(a.usesJsConfig(), true);
  assert.equal(a.contentDetection(), 'config');
  assert.match(a.entryDirectives(), /@tailwind base;/);
});

test('createAdapter returns v4 adapter', () => {
  const a = createAdapter(4);
  assert.equal(a.major(), 4);
  assert.equal(a.cliPackage(), '@tailwindcss/cli');
  assert.deepEqual(a.buildArgs('a.css', 'b.css'), ['@tailwindcss/cli', '-i', 'a.css', '-o', 'b.css']);
  assert.equal(a.usesJsConfig(), false);
  assert.equal(a.contentDetection(), 'auto');
  assert.equal(a.entryDirectives(), '@import "tailwindcss";\n');
});

test('v3 never requests @reference', () => {
  assert.equal(createAdapter(3).detectApplyErrorNeedsReference('cannot apply unknown utility'), false);
});

test('v4 detects @apply reference errors', () => {
  const a = createAdapter(4);
  assert.equal(a.detectApplyErrorNeedsReference('Cannot apply unknown utility class `p-4`'), true);
  assert.equal(a.detectApplyErrorNeedsReference('@reference "../../app.css"'), true);
  assert.equal(a.detectApplyErrorNeedsReference('some unrelated failure'), false);
});
