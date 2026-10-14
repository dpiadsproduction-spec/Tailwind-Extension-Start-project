import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFramework, contentGlobs } from './framework';

test('detectFramework identifies frameworks by dependencies', () => {
  assert.equal(detectFramework({ dependencies: { next: '14' } }), 'next');
  assert.equal(detectFramework({ devDependencies: { nuxt: '3' } }), 'nuxt');
  assert.equal(detectFramework({ dependencies: { '@angular/core': '17' } }), 'angular');
  assert.equal(detectFramework({ dependencies: { astro: '4' } }), 'astro');
  assert.equal(detectFramework({ devDependencies: { '@sveltejs/kit': '2' } }), 'svelte');
  assert.equal(detectFramework({ dependencies: { vue: '3' } }), 'vue');
  assert.equal(detectFramework({ dependencies: { 'react-scripts': '5' } }), 'cra');
  assert.equal(detectFramework({ devDependencies: { vite: '5' } }), 'vite');
});

test('next takes priority over vue/vite', () => {
  assert.equal(detectFramework({ dependencies: { next: '14', vue: '3' }, devDependencies: { vite: '5' } }), 'next');
});

test('detectFramework falls back to generic', () => {
  assert.equal(detectFramework({}), 'generic');
  assert.equal(detectFramework({ dependencies: { lodash: '4' } }), 'generic');
});

test('contentGlobs generates sensible globs per framework', () => {
  assert.ok(contentGlobs('next').some((g) => g.indexOf('./app/') === 0));
  assert.ok(contentGlobs('angular').indexOf('./src/**/*.{html,ts}') !== -1);
  assert.deepEqual(contentGlobs('generic'), ['./**/*.{html,js,ts,jsx,tsx}', '!./node_modules/**/*']);
});
