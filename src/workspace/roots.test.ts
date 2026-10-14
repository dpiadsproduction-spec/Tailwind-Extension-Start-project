import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPathInside, matchRoot, normalizeFsPath, type RootInfo } from './roots';

test('normalizeFsPath lowercases and normalizes slashes', () => {
  assert.equal(normalizeFsPath('C:\\Work\\Proj\\'), 'c:/work/proj');
});

test('isPathInside respects segment boundaries', () => {
  assert.equal(isPathInside('/ws/app', '/ws/app/src/index.html'), true);
  assert.equal(isPathInside('/ws/app', '/ws/app'), true);
  assert.equal(isPathInside('/ws/app', '/ws/app2/index.html'), false);
  assert.equal(isPathInside('/ws/app', '/ws/other/index.html'), false);
  assert.equal(isPathInside('', '/ws/app/x'), false);
});

test('matchRoot picks the containing root (case-insensitive)', () => {
  const roots: RootInfo[] = [
    { name: 'a', fsPath: '/ws/app' },
    { name: 'b', fsPath: '/ws/lib' }
  ];
  assert.equal(matchRoot(roots, '/WS/APP/src/x.ts')?.name, 'a');
  assert.equal(matchRoot(roots, '/ws/lib/y.ts')?.name, 'b');
  assert.equal(matchRoot(roots, '/ws/else/z.ts'), undefined);
});

test('matchRoot prefers the most specific (longest) root', () => {
  const roots: RootInfo[] = [
    { name: 'outer', fsPath: '/ws' },
    { name: 'inner', fsPath: '/ws/app' }
  ];
  assert.equal(matchRoot(roots, '/ws/app/src/x.ts')?.name, 'inner');
  assert.equal(matchRoot(roots, '/ws/other/x.ts')?.name, 'outer');
});
