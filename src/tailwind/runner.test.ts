import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCapture, runChecked } from './runner';

test('runCapture reports success for a zero-exit command', async () => {
  const r = await runCapture(process.execPath, ['-e', 'console.log("hi")'], { cwd: process.cwd() });
  assert.equal(r.ok, true);
  assert.ok(r.stdout.indexOf('hi') !== -1);
});

test('runCapture reports failure and captures stderr', async () => {
  const r = await runCapture(process.execPath, ['-e', 'console.error("bad"); process.exit(2)'], { cwd: process.cwd() });
  assert.equal(r.ok, false);
  assert.ok(r.stderr.indexOf('bad') !== -1);
  assert.ok(r.message.indexOf('exit code 2') !== -1);
});

test('runCapture does not invoke a shell', async () => {
  const r = await runCapture(process.execPath, ['-e', 'console.log(process.argv.length)'], { cwd: process.cwd() });
  assert.equal(r.ok, true);
});

test('runCapture handles spawn errors', async () => {
  const r = await runCapture('definitely-not-a-real-binary-xyz', [], { cwd: process.cwd() });
  assert.equal(r.ok, false);
  assert.ok(r.message.length > 0);
});

test('runChecked throws on failure and resolves on success', async () => {
  await assert.rejects(
    runChecked(process.execPath, ['-e', 'process.exit(1)'], { cwd: process.cwd() }),
    /exit code 1/
  );
  const out = await runChecked(process.execPath, ['-e', 'console.log("ok")'], { cwd: process.cwd() });
  assert.ok(out.indexOf('ok') !== -1);
});
