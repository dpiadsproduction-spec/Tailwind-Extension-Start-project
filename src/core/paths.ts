export function toPosix(p: string): string {
  return String(p).replace(/\\/g, '/');
}

export function sanitizeRelPath(p: string): string {
  const normalized = toPosix(p).trim();
  const parts = normalized.split('/').filter((s) => s !== '' && s !== '.' && s !== '..');
  return parts.join('/');
}

export function dirOf(rel: string): string {
  const parts = sanitizeRelPath(rel).split('/');
  parts.pop();
  return parts.join('/');
}

export function baseName(rel: string): string {
  return sanitizeRelPath(rel).split('/').pop() || '';
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function relativeHref(fromFile: string, toFile: string): string {
  const fromDir = dirOf(fromFile);
  const fromParts = fromDir ? fromDir.split('/') : [];
  const toParts = sanitizeRelPath(toFile).split('/');
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }
  const up = fromParts.length - i;
  const down = toParts.slice(i);
  return '../'.repeat(up) + down.join('/');
}

export function resolveHref(fromDir: string, href: string): string {
  const clean = href.split('?')[0].split('#')[0].trim();
  if (!clean || clean.indexOf('://') !== -1 || clean.indexOf('data:') === 0 || clean.charAt(0) === '/') {
    return clean;
  }
  const out: string[] = [];
  const segs = (fromDir ? sanitizeRelPath(fromDir).split('/') : []).concat(clean.split('/'));
  for (const s of segs) {
    if (s === '' || s === '.') {
      continue;
    }
    if (s === '..') {
      out.pop();
      continue;
    }
    out.push(s);
  }
  return out.join('/');
}
