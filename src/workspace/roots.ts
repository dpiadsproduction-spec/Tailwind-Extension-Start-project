export interface RootInfo {
  name: string;
  fsPath: string;
}

export function normalizeFsPath(p: string): string {
  let out = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return out.toLowerCase();
}

export function isPathInside(rootFsPath: string, fileFsPath: string): boolean {
  const root = normalizeFsPath(rootFsPath);
  const file = normalizeFsPath(fileFsPath);
  if (!root) {
    return false;
  }
  if (file === root) {
    return true;
  }
  return file.indexOf(root + '/') === 0;
}

export function matchRoot(roots: RootInfo[], fileFsPath: string): RootInfo | undefined {
  let best: RootInfo | undefined;
  for (const root of roots) {
    if (isPathInside(root.fsPath, fileFsPath)) {
      if (!best || root.fsPath.length > best.fsPath.length) {
        best = root;
      }
    }
  }
  return best;
}
