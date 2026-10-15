import * as vscode from 'vscode';
import { state } from '../core/state';
import { readTextFile } from '../core/fs-util';
import { sanitizeRelPath } from '../core/paths';
import { createAdapter } from '../tailwind/adapter';
import type { TailwindAdapter } from '../tailwind/adapter';
import {
  defaultFileContent,
  inputCssTemplate,
  configTemplate,
  defaultHtml,
  tailwindPageCssTemplate
} from '../tailwind/templates';
import { detectFramework, contentGlobs, type PackageLike } from '../tailwind/framework';
import { ensurePageImport } from '../tailwind/imports-vscode';
import { isGeneratedCss, isPlanInput } from '../tailwind/plan';
import { currentPlan } from '../tailwind/targets';
import { buildNow } from '../tailwind/build';
import { ensurePackageJson, ensureVscodeSettings } from './project-files';
import { ensureTailwindInstalled } from './install';

export interface CustomItem {
  type: 'file' | 'folder';
  path: string;
}

export interface CreateData {
  major: 3 | 4;
  quickSrc: boolean;
  quickCss: boolean;
  quickHtml: boolean;
  quickConfig: boolean;
  installTailwind: boolean;
  startWatch: boolean;
  items: CustomItem[];
}

function cssHrefForDir(dir: string): string {
  if (!dir) {
    return 'style.css';
  }
  return '../'.repeat(dir.split('/').length) + 'style.css';
}

async function readPackageLike(rootUri: vscode.Uri): Promise<PackageLike> {
  const text = await readTextFile(rootUri, 'package.json');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as PackageLike;
  } catch {
    return {};
  }
}

async function createCustomItems(
  rootUri: vscode.Uri,
  items: CustomItem[],
  adapter: TailwindAdapter,
  framework: ReturnType<typeof detectFramework>
): Promise<void> {
  for (const item of items) {
    const clean = sanitizeRelPath(item.path);
    if (!clean) {
      continue;
    }
    const parts = clean.split('/');
    if (item.type === 'folder') {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, ...parts));
      continue;
    }
    const name = parts.pop() as string;
    let dirUri = rootUri;
    if (parts.length > 0) {
      dirUri = vscode.Uri.joinPath(rootUri, ...parts);
      await vscode.workspace.fs.createDirectory(dirUri);
    }
    const fileUri = vscode.Uri.joinPath(dirUri, name);
    try {
      await vscode.workspace.fs.stat(fileUri);
      continue;
    } catch {
      /* not found, create it */
    }
    const cssHref = cssHrefForDir(parts.join('/'));
    const content = defaultFileContent(clean, cssHref, adapter.entryDirectives(), framework);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
  }
}

async function wireScaffoldedCss(rootUri: vscode.Uri, items: CustomItem[] | undefined): Promise<void> {
  if (!items || items.length === 0) {
    return;
  }
  const plan = currentPlan();
  const toImport: string[] = [];
  for (const item of items) {
    if (!item || item.type !== 'file') {
      continue;
    }
    const clean = sanitizeRelPath(item.path);
    if (!clean || !clean.toLowerCase().endsWith('.css')) {
      continue;
    }
    if (isPlanInput(clean, plan) || isGeneratedCss(clean, plan)) {
      continue;
    }
    const uri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
    let text = '';
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    } catch {
      continue;
    }
    const base = clean.split('/').pop() as string;
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === '/* ' + base + ' */') {
      const safeBase = base.replace(/\.css$/i, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      text = tailwindPageCssTemplate(safeBase);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
    }
    if (/@(apply|tailwind|screen)\b/.test(text)) {
      toImport.push(clean);
    }
  }
  for (const rel of toImport) {
    await ensurePageImport(rootUri, rel);
  }
}

export async function scaffoldProject(rootUri: vscode.Uri, data: CreateData): Promise<void> {
  state.scaffolding = true;
  const adapter = createAdapter(data.major);
  const framework = detectFramework(await readPackageLike(rootUri));
  const globs = contentGlobs(framework);
  try {
    if (data.quickSrc) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, 'src'));
    }

    await ensurePackageJson(rootUri, adapter);
    await ensureVscodeSettings(rootUri);

    if (data.quickCss) {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(rootUri, 'input.css'),
        Buffer.from(inputCssTemplate(adapter.entryDirectives()), 'utf8')
      );
    }
    if (data.quickConfig && adapter.usesJsConfig()) {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(rootUri, 'tailwind.config.js'),
        Buffer.from(configTemplate(globs), 'utf8')
      );
    }
    if (data.quickHtml) {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(rootUri, 'index.html'),
        Buffer.from(defaultHtml('style.css'), 'utf8')
      );
    }

    if (data.items && data.items.length > 0) {
      await createCustomItems(rootUri, data.items, adapter, framework);
      await wireScaffoldedCss(rootUri, data.items);
    }

    if (data.installTailwind) {
      const ok = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind CSS...', cancellable: false },
        async () => ensureTailwindInstalled(rootUri, data.major)
      );
      if (!ok) {
        vscode.window.showErrorMessage('فشل تثبيت Tailwind. تحقق من الاتصال بالإنترنت ومن سجل npm.');
        return;
      }
    }

    if (data.startWatch) {
      const hasInput = await vscode.workspace.fs
        .stat(vscode.Uri.joinPath(rootUri, 'input.css'))
        .then(() => true, () => false);
      if (!hasInput) {
        vscode.window.showWarningMessage('لا يوجد input.css — تم تخطي البناء.');
      } else {
        await buildNow(rootUri);
      }
    }

    vscode.window.showInformationMessage('تم إنشاء المشروع بنجاح!');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage('خطأ أثناء إنشاء المشروع: ' + msg);
  } finally {
    state.scaffolding = false;
  }
}
