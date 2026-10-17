import * as vscode from 'vscode';
import { CleanEntry } from '../explorer/entry';
import { relOf } from '../explorer/rels';
import { sanitizeRelPath, relativeHref, dirOf } from '../core/paths';
import { createFileIfMissing } from '../core/fs-util';
import { PAGE_TEMPLATES, composePage, type PageTemplate } from '../tailwind/pages-library';
import { ownInputCssTemplate, tailwindPageCssTemplate, plainPageCssTemplate, pageJsTemplate } from '../tailwind/templates';
import { ensureInputCss, ensurePageImport, removePageImport } from '../tailwind/imports-vscode';
import { createAdapter } from '../tailwind/adapter';
import { detectProjectMajor } from '../tailwind/detect-vscode';
import { addTargetSetting } from './project-files';
import { ensureTailwindInstalled } from './install';
import { buildNow } from '../tailwind/build';
import { pickRootRemembering, folderUri } from '../workspace/workspace';

export const CREATE_PAGE_COMMAND = 'tailwind-starter.createPage';

interface TemplatePick extends vscode.QuickPickItem {
  template: PageTemplate;
}

type CssMode = 'plain' | 'tailwind' | 'own';

interface CssKindPick extends vscode.QuickPickItem {
  value: CssMode;
}

function resolveContextDir(rootUri: vscode.Uri, node?: CleanEntry): { dirRel: string } {
  if (node) {
    const dirUri = node.isDir ? node.uri : node.parentDir;
    const rel = relOf(rootUri, dirUri);
    if (rel !== undefined) {
      return { dirRel: rel };
    }
  }
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme === 'file') {
    const rel = relOf(rootUri, editor.document.uri);
    if (rel !== undefined) {
      return { dirRel: dirOf(rel) };
    }
  }
  return { dirRel: '' };
}

async function pickTemplate(title: string): Promise<PageTemplate | undefined> {
  const items: TemplatePick[] = PAGE_TEMPLATES.map((template) => ({
    label: template.label,
    description: template.description,
    template
  }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'اختر قالب الصفحة (' + title + ')' });
  return picked ? picked.template : undefined;
}

async function pickCssMode(): Promise<CssMode | undefined> {
  const items: CssKindPick[] = [
    {
      label: 'CSS عادي',
      description: 'يُربط مباشرة في الصفحة',
      detail: 'لتنسيقات مخصصة خالصة بدون @apply — يعمل فورا بدون بناء',
      value: 'plain'
    },
    {
      label: 'CSS بقدرات Tailwind',
      description: 'يدعم @apply — يُدمج في البناء تلقائيا',
      detail: 'يُستورد في input.css ويُترجم داخل style.css المشترك',
      value: 'tailwind'
    },
    {
      label: 'مخرج مستقل',
      description: 'ملف CSS خاص يُبنى لوحده',
      detail: 'يُترجم إلى ملف .compiled.css خاص بالصفحة وتُربط به مباشرة',
      value: 'own'
    }
  ];
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'نوع ملف CSS الخاص بالصفحة' });
  return picked ? picked.value : undefined;
}

export async function runCreatePage(context: vscode.ExtensionContext, node?: CleanEntry): Promise<void> {
  const root = await pickRootRemembering(context, node ? node.uri : undefined, 'اختر مشروع إنشاء الصفحة');
  if (!root) {
    return;
  }
  const rootUri = folderUri(root);
  const ctx = resolveContextDir(rootUri, node);

  const pageInput = await vscode.window.showInputBox({
    prompt: 'مسار صفحة HTML' + (ctx.dirRel ? ' (المجلد الحالي: ' + ctx.dirRel + ')' : '') + ' — مثال: assets/Pages/contact.html',
    value: ctx.dirRel ? ctx.dirRel + '/' : '',
    placeHolder: 'assets/Pages/contact.html',
    validateInput: (v) => (sanitizeRelPath(v) ? undefined : 'اكتب مسارا صحيحا')
  });
  if (!pageInput) {
    return;
  }
  let pageRel = sanitizeRelPath(pageInput);
  if (!pageRel.toLowerCase().endsWith('.html')) {
    pageRel += '.html';
  }

  const pageParts = pageRel.split('/');
  const pageFile = pageParts.pop() as string;
  const pageDir = pageParts.join('/');
  const baseName = pageFile.replace(/\.html$/i, '');
  const defaultCss = (pageDir ? pageDir + '/' : '') + baseName + '.css';

  const cssInput = await vscode.window.showInputBox({
    prompt: 'مسار ملف CSS الخاص بالصفحة',
    value: defaultCss,
    validateInput: (v) => (sanitizeRelPath(v) ? undefined : 'اكتب مسارا صحيحا')
  });
  if (cssInput === undefined) {
    return;
  }
  const cssRel = sanitizeRelPath(cssInput);
  if (!cssRel) {
    vscode.window.showErrorMessage('تم الإلغاء: مسار CSS فارغ.');
    return;
  }

  const cssMode = await pickCssMode();
  if (!cssMode) {
    return;
  }

  const template = await pickTemplate(baseName);
  if (!template) {
    return;
  }

  const jsInput = await vscode.window.showInputBox({
    prompt: 'مسار ملف JS للصفحة (اتركه فارغاً لتخطي)',
    placeHolder: (pageDir ? pageDir + '/' : '') + baseName + '.js'
  });
  let jsRel: string | undefined;
  if (jsInput) {
    const cleanJs = sanitizeRelPath(jsInput);
    if (cleanJs) {
      jsRel = cleanJs;
    }
  }

  if (await fileExists(rootUri, pageRel)) {
    vscode.window.showErrorMessage('الصفحة موجودة مسبقا: ' + pageRel);
    return;
  }

  const major = await detectProjectMajor(rootUri);
  const adapter = createAdapter(major);
  if (!(await ensureTailwindInstalled(rootUri, major))) {
    vscode.window.showErrorMessage('فشل تثبيت Tailwind. تحقق من الاتصال بالإنترنت.');
    return;
  }

  const safeBase = baseName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  let sharedHref: string;
  let extraHref: string | undefined;
  if (cssMode === 'own') {
    const outRel = cssRel.replace(/\.css$/i, '') + '.compiled.css';
    await createFileIfMissing(rootUri, cssRel, ownInputCssTemplate(safeBase, adapter.entryDirectives()));
    await removePageImport(rootUri, cssRel);
    await addTargetSetting(rootUri, cssRel, outRel);
    sharedHref = relativeHref(pageRel, outRel);
    extraHref = undefined;
  } else if (cssMode === 'tailwind') {
    await ensureInputCss(rootUri);
    await ensurePageImport(rootUri, cssRel);
    await createFileIfMissing(rootUri, cssRel, tailwindPageCssTemplate(safeBase));
    sharedHref = relativeHref(pageRel, 'style.css');
    extraHref = undefined;
  } else {
    await createFileIfMissing(rootUri, cssRel, plainPageCssTemplate(safeBase));
    sharedHref = relativeHref(pageRel, 'style.css');
    extraHref = relativeHref(pageRel, cssRel);
  }

  let scriptHref: string | undefined;
  if (jsRel) {
    await createFileIfMissing(rootUri, jsRel, pageJsTemplate(safeBase));
    scriptHref = relativeHref(pageRel, jsRel);
  }

  const html = composePage({
    template,
    title: baseName,
    lang: 'en',
    bodyClass: 'bg-gray-100',
    sharedHref,
    extraHref,
    scriptHref
  });
  await createFileIfMissing(rootUri, pageRel, html);
  await buildNow(rootUri);

  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(rootUri, ...pageRel.split('/')));
    await vscode.window.showTextDocument(doc);
  } catch {
    /* ignore */
  }
  vscode.window.showInformationMessage('تم إنشاء الصفحة: ' + pageRel);
}

async function fileExists(rootUri: vscode.Uri, rel: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(rootUri, ...sanitizeRelPath(rel).split('/')));
    return true;
  } catch {
    return false;
  }
}
