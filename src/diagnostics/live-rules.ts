export type LiveIssueCode =
  | 'apply-page-scoped'
  | 'apply-needs-reference'
  | 'directive-v3-in-v4'
  | 'directive-v4-in-v3';

export interface LiveContext {
  major: 3 | 4;
  inSharedBundle: boolean;
  isPageScoped: boolean;
}

export interface LiveIssue {
  code: LiveIssueCode;
  message: string;
  line: number;
  severity: 'error' | 'warning';
}

const APPLY_RE = /@apply\b/;
const TAILWIND_DIRECTIVE_RE = /@tailwind\s+(?:base|components|utilities)\b/;
const V4_IMPORT_RE = /@import\s+["']tailwindcss["']/;
const REFERENCE_RE = /@reference\b/;

function lineOf(text: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}

export function analyzeCss(text: string, ctx: LiveContext): LiveIssue[] {
  const issues: LiveIssue[] = [];

  const apply = APPLY_RE.exec(text);
  if (apply) {
    if (ctx.isPageScoped) {
      issues.push({
        code: 'apply-page-scoped',
        line: lineOf(text, apply.index),
        severity: 'warning',
        message: 'هذا الملف page-scoped ولا يمر عبر البناء — @apply لن يُترجم. اربطه بالبناء أو استبدله بـCSS عادي.'
      });
    } else if (ctx.major === 4 && !ctx.inSharedBundle && !REFERENCE_RE.test(text)) {
      issues.push({
        code: 'apply-needs-reference',
        line: lineOf(text, apply.index),
        severity: 'warning',
        message: 'في Tailwind v4 يتطلب @apply خارج حزمة البناء إضافة @reference "tailwindcss".'
      });
    }
  }

  const directive = TAILWIND_DIRECTIVE_RE.exec(text);
  if (directive && ctx.major === 4) {
    issues.push({
      code: 'directive-v3-in-v4',
      line: lineOf(text, directive.index),
      severity: 'error',
      message: 'مشروع Tailwind v4 لا يستخدم @tailwind — استخدم بدلاً منها @import "tailwindcss";'
    });
  }

  const v4Import = V4_IMPORT_RE.exec(text);
  if (v4Import && ctx.major === 3) {
    issues.push({
      code: 'directive-v4-in-v3',
      line: lineOf(text, v4Import.index),
      severity: 'error',
      message: 'مشروع Tailwind v3 لا يستخدم @import "tailwindcss" — استخدم @tailwind base; @tailwind components; @tailwind utilities;'
    });
  }

  return issues;
}

export function needsReference(text: string): boolean {
  return APPLY_RE.test(text) && !REFERENCE_RE.test(text);
}

export function addReference(text: string): string {
  if (REFERENCE_RE.test(text)) {
    return text;
  }
  return '@reference "tailwindcss";\n' + text;
}

export function convertToV4Entry(text: string): string {
  const lines = text.split('\n');
  const kept = lines.filter((ln) => !TAILWIND_DIRECTIVE_RE.test(ln));
  if (V4_IMPORT_RE.test(kept.join('\n'))) {
    return kept.join('\n');
  }
  return '@import "tailwindcss";\n' + kept.join('\n');
}

export function convertToV3Entry(text: string): string {
  if (!V4_IMPORT_RE.test(text)) {
    return text;
  }
  return text.replace(
    V4_IMPORT_RE,
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;'
  );
}
