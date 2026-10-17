const V3_DIRECTIVE = /@tailwind\s+(?:base|components|utilities)\s*;?/g;
const V4_IMPORT = /@import\s+["']tailwindcss["']/;

export function upgradeInputCss(text: string): string {
  const stripped = text.replace(/^\uFEFF/, '');
  const withoutDirectives = stripped.replace(V3_DIRECTIVE, '');
  const collapsed = withoutDirectives.replace(/\n{3,}/g, '\n\n').trim();
  const withImport = V4_IMPORT.test(collapsed) ? collapsed : '@import "tailwindcss";\n' + collapsed;
  return withImport.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function extractThemeExtend(configText: string): string | undefined {
  const extend = bodyAfterKey(configText, 'extend');
  if (extend && extend.trim()) {
    return extend.trim();
  }
  const theme = bodyAfterKey(configText, 'theme');
  if (!theme) {
    return undefined;
  }
  const inner = bodyAfterKey(theme, 'extend');
  if (inner && inner.trim()) {
    return inner.trim();
  }
  return theme.trim() || undefined;
}

function matchBraces(text: string, openIndex: number): string | undefined {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(openIndex + 1, i);
      }
    }
  }
  return undefined;
}

function bodyAfterKey(text: string, key: string): string | undefined {
  const re = new RegExp(key + '\\s*:\\s*\\{');
  const m = re.exec(text);
  if (!m) {
    return undefined;
  }
  const open = m.index + m[0].length - 1;
  return matchBraces(text, open);
}

export function buildUpgradeNotes(configText?: string): string[] {
  const notes: string[] = [];
  notes.push('تم تحويل توجيهات @tailwind إلى @import "tailwindcss"; في input.css.');
  if (configText && /theme\s*:/.test(configText)) {
    notes.push('نُسخ كتلة theme من tailwind.config.js إلى تعليق في input.css — راجعها وحوّل القيم إلى متغيرات @theme في v4.');
  }
  if (configText && /plugins\s*:/.test(configText)) {
    notes.push('الإضافات (plugins) في tailwind.config.js تحتاج تحويلًا يدويًا في v4.');
  }
  notes.push('بعد المراجعة يمكنك حذف tailwind.config.js — لم يعد مطلوبًا في v4.');
  return notes;
}

export function themeComment(extendBody: string | undefined): string {
  if (!extendBody) {
    return '';
  }
  const lines = extendBody.split('\n').map((ln) => ' * ' + ln);
  return '/* tailwind-starter: theme من v3 (تحويل يدوي إلى @theme مطلوب)\n' + lines.join('\n') + '\n */\n';
}
