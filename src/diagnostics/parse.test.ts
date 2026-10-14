import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuildError, cleanBuildMessage, collectWarnings } from './parse';

test('parseBuildError extracts relative css path and 0-based position', () => {
  const p = parseBuildError('some error\n./pages/about.css:12:5');
  assert.ok(p);
  assert.equal(p?.file, './pages/about.css');
  assert.equal(p?.line, 11);
  assert.equal(p?.col, 4);
});

test('parseBuildError extracts absolute path', () => {
  const p = parseBuildError('C:\\proj\\input.css:3:1 boom');
  assert.ok(p);
  assert.equal(p?.file, 'C:\\proj\\input.css');
  assert.equal(p?.line, 2);
});

test('parseBuildError returns undefined without a css location', () => {
  assert.equal(parseBuildError('nothing useful'), undefined);
});

test('cleanBuildMessage prefers reason text', () => {
  assert.equal(cleanBuildMessage("x\nreason: 'unknown utility'\n"), 'unknown utility');
});

test('cleanBuildMessage skips browserslist noise', () => {
  const msg = 'Browserslist: caniuse-lite is outdated\nactual problem here';
  assert.equal(cleanBuildMessage(msg), 'actual problem here');
});

test('collectWarnings extracts unique warnings up to limit', () => {
  const out = collectWarnings('warn - first issue\nwarn: second issue\nwarn - first issue\nall done');
  assert.deepEqual(out, ['first issue', 'second issue']);
  assert.equal(collectWarnings('warn a\nwarn b\nwarn c', 2).length, 2);
});
