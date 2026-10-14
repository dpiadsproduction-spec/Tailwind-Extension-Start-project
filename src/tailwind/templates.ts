import { MANAGED_MARK, PAGE_SCOPED_MARK } from './imports';
import { baseName } from '../core/paths';
import { contentGlobs, type FrameworkId } from './framework';

export function inputCssTemplate(directives: string): string {
  return '/* ' + MANAGED_MARK + ' */\n\n' + directives;
}

export function configTemplate(globs: string[]): string {
  const list = globs.map((g) => '"' + g + '"').join(', ');
  return (
    "/** @type {import('tailwindcss').Config} */\n" +
    'module.exports = {\n' +
    '  content: [' +
    list +
    '],\n' +
    '  theme: {\n' +
    '    extend: {},\n' +
    '  },\n' +
    '  plugins: [],\n' +
    '}\n'
  );
}

export function defaultHtml(cssHref: string): string {
  return (
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>Tailwind Project</title>\n' +
    '  <link rel="stylesheet" href="' +
    cssHref +
    '">\n</head>\n' +
    '<body class="bg-gray-100">\n  <h1 class="text-3xl font-bold text-blue-600 p-8">Hello Tailwind!</h1>\n</body>\n</html>\n'
  );
}

export function defaultFileContent(relPath: string, cssHref: string, directives: string, framework: FrameworkId): string {
  const base = baseName(relPath);
  if (base === 'input.css') {
    return directives;
  }
  if (base === 'tailwind.config.js') {
    return configTemplate(contentGlobs(framework));
  }
  if (base.toLowerCase().endsWith('.html')) {
    return defaultHtml(cssHref);
  }
  if (base.toLowerCase().endsWith('.css')) {
    return '/* ' + base + ' */\n';
  }
  if (base.toLowerCase().endsWith('.js')) {
    return '// ' + base + '\n';
  }
  return '';
}

export function scopedCssTemplate(base: string): string {
  return '/* Custom styles — ' + PAGE_SCOPED_MARK + ' (linked only from its page) */\n.' + base + '-wrap {\n  padding: 1rem;\n}\n';
}

export function plainPageCssTemplate(base: string): string {
  return '/* Custom styles for ' + base + ' */\n/* ' + PAGE_SCOPED_MARK + ' — linked only from its page */\n.' + base + '-wrap {\n  padding: 1rem;\n}\n';
}

export function tailwindPageCssTemplate(base: string): string {
  return '/* Custom styles for ' + base + ' (Tailwind-powered: supports @apply) */\n.' + base + '-wrap {\n  @apply p-4;\n}\n';
}

export function ownInputCssTemplate(base: string, directives: string): string {
  return '/* Standalone Tailwind input for ' + base + ' (compiled to its own output) */\n' + directives + '\n.' + base + '-wrap {\n  @apply p-4;\n}\n';
}

export function pageJsTemplate(base: string): string {
  return (
    '// ' + base + ' page script — linked only from its HTML page\n' +
    "document.addEventListener('DOMContentLoaded', () => {\n  // TODO: page logic here\n});\n"
  );
}

export function pageHtmlTemplate(title: string, sharedHref: string, extraHref?: string, scriptHref?: string): string {
  const extra = extraHref ? '\n  <link rel="stylesheet" href="' + extraHref + '">' : '';
  const script = scriptHref ? '\n  <script src="' + scriptHref + '" defer></script>' : '';
  return (
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>' +
    title +
    '</title>\n  <link rel="stylesheet" href="' +
    sharedHref +
    '">' +
    extra +
    '\n</head>\n' +
    '<body class="bg-gray-100">\n  <h1 class="text-3xl font-bold p-8">' +
    title +
    '</h1>' +
    script +
    '\n</body>\n</html>\n'
  );
}
