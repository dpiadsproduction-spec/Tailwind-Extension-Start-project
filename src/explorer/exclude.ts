export const DEFAULT_EXCLUDE = [
  'node_modules',
  '.git',
  '.vscode',
  'package-lock.json',
  '.DS_Store',
  'Thumbs.db'
];

export function normalizeExcludeList(list: string[]): string[] {
  return (list || []).map((s) => String(s).toLowerCase());
}

export function isExcludedName(name: string, exclude: string[]): boolean {
  return normalizeExcludeList(exclude).indexOf(name.toLowerCase()) !== -1;
}

export function skipTreePath(fsPath: string): boolean {
  return /[\\/]node_modules[\\/]|[\\/]\.git[\\/]/i.test(fsPath);
}

export interface TreeEntry {
  name: string;
  isDir: boolean;
}

export function sortEntries<T extends TreeEntry>(entries: T[]): T[] {
  return entries.slice().sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function filterEntries<T extends TreeEntry>(entries: T[], exclude: string[]): T[] {
  return entries.filter((e) => !isExcludedName(e.name, exclude));
}
