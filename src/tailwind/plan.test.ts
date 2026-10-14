import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, planOutputs, isGeneratedCss, isPlanInput, DEFAULT_TARGET } from './plan';

test('buildPlan always includes the default target first', () => {
  const plan = buildPlan([]);
  assert.deepEqual(plan, [{ input: 'input.css', output: 'style.css' }]);
});

test('buildPlan appends and sanitizes extra targets', () => {
  const plan = buildPlan([{ input: 'pages//about.css', output: 'pages/about.compiled.css' }]);
  assert.equal(plan.length, 2);
  assert.deepEqual(plan[1], { input: 'pages/about.css', output: 'pages/about.compiled.css' });
});

test('buildPlan skips duplicates, self-targets, and invalid entries', () => {
  const plan = buildPlan([
    { input: 'input.css', output: 'other.css' },
    { input: 'same.css', output: 'same.css' },
    { input: '', output: 'x.css' },
    { input: 'a.css', output: 'b.css' }
  ]);
  assert.equal(plan.length, 2);
  assert.equal(plan[1].input, 'a.css');
});

test('planOutputs includes defaults and target outputs without duplicates', () => {
  const plan = buildPlan([{ input: 'a.css', output: 'a.compiled.css' }]);
  const outs = planOutputs(plan);
  assert.ok(outs.indexOf('style.css') !== -1);
  assert.ok(outs.indexOf('output.css') !== -1);
  assert.ok(outs.indexOf('a.compiled.css') !== -1);
});

test('isGeneratedCss and isPlanInput', () => {
  const plan = buildPlan([{ input: 'a.css', output: 'a.compiled.css' }]);
  assert.equal(isGeneratedCss('STYLE.CSS', plan), true);
  assert.equal(isGeneratedCss('a.compiled.css', plan), true);
  assert.equal(isGeneratedCss('a.css', plan), false);
  assert.equal(isPlanInput('input.css', plan), true);
  assert.equal(isPlanInput('a.css', plan), true);
  assert.equal(isPlanInput('b.css', plan), false);
});

test('DEFAULT_TARGET constant', () => {
  assert.deepEqual(DEFAULT_TARGET, { input: 'input.css', output: 'style.css' });
});
