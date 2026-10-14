export const MANAGED_MARK = 'tailwind-starter: managed imports';
export const PAGE_SCOPED_MARK = 'tailwind-starter: page-scoped';

export function importLine(cssRel: string): string {
  return '@import "./' + cssRel + '";';
}

export function hasManagedImport(inputCss: string, cssRel: string): boolean {
  return inputCss.indexOf(importLine(cssRel)) !== -1;
}

export function hasPageScopedMark(text: string): boolean {
  return text.indexOf(PAGE_SCOPED_MARK) !== -1;
}

export function isTailwindPowered(text: string): boolean {
  return /@(apply|tailwind|screen)\b/.test(text);
}

export function isV4Entry(text: string): boolean {
  return /@import\s+["']tailwindcss["']/.test(text);
}

export function addManagedImport(inputCss: string, cssRel: string): string {
  const line = importLine(cssRel);
  if (inputCss.indexOf(line) !== -1) {
    return inputCss;
  }
  if (inputCss.indexOf(MANAGED_MARK) !== -1) {
    return inputCss.replace(MANAGED_MARK, MANAGED_MARK + '\n' + line);
  }
  return '/* ' + MANAGED_MARK + ' */\n' + line + '\n\n' + inputCss;
}

export function removeManagedImport(inputCss: string, cssRel: string): string {
  const line = importLine(cssRel);
  if (inputCss.indexOf(line) === -1) {
    return inputCss;
  }
  return inputCss
    .split('\n')
    .filter((ln) => ln.trim() !== line)
    .join('\n');
}

export function removeImportsUnder(inputCss: string, dirRel: string): string {
  const prefix = '@import "./' + dirRel + '/';
  const exact = '@import "./' + dirRel + '";';
  return inputCss
    .split('\n')
    .filter((ln) => {
      const t = ln.trim();
      return t !== exact && t.indexOf(prefix) !== 0;
    })
    .join('\n');
}
