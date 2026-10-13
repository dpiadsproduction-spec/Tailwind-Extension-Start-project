import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err } from './result';

test('ok wraps value', () => {
  const r = ok(42);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value, 42);
  }
});

test('err wraps error', () => {
  const r = err('boom');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error, 'boom');
  }
});
