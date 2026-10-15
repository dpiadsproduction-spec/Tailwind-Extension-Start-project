import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedName, skipTreePath, sortEntries, filterEntries, normalizeExcludeList, DEFAULT_EXCLUDE } from './exclude';

test('isExcludedName is case-insensitive', () => {
  const ex = normalizeExcludeList(DEFAULT_EXCLUDE);
  assert.equal(isExcludedName('node_modules', ex), true);
  assert.equal(isExcludedName('NODE_MODULES', ex), true);
  assert.equal(isExcludedName('src', ex), false);
});

test('DEFAULT_EXCLUDE hides the noisy entries', () => {
  const ex = normalizeExcludeList(DEFAULT_EXCLUDE);
  for (const n of ['node_modules', '.git', '.vscode', 'package-lock.json']) {
    assert.equal(isExcludedName(n, ex), true);
  }
});

test('skipTreePath detects node_modules and .git', () => {
  assert.equal(skipTreePath('/ws/app/node_modules/x/y'), true);
  assert.equal(skipTreePath('C:\\ws\\.git\\config'), true);
  assert.equal(skipTreePath('/ws/app/src/index.html'), false);
});

test('sortEntries puts folders first then alphabetical (case-insensitive)', () => {
  const sorted = sortEntries([
    { name: 'zeta.html', isDir: false },
    { name: 'Beta', isDir: true },
    { name: 'alpha', isDir: true },
    { name: 'Apple.js', isDir: false }
  ]);
  assert.deepEqual(
    sorted.map((s) => s.name),
    ['alpha', 'Beta', 'Apple.js', 'zeta.html']
  );
});

test('filterEntries removes excluded names', () => {
  const ex = normalizeExcludeList(DEFAULT_EXCLUDE);
  const out = filterEntries(
    [
      { name: 'node_modules', isDir: true },
      { name: 'src', isDir: true },
      { name: 'index.html', isDir: false }
    ],
    ex
  );
  assert.deepEqual(out.map((e) => e.name), ['src', 'index.html']);
});
