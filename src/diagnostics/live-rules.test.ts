import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCss,
  addReference,
  convertToV4Entry,
  convertToV3Entry,
  needsReference,
  type LiveContext
} from './live-rules';

function ctx(over: Partial<LiveContext> = {}): LiveContext {
  return { major: 3, inSharedBundle: false, isPageScoped: false, ...over };
}

test('@apply in a page-scoped file warns regardless of bundle status', () => {
  const issues = analyzeCss('.x {\n  @apply p-4;\n}\n', ctx({ isPageScoped: true, inSharedBundle: true }));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'apply-page-scoped');
  assert.equal(issues[0].line, 1);
});

test('@apply in v4 outside the shared bundle needs @reference', () => {
  const issues = analyzeCss('.x {\n  @apply p-4;\n}\n', ctx({ major: 4 }));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'apply-needs-reference');
});

test('@apply in v4 inside the shared bundle is fine', () => {
  assert.equal(analyzeCss('.x { @apply p-4; }', ctx({ major: 4, inSharedBundle: true })).length, 0);
});

test('@apply in v4 with @reference already present is fine', () => {
  assert.equal(analyzeCss('@reference "tailwindcss";\n.x { @apply p-4; }', ctx({ major: 4 })).length, 0);
});

test('@tailwind directives flagged in a v4 project only', () => {
  assert.equal(analyzeCss('@tailwind base;', ctx({ major: 4 }))[0].code, 'directive-v3-in-v4');
  assert.equal(analyzeCss('@tailwind base;', ctx({ major: 3 })).length, 0);
});

test('@import tailwindcss flagged in a v3 project only', () => {
  assert.equal(analyzeCss('@import "tailwindcss";', ctx({ major: 3 }))[0].code, 'directive-v4-in-v3');
  assert.equal(analyzeCss('@import "tailwindcss";', ctx({ major: 4 })).length, 0);
});

test('clean css yields no issues', () => {
  assert.equal(analyzeCss('.x { color: red; }', ctx()).length, 0);
});

test('needsReference and addReference are idempotent', () => {
  assert.equal(needsReference('.x { @apply p-4; }'), true);
  const once = addReference('.x { @apply p-4; }');
  assert.ok(once.indexOf('@reference "tailwindcss";') === 0);
  assert.equal(addReference(once), once);
});

test('convertToV4Entry replaces directives with the v4 import', () => {
  const out = convertToV4Entry('@tailwind base;\n@tailwind components;\n@tailwind utilities;\n.x{}\n');
  assert.ok(out.indexOf('@import "tailwindcss";') === 0);
  assert.equal(out.indexOf('@tailwind'), -1);
  assert.ok(out.indexOf('.x{}') !== -1);
});

test('convertToV3Entry replaces the v4 import with directives', () => {
  const out = convertToV3Entry('@import "tailwindcss";\n.x{}\n');
  assert.ok(out.indexOf('@tailwind base;') !== -1);
  assert.equal(out.indexOf('@import "tailwindcss"'), -1);
});
