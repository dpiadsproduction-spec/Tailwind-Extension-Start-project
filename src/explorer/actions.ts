import * as vscode from 'vscode';
import { CleanEntry, entryDisplayName } from './entry';
import { relOf } from './rels';
import { sanitizeRelPath, relativeHref } from '../core/paths';
import { fileExists } from '../core/fs-util';
import { scopedCssTemplate, pageJsTemplate } from '../tailwind/templates';
import {
  ensureInputCss,
  ensurePageImport,
  removePageImport,
  removeImportsUnderDir,
  isPageScoped
} from '../tailwind/imports-vscode';
import { scheduleBuild } from '../tailwind/build';
import { isGeneratedCss, isPlanInput } from '../tailwind/plan';
import { currentPlan } from '../tailwind/targets';

type CssMode = 'global' | 'scoped' | 'none';

export async function pickHtmlPage(_rootUri: vscode.Uri): Promise<string | undefined> {
  const files = await vscode.workspace.findFiles('**/*.html', '{**/node_modules/**,**/.git/**}');
  const rels: string[] = [];
  for (const f of files) {
    const rel = vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
    if (rel) {
      rels.push(rel);
    }
  }
  rels.sort();
  if (rels.length === 0) {
    vscode.window.showErrorMessage('لا توجد صفحات HTML — أنشئ صفحة أولا.');
    return undefined;
  }
  return vscode.window.showQuickPick(rels, { placeHolder: 'اختر صفحة HTML' });
}

export async function linkAssetToPage(
  rootUri: vscode.Uri,
  assetRel: string,
  pageRel: string,
  kind: 'css' | 'js'
): Promise<boolean> {
  const pageUri = vscode.Uri.joinPath(rootUri, ...pageRel.split('/'));
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(pageUri)).toString('utf8');
  } catch {
    vscode.window.showErrorMessage('تعذر قراءة الصفحة: ' + pageRel);
    return false;
  }
  const href = relativeHref(pageRel, assetRel);
  if (kind === 'css') {
    const inputText = (await fileExists(rootUri, 'input.css'))
      ? Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, 'input.css'))).toString('utf8')
      : '';
    if (inputText.indexOf('@import "./' + assetRel + '";') !== -1) {
      const go = await vscode.window.showWarningMessage(
        'هذا الملف عام (مستورد في البناء) — الربط المباشر سيكرر التنسيق. متابعة؟',
        'متابعة',
        'إلغاء'
      );
      if (go !== 'متابعة') {
        return false;
      }
    }
    if (text.indexOf(href) !== -1) {
      vscode.window.showInformationMessage('مربوط مسبقا في الصفحة.');
      return false;
    }
    if (!/<\/head\s*>/i.test(text)) {
      vscode.window.showErrorMessage('لا يوجد </head> في الصفحة.');
      return false;
    }
    text = text.replace(/<\/head\s*>/i, '  <link rel="stylesheet" href="' + href + '">\n</head>');
  } else {
    if (text.indexOf(href) !== -1) {
      vscode.window.showInformationMessage('مربوط مسبقا في الصفحة.');
      return false;
    }
    const tag = '\n  <script src="' + href + '" defer></script>';
    if (/<\/body\s*>/i.test(text)) {
      text = text.replace(/<\/body\s*>/i, tag + '\n</body>');
    } else if (/<\/html\s*>/i.test(text)) {
      text = text.replace(/<\/html\s*>/i, tag + '\n</html>');
    } else {
      vscode.window.showErrorMessage('تعذر إيجاد موضع الوسم في الصفحة.');
      return false;
    }
  }
  await vscode.workspace.fs.writeFile(pageUri, Buffer.from(text, 'utf8'));
  vscode.window.showInformationMessage('تم ربط ' + assetRel + ' في ' + pageRel);
  return true;
}

export async function unlinkAssetFromPage(
  rootUri: vscode.Uri,
  assetRel: string,
  pageRel: string
): Promise<boolean> {
  const pageUri = vscode.Uri.joinPath(rootUri, ...pageRel.split('/'));
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(pageUri)).toString('utf8');
  } catch {
    vscode.window.showErrorMessage('تعذر قراءة الصفحة: ' + pageRel);
    return false;
  }
  const href = relativeHref(pageRel, assetRel);
  const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = text;
  text = text.replace(new RegExp('\\s*<link\\b[^>]*href\\s*=\\s*["\']' + esc + '["\'][^>]*>', 'i'), '');
  text = text.replace(new RegExp('\\s*<script\\b[^>]*src\\s*=\\s*["\']' + esc + '["\'][^>]*>\\s*</script>', 'i'), '');
  if (text === before) {
    vscode.window.showInformationMessage('لا يوجد ربط مطابق لفكه.');
    return false;
  }
  await vscode.workspace.fs.writeFile(pageUri, Buffer.from(text, 'utf8'));
  if (assetRel.toLowerCase().endsWith('.css')) {
    await removePageImport(rootUri, assetRel);
  }
  vscode.window.showInformationMessage('تم فك ربط ' + assetRel + ' من ' + pageRel);
  return true;
}

export async function createExplorerEntry(node: CleanEntry | undefined, isFolder: boolean, rootUri: vscode.Uri): Promise<void> {
  const parent = node ? (node.isDir ? node.uri : node.parentDir) : rootUri;
  const input = await vscode.window.showInputBox({
    prompt: isFolder ? 'اسم المجلد (يدعم مسارات متداخلة مثل Pages/blog)' : 'اسم الملف (يدعم مسارات مثل Pages/about.html)',
    placeHolder: isFolder ? 'Pages/blog' : 'Pages/about.html',
    validateInput: (v) => (sanitizeRelPath(v) ? undefined : 'اكتب اسما صحيحا')
  });
  if (!input) {
    return;
  }
  const clean = sanitizeRelPath(input);
  const target = vscode.Uri.joinPath(parent, ...clean.split('/'));
  const lowerClean = clean.toLowerCase();
  const wantCss = lowerClean.endsWith('.css');
  const wantJs = lowerClean.endsWith('.js');
  let cssMode: CssMode = 'none';
  let linkPageRel: string | undefined;

  if (!isFolder && (wantCss || wantJs)) {
    interface AssetLinkPick extends vscode.QuickPickItem {
      value: string;
    }
    const picks: AssetLinkPick[] = wantCss
      ? [
          { label: 'عام (مشترك)', description: 'كلاساته لكل الصفحات', detail: '@apply فيه يُترجم في style.css المشترك', value: 'global' },
          { label: 'خاص بصفحة', description: 'يُربط في صفحة واحدة فقط', detail: 'لن يُستورد في البناء المشترك', value: 'scoped' },
          { label: 'بدون ربط', description: 'ملف فارغ للاستخدام لاحقا', value: 'none' }
        ]
      : [
          { label: 'ربط في صفحة', description: 'وسم script في صفحة تختارها', value: 'linked' },
          { label: 'بدون ربط', description: 'ملف فارغ للاستخدام لاحقا', value: 'none' }
        ];
    const choice = await vscode.window.showQuickPick(picks, {
      placeHolder: wantCss ? 'كيف يُستخدم ملف CSS؟' : 'هل تربط ملف JS في صفحة؟'
    });
    if (!choice) {
      return;
    }
    if (choice.value === 'scoped' || choice.value === 'linked') {
      const page = await pickHtmlPage(rootUri);
      if (!page) {
        return;
      }
      linkPageRel = page;
      cssMode = wantCss ? 'scoped' : 'none';
    } else if (wantCss && choice.value === 'global') {
      cssMode = 'global';
    }
  }

  try {
    if (isFolder) {
      await vscode.workspace.fs.createDirectory(target);
    } else {
      try {
        await vscode.workspace.fs.stat(target);
        vscode.window.showErrorMessage('موجود مسبقا: ' + clean);
        return;
      } catch {
        // not exists
      }
      const parts = clean.split('/');
      parts.pop();
      if (parts.length > 0) {
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(parent, ...parts));
      }
      const fileName = clean.split('/').pop() as string;
      const safeBase = fileName.replace(/\.(css|js)$/i, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      let starter = '';
      if (wantCss && cssMode === 'scoped') {
        starter = scopedCssTemplate(safeBase);
      } else if (wantCss && cssMode === 'global') {
        starter = '/* Shared stylesheet — @apply here is available on all pages */\n';
      } else if (wantJs && linkPageRel) {
        starter = pageJsTemplate(safeBase);
      }
      await vscode.workspace.fs.writeFile(target, Buffer.from(starter, 'utf8'));
      if (linkPageRel) {
        const assetRel = relOf(rootUri, target);
        if (assetRel) {
          await linkAssetToPage(rootUri, assetRel, linkPageRel, wantCss ? 'css' : 'js');
        }
      }
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
    }
    vscode.window.showInformationMessage(isFolder ? 'تم إنشاء المجلد: ' + clean : 'تم إنشاء الملف: ' + clean);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage('تعذر الإنشاء: ' + msg);
  }
}

export async function deleteExplorerEntries(nodes: CleanEntry[], rootUri: vscode.Uri): Promise<void> {
  if (!nodes || nodes.length === 0) {
    vscode.window.showErrorMessage('اختر ملفا أو مجلدا من Clean Workspace أولا.');
    return;
  }
  const title = nodes.length === 1 ? '"' + entryDisplayName(nodes[0]) + '"' : nodes.length + ' عناصر';
  const answer = await vscode.window.showWarningMessage('حذف ' + title + ' نهائيا؟', { modal: true }, 'حذف');
  if (answer !== 'حذف') {
    return;
  }
  let needsBuild = false;
  const plan = currentPlan();
  for (const node of nodes) {
    try {
      await vscode.workspace.fs.delete(node.uri, { recursive: true, useTrash: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage('تعذر حذف ' + entryDisplayName(node) + ': ' + msg);
      continue;
    }
    const rel = relOf(rootUri, node.uri);
    if (!rel) {
      continue;
    }
    if (node.isDir) {
      if (await removeImportsUnderDir(rootUri, rel)) {
        needsBuild = true;
      }
    } else if (rel.toLowerCase().endsWith('.css')) {
      if (isGeneratedCss(rel, plan)) {
        needsBuild = true;
      } else if (await removePageImport(rootUri, rel)) {
        needsBuild = true;
      }
    }
  }
  if (needsBuild) {
    scheduleBuild(rootUri);
  }
  vscode.window.showInformationMessage('تم الحذف.');
}

export async function renameExplorerEntry(node: CleanEntry | undefined, rootUri: vscode.Uri): Promise<void> {
  if (!node) {
    vscode.window.showErrorMessage('اختر ملفا أو مجلدا من Clean Workspace أولا.');
    return;
  }
  const oldName = entryDisplayName(node);
  const input = await vscode.window.showInputBox({
    prompt: 'اسم جديد لـ "' + oldName + '"',
    value: oldName,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {
        return 'اكتب اسما صحيحا';
      }
      if (t.indexOf('/') !== -1 || t.indexOf('\\') !== -1) {
        return 'الاسم الجديد بدون مسارات';
      }
      return undefined;
    }
  });
  if (!input || input === oldName) {
    return;
  }
  const newUri = vscode.Uri.joinPath(node.parentDir, input);
  try {
    try {
      await vscode.workspace.fs.stat(newUri);
      vscode.window.showErrorMessage('يوجد عنصر بهذا الاسم مسبقا.');
      return;
    } catch {
      // free
    }
    await vscode.workspace.fs.rename(node.uri, newUri, { overwrite: false });
    const oldRel = relOf(rootUri, node.uri);
    const newRel = relOf(rootUri, newUri);
    if (oldRel && newRel && oldRel.toLowerCase().endsWith('.css')) {
      await relinkMovedCss(rootUri, oldRel, newRel);
    }
    if (oldRel && newRel && node.isDir) {
      await resyncMovedDir(rootUri, oldRel, newRel);
    }
    vscode.window.showInformationMessage('تمت إعادة التسمية إلى: ' + input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage('تعذر إعادة التسمية: ' + msg);
  }
}

export async function relinkMovedCss(rootUri: vscode.Uri, oldRel: string, newRel: string): Promise<void> {
  if (await isPageScoped(rootUri, newRel)) {
    return;
  }
  const hadImport = await removePageImport(rootUri, oldRel);
  const text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, ...newRel.split('/')))).toString('utf8');
  if (hadImport || /@(apply|tailwind|screen)\b/.test(text)) {
    await ensureInputCss(rootUri);
    await ensurePageImport(rootUri, newRel);
    scheduleBuild(rootUri);
  }
}

export async function resyncMovedDir(rootUri: vscode.Uri, oldRel: string, newRel: string): Promise<void> {
  const moved = await removeImportsUnderDir(rootUri, oldRel);
  const pattern = newRel ? newRel + '/**/*.css' : '**/*.css';
  const found = await vscode.workspace.findFiles(pattern, '{**/node_modules/**,**/.git/**}');
  let added = false;
  for (const f of found) {
    const rel = vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
    let text = '';
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(f)).toString('utf8');
    } catch {
      continue;
    }
    if (/@(apply|tailwind|screen)\b/.test(text) && !(await isPageScoped(rootUri, rel))) {
      await ensureInputCss(rootUri);
      if (await ensurePageImport(rootUri, rel)) {
        added = true;
      }
    }
  }
  if (moved || added) {
    scheduleBuild(rootUri);
  }
}

export { isPlanInput };
