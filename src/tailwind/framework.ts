export type FrameworkId =
  | 'next'
  | 'nuxt'
  | 'angular'
  | 'vue'
  | 'svelte'
  | 'astro'
  | 'vite'
  | 'cra'
  | 'generic';

export interface PackageLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function detectFramework(pkg: PackageLike): FrameworkId {
  const deps: Record<string, string> = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const has = (name: string) => Object.prototype.hasOwnProperty.call(deps, name);
  if (has('next')) {
    return 'next';
  }
  if (has('nuxt') || has('nuxt3')) {
    return 'nuxt';
  }
  if (has('@angular/core')) {
    return 'angular';
  }
  if (has('astro')) {
    return 'astro';
  }
  if (has('@sveltejs/kit') || has('svelte')) {
    return 'svelte';
  }
  if (has('vue')) {
    return 'vue';
  }
  if (has('react-scripts')) {
    return 'cra';
  }
  if (has('vite')) {
    return 'vite';
  }
  return 'generic';
}

export function contentGlobs(fw: FrameworkId): string[] {
  switch (fw) {
    case 'next':
      return [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}'
      ];
    case 'nuxt':
      return ['./components/**/*.{vue,js,ts}', './layouts/**/*.vue', './pages/**/*.vue', './app.vue'];
    case 'angular':
      return ['./src/**/*.{html,ts}'];
    case 'vue':
      return ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'];
    case 'svelte':
      return ['./src/**/*.{html,js,svelte,ts}'];
    case 'astro':
      return ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'];
    case 'cra':
      return ['./public/index.html', './src/**/*.{js,jsx,ts,tsx}'];
    case 'vite':
      return ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue,svelte}'];
    default:
      return ['./**/*.{html,js,ts,jsx,tsx}', '!./node_modules/**/*'];
  }
}
