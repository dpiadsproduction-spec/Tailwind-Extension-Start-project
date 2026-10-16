import type { CreateData, CustomItem } from '../commands/scaffold';

function asBoolean(value: unknown): boolean {
  return value === true;
}

export function parseItems(raw: unknown): CustomItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: CustomItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const type = rec.type === 'folder' ? 'folder' : rec.type === 'file' ? 'file' : undefined;
    const path = typeof rec.path === 'string' ? rec.path : undefined;
    if (type === undefined || path === undefined) {
      continue;
    }
    items.push({ type, path });
  }
  return items;
}

export function parseCreateData(raw: unknown): CreateData | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const rec = raw as Record<string, unknown>;
  return {
    major: rec.major === 3 ? 3 : 4,
    quickSrc: asBoolean(rec.quickSrc),
    quickCss: asBoolean(rec.quickCss),
    quickHtml: asBoolean(rec.quickHtml),
    quickConfig: asBoolean(rec.quickConfig),
    installTailwind: asBoolean(rec.installTailwind),
    startWatch: asBoolean(rec.startWatch),
    items: parseItems(rec.items)
  };
}
