import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCreateData, parseItems } from './parse';

test('parseCreateData defaults major to 4 and booleans to false', () => {
  const data = parseCreateData({});
  assert.ok(data);
  assert.equal(data!.major, 4);
  assert.equal(data!.quickSrc, false);
  assert.deepEqual(data!.items, []);
});

test('parseCreateData accepts major 3 and truthy flags', () => {
  const data = parseCreateData({ major: 3, quickSrc: true, installTailwind: true });
  assert.equal(data!.major, 3);
  assert.equal(data!.quickSrc, true);
  assert.equal(data!.installTailwind, true);
  assert.equal(data!.startWatch, false);
});

test('parseCreateData rejects non-objects', () => {
  assert.equal(parseCreateData(null), undefined);
  assert.equal(parseCreateData('x'), undefined);
  assert.equal(parseCreateData(undefined), undefined);
});

test('parseItems drops malformed entries', () => {
  const items = parseItems([
    { type: 'file', path: 'a.js' },
    { type: 'folder', path: 'dir' },
    { type: 'weird', path: 'x' },
    { type: 'file' },
    null,
    'nope'
  ]);
  assert.deepEqual(items, [
    { type: 'file', path: 'a.js' },
    { type: 'folder', path: 'dir' }
  ]);
});

test('parseItems returns empty array for non-arrays', () => {
  assert.deepEqual(parseItems('x'), []);
  assert.deepEqual(parseItems(undefined), []);
});
