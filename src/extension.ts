import * as vscode from 'vscode';
import { exec } from 'child_process';

interface CustomItem {
  type: 'file' | 'folder';
  path: string;
}

interface CreateData {
  quickSrc: boolean;
  quickCss: boolean;
  quickHtml: boolean;
  quickConfig: boolean;
  installTailwind: boolean;
  startWatch: boolean;
  items: CustomItem[];
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'tailwind-starter.createProject',
    async () => {
      const panel = vscode.window.createWebviewPanel(
        'tailwindStarter',
        'Create Tailwind Project',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = getWebviewContent();

      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === 'createProject') {
            await createTailwindProject(message.data as CreateData);
            panel.dispose();
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  const createPage = vscode.commands.registerCommand('tailwind-starter.createPage', async (node?: CleanEntry) => {
    await createPageFlow(node);
  });

  const checkProject = vscode.commands.registerCommand('tailwind-starter.checkProject', async () => {
    await checkProjectFlow();
  });

  const rebuild = vscode.commands.registerCommand('tailwind-starter.rebuildNow', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
      return;
    }
    await buildNow(folders[0].uri);
  });

  const linkToPage = vscode.commands.registerCommand('tailwind-starter.linkToPage', async (node?: CleanEntry) => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
      return;
    }
    const rootUri = folders[0].uri;
    let assetRel: string | undefined;
    let kind: 'css' | 'js' | undefined;
    if (node && !node.isDir) {
      const r = relOf(rootUri, node.uri);
      if (r && (r.toLowerCase().endsWith('.css') || r.toLowerCase().endsWith('.js'))) {
        assetRel = r;
        kind = r.toLowerCase().endsWith('.css') ? 'css' : 'js';
      }
    }
    if (!assetRel || !kind) {
      const picked = await pickAssetFile(rootUri);
      if (!picked) {
        return;
      }
      assetRel = picked.rel;
      kind = picked.kind;
    }
    const pageRel = await pickHtmlPage(rootUri);
    if (!pageRel) {
      return;
    }
    await linkAssetToPage(rootUri, assetRel, pageRel, kind);
  });

  const explorer = new CleanExplorerProvider();
  const treeView = vscode.window.createTreeView('cleanFilesView', { treeDataProvider: explorer, showCollapseAll: true, canSelectMany: true, dragAndDropController: new CleanExplorerDnD() });
  const refreshExplorerCmd = vscode.commands.registerCommand('tailwind-starter.refreshExplorer', () => {
    explorer.refresh();
  });
  const explorerNewFileCmd = vscode.commands.registerCommand('tailwind-starter.newFile', (node?: CleanEntry) => {
    void createExplorerEntry(node, false);
  });
  const explorerNewFolderCmd = vscode.commands.registerCommand('tailwind-starter.newFolder', (node?: CleanEntry) => {
    void createExplorerEntry(node, true);
  });
  const explorerDeleteCmd = vscode.commands.registerCommand('tailwind-starter.deleteEntry', (node?: CleanEntry) => {
    const targets = treeView.selection && treeView.selection.length > 0 ? Array.from(treeView.selection) : (node ? [node] : []);
    void deleteExplorerEntries(targets);
  });
  const explorerRenameCmd = vscode.commands.registerCommand('tailwind-starter.renameEntry', (node?: CleanEntry) => {
    void renameExplorerEntry(node);
  });
  let treeTimer: NodeJS.Timeout | undefined;
  const queueTreeRefresh = () => {
    if (treeTimer) {
      clearTimeout(treeTimer);
    }
    treeTimer = setTimeout(() => {
      explorer.refresh();
    }, 300);
  };
  const treeWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);
  const treeRefreshIfVisible = (uri: vscode.Uri) => {
    if (!skipTreePath(uri)) {
      queueTreeRefresh();
    }
  };
  treeWatcher.onDidCreate(treeRefreshIfVisible);
  treeWatcher.onDidDelete(treeRefreshIfVisible);
  treeWatcher.onDidChange(treeRefreshIfVisible);
  context.subscriptions.push(treeView, treeWatcher, refreshExplorerCmd, explorerNewFileCmd, explorerNewFolderCmd, explorerDeleteCmd, explorerRenameCmd);

  const output = vscode.window.createOutputChannel('Tailwind Starter');
  diagCollection = vscode.languages.createDiagnosticCollection('tailwind-starter');
  context.subscriptions.push(diagCollection);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'tailwind-starter.rebuildNow';
  status.text = '$(check) Tailwind';
  status.tooltip = 'Tailwind Starter: اضغط لإعادة البناء';
  status.show();
  context.subscriptions.push(disposable, createPage, checkProject, rebuild, linkToPage, output, status);

  void startAutoMode(context, output, status);
}

function getExplorerExclude(): string[] {
  const list = vscode.workspace.getConfiguration('tailwindStarter').get<string[]>('explorerExclude', []);
  return (list || []).map((s) => String(s).toLowerCase());
}

function isExcludedName(name: string): boolean {
  return getExplorerExclude().indexOf(name.toLowerCase()) !== -1;
}

function skipTreePath(uri: vscode.Uri): boolean {
  return /[\\/]node_modules[\\/]|[\\/]\.git[\\/]/i.test(uri.fsPath);
}

function entryDisplayName(node: CleanEntry): string {
  if (typeof node.label === 'string') {
    return node.label;
  }
  if (node.label) {
    return node.label.label;
  }
  return node.entryName;
}

class CleanEntry extends vscode.TreeItem {
  readonly entryName: string;
  readonly uri: vscode.Uri;
  readonly parentDir: vscode.Uri;
  readonly isDir: boolean;
  readonly depth: number;

  constructor(entryName: string, uri: vscode.Uri, parentDir: vscode.Uri, isDir: boolean, depth: number) {
    super(entryName, isDir ? (depth === 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None);
    this.entryName = entryName;
    this.uri = uri;
    this.parentDir = parentDir;
    this.isDir = isDir;
    this.depth = depth;
    this.resourceUri = uri;
    this.contextValue = isDir ? 'folder' : 'file';
    if (!isDir) {
      this.command = { command: 'vscode.open', title: 'Open File', arguments: [uri] };
    }
  }
}

class CleanExplorerDnD implements vscode.TreeDragAndDropController<CleanEntry> {
  readonly dragMimeTypes: string[] = ['application/vnd.code.tree.cleanFilesView'];
  readonly dropMimeTypes: string[] = ['application/vnd.code.tree.cleanFilesView', 'text/uri-list'];

  async handleDrag(source: readonly CleanEntry[], dataTransfer: vscode.DataTransfer): Promise<void> {
    const payload = JSON.stringify(source.map((s) => ({ u: s.uri.toString(), d: s.isDir })));
    dataTransfer.set('application/vnd.code.tree.cleanFilesView', new vscode.DataTransferItem(payload));
  }

  async handleDrop(target: CleanEntry | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      return;
    }
    const rootUri = folders[0].uri;
    const destDir = target ? (target.isDir ? target.uri : target.parentDir) : rootUri;

    const internal = dataTransfer.get('application/vnd.code.tree.cleanFilesView');
    if (internal) {
      let items: Array<{ u?: unknown; d?: unknown }> = [];
      try {
        const raw = await internal.asString();
        const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '[]');
        if (Array.isArray(parsed)) {
          items = parsed as Array<{ u?: unknown; d?: unknown }>;
        }
      } catch {
        return;
      }
      for (const it of items) {
        if (token.isCancellationRequested) {
          return;
        }
        if (!it || typeof it.u !== 'string') {
          continue;
        }
        const srcUri = vscode.Uri.parse(it.u);
        const rel = relOf(rootUri, srcUri);
        if (!rel) {
          continue;
        }
        const name = rel.split('/').pop() as string;
        const dest = vscode.Uri.joinPath(destDir, name);
        if (dest.toString() === srcUri.toString()) {
          continue;
        }
        const srcPath = srcUri.fsPath.toLowerCase();
        const destPath = destDir.fsPath.toLowerCase();
        if (destPath === srcPath || destPath.indexOf(srcPath + '\\') === 0 || destPath.indexOf(srcPath + '/') === 0) {
          vscode.window.showErrorMessage('لا يمكن النقل إلى الداخل نفسه: ' + name);
          continue;
        }
        try {
          await vscode.workspace.fs.stat(dest);
          vscode.window.showErrorMessage('موجود مسبقا في الوجهة: ' + name);
          continue;
        } catch {
          // free → move
        }
        try {
          await vscode.workspace.fs.rename(srcUri, dest, { overwrite: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage('تعذر النقل: ' + msg);
          continue;
        }
        const newRel = relOf(rootUri, dest);
        if (!newRel) {
          continue;
        }
        if (it.d === true) {
          await resyncMovedDir(rootUri, rel, newRel);
        } else if (rel.toLowerCase().endsWith('.css')) {
          await relinkMovedCss(rootUri, rel, newRel);
        }
      }
      return;
    }

    const uriList = dataTransfer.get('text/uri-list');
    if (!uriList) {
      return;
    }
    let text = '';
    try {
      text = String(await uriList.asString());
    } catch {
      return;
    }
    const lines = text.split('\n').map((s) => s.trim()).filter((s) => s !== '' && s.charAt(0) !== '#');
    for (const line of lines) {
      if (token.isCancellationRequested) {
        return;
      }
      let srcUri: vscode.Uri;
      try {
        srcUri = vscode.Uri.parse(line);
      } catch {
        continue;
      }
      if (srcUri.scheme !== 'file') {
        continue;
      }
      const segs = srcUri.fsPath.split(/[\\/]/).filter((s) => s !== '');
      const name = segs.length > 0 ? segs[segs.length - 1] : 'dropped';
      const dest = vscode.Uri.joinPath(destDir, name);
      try {
        await vscode.workspace.fs.stat(dest);
        vscode.window.showErrorMessage('موجود مسبقا في الوجهة: ' + name);
        continue;
      } catch {
        // free → copy
      }
      try {
        await copyEntryRecursive(srcUri, dest);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage('تعذر النسخ: ' + msg);
      }
    }
  }
}

class CleanExplorerProvider implements vscode.TreeDataProvider<CleanEntry> {
  private changeEmitter = new vscode.EventEmitter<CleanEntry | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  refresh(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: CleanEntry): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CleanEntry): Promise<CleanEntry[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      return [];
    }
    const dirUri = element ? element.uri : folders[0].uri;
    const depth = element ? element.depth + 1 : 0;
    let entries: Array<[string, vscode.FileType]>;
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return [];
    }
    const out: CleanEntry[] = [];
    for (const [name, ftype] of entries) {
      if (isExcludedName(name)) {
        continue;
      }
      const uri = vscode.Uri.joinPath(dirUri, name);
      const isDir = (ftype & vscode.FileType.Directory) !== 0;
      out.push(new CleanEntry(name, uri, dirUri, isDir, depth));
    }
    out.sort((a, b) => {
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }
      return a.entryName.localeCompare(b.entryName, undefined, { sensitivity: 'base' });
    });
    return out;
  }
}

async function createExplorerEntry(node: CleanEntry | undefined, isFolder: boolean) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
    return;
  }
  const rootUri = folders[0].uri;
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
  let cssMode: 'global' | 'scoped' | 'none' | undefined;
  let jsLinked = false;
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
    const choice = await vscode.window.showQuickPick(picks, { placeHolder: wantCss ? 'كيف يُستخدم ملف CSS؟' : 'هل تربط ملف JS في صفحة؟' });
    if (!choice) {
      return;
    }
    if (choice.value === 'scoped' || choice.value === 'linked') {
      const page = await pickHtmlPage(rootUri);
      if (!page) {
        return;
      }
      linkPageRel = page;
      if (wantCss) {
        cssMode = 'scoped';
      } else {
        jsLinked = true;
      }
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
        // not exists → create
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
      } else if (wantJs && jsLinked) {
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

async function removeImportsUnder(rootUri: vscode.Uri, dirRel: string): Promise<boolean> {
  const inputUri = vscode.Uri.joinPath(rootUri, 'input.css');
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(inputUri)).toString('utf8');
  } catch {
    return false;
  }
  const prefix = '@import "./' + dirRel + '/';
  const exact = '@import "./' + dirRel + '";';
  const lines = text.split('\n');
  const kept = lines.filter((ln) => {
    const t = ln.trim();
    return t !== exact && t.indexOf(prefix) !== 0;
  });
  if (kept.length === lines.length) {
    return false;
  }
  await vscode.workspace.fs.writeFile(inputUri, Buffer.from(kept.join('\n'), 'utf8'));
  return true;
}

async function isPageScoped(rootUri: vscode.Uri, rel: string): Promise<boolean> {
  try {
    const text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, ...rel.split('/')))).toString('utf8');
    return text.indexOf(PAGE_SCOPED_MARK) !== -1;
  } catch {
    return false;
  }
}

async function relinkMovedCss(rootUri: vscode.Uri, oldRel: string, newRel: string): Promise<void> {
  if (await isPageScoped(rootUri, newRel)) {
    return;
  }
  const hadImport = await removePageImport(rootUri, oldRel);
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, ...newRel.split('/')))).toString('utf8');
  } catch {
    text = '';
  }
  if (hadImport || /@(apply|tailwind|screen)\b/.test(text)) {
    await ensureInputCss(rootUri);
    await ensurePageImport(rootUri, newRel);
    scheduleBuild(rootUri);
  }
}

async function copyEntryRecursive(srcUri: vscode.Uri, destUri: vscode.Uri): Promise<void> {
  const st = await vscode.workspace.fs.stat(srcUri);
  if ((st.type & vscode.FileType.Directory) !== 0) {
    await vscode.workspace.fs.createDirectory(destUri);
    const children = await vscode.workspace.fs.readDirectory(srcUri);
    for (const [name] of children) {
      await copyEntryRecursive(vscode.Uri.joinPath(srcUri, name), vscode.Uri.joinPath(destUri, name));
    }
    return;
  }
  const data = await vscode.workspace.fs.readFile(srcUri);
  await vscode.workspace.fs.writeFile(destUri, Buffer.from(data));
}

async function resyncMovedDir(rootUri: vscode.Uri, oldRel: string, newRel: string): Promise<void> {
  const moved = await removeImportsUnder(rootUri, oldRel);
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
    if (/@(apply|tailwind|screen)\b/.test(text) && text.indexOf(PAGE_SCOPED_MARK) === -1) {
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

async function deleteExplorerEntries(nodes: CleanEntry[]) {
  if (!nodes || nodes.length === 0) {
    vscode.window.showErrorMessage('اختر ملفا أو مجلدا من Clean Workspace أولا.');
    return;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }
  const rootUri = folders[0].uri;
  const title = nodes.length === 1 ? '"' + entryDisplayName(nodes[0]) + '"' : nodes.length + ' عناصر';
  const answer = await vscode.window.showWarningMessage('حذف ' + title + ' نهائيا؟', { modal: true }, 'حذف');
  if (answer !== 'حذف') {
    return;
  }
  let needsBuild = false;
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
      if (await removeImportsUnder(rootUri, rel)) {
        needsBuild = true;
      }
    } else if (rel.toLowerCase().endsWith('.css')) {
      if (isGeneratedCss(rel.toLowerCase())) {
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

async function renameExplorerEntry(node: CleanEntry | undefined) {
  if (!node) {
    vscode.window.showErrorMessage('اختر ملفا أو مجلدا من Clean Workspace أولا.');
    return;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }
  const rootUri = folders[0].uri;
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
      // free → rename
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

export function deactivate() {}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      max-width: 640px;
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
    }
    h2 { margin-bottom: 8px; }
    .hint { opacity: 0.8; font-size: 12px; margin-bottom: 16px; }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .card h3 { margin: 0 0 10px 0; font-size: 14px; }
    .option { margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }
    .row select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px;
    }
    .row input[type="text"] {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px 8px;
      direction: ltr;
      text-align: left;
    }
    button {
      padding: 7px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      border-radius: 4px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-danger {
      background: transparent;
      color: var(--vscode-errorForeground);
      border: 1px solid var(--vscode-errorForeground);
      padding: 5px 10px;
    }
    .toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
    #createBtn { width: 100%; padding: 10px; font-size: 15px; font-weight: bold; }
    code { direction: ltr; unicode-bidi: embed; }
  </style>
</head>
<body>
  <h2>إنشاء مشروع Tailwind</h2>
  <div class="hint">اختر ملفات البدء السريع، وأضف أي عدد من المجلدات والملفات بمسارات متداخلة (مثال: <code>src/components/header.html</code>).</div>

  <div class="card">
    <h3>ملفات البدء السريع</h3>
    <div class="option">
      <input type="checkbox" id="quickSrc" checked>
      <label for="quickSrc">مجلد <code>src/</code></label>
    </div>
    <div class="option">
      <input type="checkbox" id="quickCss" checked>
      <label for="quickCss"><code>input.css</code> بتوجيهات Tailwind</label>
    </div>
    <div class="option">
      <input type="checkbox" id="quickHtml" checked>
      <label for="quickHtml"><code>index.html</code> مربوط بملف CSS</label>
    </div>
    <div class="option">
      <input type="checkbox" id="quickConfig" checked>
      <label for="quickConfig"><code>tailwind.config.js</code></label>
    </div>
    <div class="option">
      <input type="checkbox" id="installTailwind" checked>
      <label for="installTailwind">فحص Tailwind وتثبيته تلقائيا إن لم يكن موجودا</label>
    </div>
    <div class="option">
      <input type="checkbox" id="startWatch" checked>
      <label for="startWatch">تشغيل المراقبة <code>--watch</code> تلقائيا</label>
    </div>
  </div>

  <div class="card">
    <h3>شجرة المجلدات والملفات المخصصة</h3>
    <div class="toolbar">
      <button class="btn-secondary" id="addFolderBtn">+ مجلد</button>
      <button class="btn-secondary" id="addFileBtn">+ ملف</button>
    </div>
    <div id="customList"></div>
    <div class="hint">اكتب المسار كاملا للتداخل، مثال مجلد: <code>assets/images/gallery</code> — مثال ملف: <code>assets/js/main.js</code></div>
  </div>

  <button id="createBtn">إنشاء المشروع</button>

  <script>
    const vscode = acquireVsCodeApi();
    const list = document.getElementById('customList');

    function addItem(type, value) {
      const row = document.createElement('div');
      row.className = 'row';

      const sel = document.createElement('select');
      const optFile = document.createElement('option');
      optFile.value = 'file';
      optFile.textContent = 'ملف';
      const optFolder = document.createElement('option');
      optFolder.value = 'folder';
      optFolder.textContent = 'مجلد';
      sel.appendChild(optFile);
      sel.appendChild(optFolder);
      sel.value = type;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = type === 'folder' ? 'assets/images/gallery' : 'assets/js/main.js';
      input.value = value || '';
      sel.addEventListener('change', function() {
        input.placeholder = sel.value === 'folder' ? 'assets/images/gallery' : 'assets/js/main.js';
      });

      const del = document.createElement('button');
      del.className = 'btn-danger';
      del.textContent = 'X';
      del.addEventListener('click', function() { row.remove(); });

      row.appendChild(sel);
      row.appendChild(input);
      row.appendChild(del);
      list.appendChild(row);
    }

    document.getElementById('addFolderBtn').addEventListener('click', function() { addItem('folder', ''); });
    document.getElementById('addFileBtn').addEventListener('click', function() { addItem('file', ''); });

    addItem('folder', 'assets/images');
    addItem('file', 'assets/js/main.js');

    function getChecked(id) { return document.getElementById(id).checked; }

    document.getElementById('createBtn').addEventListener('click', function() {
      const items = [];
      const rows = list.querySelectorAll('.row');
      for (let i = 0; i < rows.length; i++) {
        const sel = rows[i].querySelector('select');
        const inp = rows[i].querySelector('input');
        const p = inp.value.trim();
        if (p) { items.push({ type: sel.value, path: p }); }
      }
      const data = {
        quickSrc: getChecked('quickSrc'),
        quickCss: getChecked('quickCss'),
        quickHtml: getChecked('quickHtml'),
        quickConfig: getChecked('quickConfig'),
        installTailwind: getChecked('installTailwind'),
        startWatch: getChecked('startWatch'),
        items: items
      };
      vscode.postMessage({ command: 'createProject', data: data });
    });
  </script>
</body>
</html>`;
}

async function createTailwindProject(data: CreateData) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
    return;
  }
  const rootUri = workspaceFolders[0].uri;

  scaffolding = true;
  try {
    // 1. ملفات البدء السريع
    if (data.quickSrc) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, 'src'));
    }

    await ensurePackageJson(rootUri);

    await ensureVscodeSettings(rootUri);

    if (data.quickCss) {
      await writeFile(rootUri, 'input.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    }

    if (data.quickConfig) {
      await writeFile(
        rootUri,
        'tailwind.config.js',
        '/** @type {import(\'tailwindcss\').Config} */\nmodule.exports = {\n  content: ["./**/*.{html,js,ts,jsx,tsx}", "!./node_modules/**/*"],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}\n'
      );
    }

    if (data.quickHtml) {
      await writeFile(rootUri, 'index.html', defaultHtml('style.css'));
    }

    // 2. الشجرة المخصصة (مجلدات وملفات متداخلة بأي عدد)
    if (data.items && data.items.length > 0) {
      await createCustomItems(rootUri, data.items);
    }

    // 2b. ربط ملفات CSS المخصصة كما يفعل Create Page (محتوى فعلي + استيراد قبل أول بناء)
    await wireScaffoldedCss(rootUri, data.items);

    // 3. فحص Tailwind وتثبيته إن لم يكن موجودا
    if (data.installTailwind) {
      const installed = await isTailwindInstalled(rootUri);
      if (installed) {
        vscode.window.showInformationMessage('Tailwind مثبت مسبقا، تم تخطي التثبيت.');
      } else {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind CSS...', cancellable: false },
          async () => {
            await runCommand(rootUri, 'npm install -D tailwindcss@3');
          }
        );
        const okNow = await isTailwindInstalled(rootUri);
        if (!okNow) {
          vscode.window.showErrorMessage('فشل تثبيت Tailwind. تحقق من الاتصال بالإنترنت ومن سجل npm.');
          return;
        }
        vscode.window.showInformationMessage('تم تثبيت Tailwind بنجاح.');
      }
    }

    // 4. بناء أولي (والوضع التلقائي يتولى البناء بعد ذلك)
    if (data.startWatch) {
      if (!(await fileExists(rootUri, 'input.css'))) {
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
    scaffolding = false;
    await ensureEngaged(rootUri, data.installTailwind);
  }
}

async function wireScaffoldedCss(rootUri: vscode.Uri, items: CustomItem[] | undefined) {
  if (!items || items.length === 0) {
    return;
  }
  const toImport: string[] = [];
  for (const item of items) {
    if (!item || item.type !== 'file') {
      continue;
    }
    const clean = sanitizeRelPath(item.path);
    if (!clean || !clean.toLowerCase().endsWith('.css')) {
      continue;
    }
    if (isPlanInput(clean) || isGeneratedCss(clean.toLowerCase())) {
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
      const powered = tailwindPageCssTemplate(safeBase);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(powered, 'utf8'));
      text = powered;
    }
    if (/@(apply|tailwind|screen)\b/.test(text)) {
      toImport.push(clean);
    }
  }
  if (toImport.length === 0) {
    return;
  }
  await ensureInputCss(rootUri);
  for (const rel of toImport) {
    await ensurePageImport(rootUri, rel);
  }
}

async function createCustomItems(rootUri: vscode.Uri, items: CustomItem[]) {
  for (const item of items) {
    const clean = sanitizeRelPath(item.path);
    if (!clean) {
      continue;
    }
    if (item.type === 'folder') {
      const dirUri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
      await vscode.workspace.fs.createDirectory(dirUri);
    } else {
      const parts = clean.split('/');
      const fileName = parts.pop() as string;
      const dirParts = parts;
      let dirUri = rootUri;
      if (dirParts.length > 0) {
        dirUri = vscode.Uri.joinPath(rootUri, ...dirParts);
        await vscode.workspace.fs.createDirectory(dirUri);
      }
      const fileUri = vscode.Uri.joinPath(dirUri, fileName);
      if (await fileExistsUri(fileUri)) {
        continue; // لا نكتب فوق ملف موجود
      }
      const cssHref = cssHrefForDir(dirParts.join('/'));
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(defaultFileContent(clean, cssHref), 'utf8'));
    }
  }
}

function sanitizeRelPath(p: string): string {
  const normalized = p.trim().replace(/\\/g, '/');
  const parts = normalized.split('/').filter((s) => s !== '' && s !== '.' && s !== '..');
  return parts.join('/');
}

function cssHrefForDir(dir: string): string {
  if (!dir) {
    return 'style.css';
  }
  const depth = dir.split('/').length;
  return '../'.repeat(depth) + 'style.css';
}

function defaultFileContent(relPath: string, cssHref: string): string {
  const base = relPath.split('/').pop() || '';
  if (base === 'input.css') {
    return '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
  }
  if (base === 'tailwind.config.js') {
    return '/** @type {import(\'tailwindcss\').Config} */\nmodule.exports = {\n  content: ["./**/*.{html,js,ts,jsx,tsx}", "!./node_modules/**/*"],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}\n';
  }
  if (base.toLowerCase().endsWith('.html')) {
    return defaultHtml(cssHref);
  }
  if (base.toLowerCase().endsWith('.css')) {
    return '/* ' + base + ' */\n';
  }
  if (base.toLowerCase().endsWith('.js')) {
    return '// ' + base + '\n';
  }
  return '';
}

function defaultHtml(cssHref: string): string {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Tailwind Project</title>\n  <link rel="stylesheet" href="' + cssHref + '">\n</head>\n<body class="bg-gray-100">\n  <h1 class="text-3xl font-bold text-blue-600 p-8">Hello Tailwind!</h1>\n</body>\n</html>\n';
}

async function ensurePackageJson(rootUri: vscode.Uri) {
  const uri = vscode.Uri.joinPath(rootUri, 'package.json');
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    const content = JSON.stringify(
      {
        name: 'tailwind-project',
        version: '1.0.0',
        scripts: {
          watch: 'tailwindcss -i ./input.css -o ./style.css --watch'
        }
      },
      null,
      2
    );
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  }
}

async function ensureVscodeSettings(rootUri: vscode.Uri) {
  const dirUri = vscode.Uri.joinPath(rootUri, '.vscode');
  await vscode.workspace.fs.createDirectory(dirUri);
  const settingsUri = vscode.Uri.joinPath(dirUri, 'settings.json');
  let settings: Record<string, unknown> = {};
  try {
    const raw = await vscode.workspace.fs.readFile(settingsUri);
    settings = JSON.parse(Buffer.from(raw).toString('utf8'));
  } catch {
    settings = {};
  }
  settings['css.lint.unknownAtRules'] = 'ignore';
  settings['scss.lint.unknownAtRules'] = 'ignore';
  settings['less.lint.unknownAtRules'] = 'ignore';
  await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(JSON.stringify(settings, null, 2), 'utf8'));
}

async function writeFile(rootUri: vscode.Uri, relPath: string, content: string) {
  const clean = sanitizeRelPath(relPath);
  const uri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

async function fileExists(rootUri: vscode.Uri, relPath: string): Promise<boolean> {
  const uri = vscode.Uri.joinPath(rootUri, ...sanitizeRelPath(relPath).split('/'));
  return fileExistsUri(uri);
}

async function fileExistsUri(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function isTailwindInstalled(rootUri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(rootUri, 'node_modules', 'tailwindcss', 'package.json'));
    return true;
  } catch {
    return false;
  }
}

const BROAD_CONTENT_GLOB = '["./**/*.{html,js,ts,jsx,tsx}", "!./node_modules/**/*"]';
const MANAGED_MARK = 'tailwind-starter: managed imports';
const PAGE_SCOPED_MARK = 'tailwind-starter: page-scoped';
const CANONICAL_WATCH_SCRIPT = 'tailwindcss -i ./input.css -o ./style.css --watch';

function resolveContextDir(rootUri: vscode.Uri, node?: CleanEntry): { dirRel: string; dirUri: vscode.Uri } {
  if (node) {
    const dirUri = node.isDir ? node.uri : node.parentDir;
    const rel = relOf(rootUri, dirUri);
    if (rel !== undefined) {
      return { dirRel: rel, dirUri };
    }
  }
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme === 'file') {
    const rel = relOf(rootUri, editor.document.uri);
    if (rel !== undefined) {
      const dir = dirOf(rel);
      return { dirRel: dir, dirUri: dir ? vscode.Uri.joinPath(rootUri, ...dir.split('/')) : rootUri };
    }
  }
  return { dirRel: '', dirUri: rootUri };
}

async function createPageFlow(contextNode?: CleanEntry) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
    return;
  }
  const rootUri = workspaceFolders[0].uri;
  const ctx = resolveContextDir(rootUri, contextNode);

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

  interface CssKindPick extends vscode.QuickPickItem {
    value: 'plain' | 'tailwind' | 'own';
  }
  const cssKind = await vscode.window.showQuickPick<CssKindPick>(
    [
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
    ],
    { placeHolder: 'نوع ملف CSS الخاص بالصفحة' }
  );
  if (!cssKind) {
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

  scaffolding = true;

  if (!(await isTailwindInstalled(rootUri))) {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind CSS...', cancellable: false },
      async () => {
        await runCommand(rootUri, 'npm install -D tailwindcss@3');
      }
    );
  }

  await ensureTailwindConfig(rootUri);

  const safeBase = baseName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  const kind = cssKind.value;
  let sharedHref: string;
  let extraHref: string | undefined;
  if (kind === 'own') {
    const outRel = cssRel.replace(/\.css$/i, '') + '.compiled.css';
    await createFileIfMissing(rootUri, cssRel, ownInputCssTemplate(safeBase));
    await removePageImport(rootUri, cssRel);
    await addTargetSetting(rootUri, cssRel, outRel);
    sharedHref = relativeHref(pageRel, outRel);
    extraHref = undefined;
  } else {
    const isTailwindCss = kind === 'tailwind';
    if (isTailwindCss) {
      await ensureInputCss(rootUri);
      await ensurePageImport(rootUri, cssRel);
      await createFileIfMissing(rootUri, cssRel, tailwindPageCssTemplate(safeBase));
    } else {
      await createFileIfMissing(rootUri, cssRel, plainPageCssTemplate(safeBase));
    }
    sharedHref = relativeHref(pageRel, 'style.css');
    extraHref = isTailwindCss ? undefined : relativeHref(pageRel, cssRel);
  }

  let scriptHref: string | undefined;
  if (jsRel) {
    await createFileIfMissing(rootUri, jsRel, pageJsTemplate(safeBase));
    scriptHref = relativeHref(pageRel, jsRel);
  }
  await createFileIfMissing(rootUri, pageRel, pageHtmlTemplate(baseName, sharedHref, extraHref, scriptHref));
  await buildNow(rootUri);

  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(rootUri, ...pageRel.split('/')));
    await vscode.window.showTextDocument(doc);
  } catch {
    // ignore
  }
  scaffolding = false;
  await ensureEngaged(rootUri, true);
  vscode.window.showInformationMessage('تم إنشاء الصفحة: ' + pageRel);
}

async function checkProjectFlow() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
    return;
  }
  const rootUri = workspaceFolders[0].uri;
  let fixedLinks = 0;
  let importsAdded = 0;

  const configFixed = await ensureTailwindConfig(rootUri);

  const cssFiles = await vscode.workspace.findFiles('**/*.css', '{**/node_modules/**,**/.git/**}');
  for (const f of cssFiles) {
    const rel = vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
    if (rel === 'style.css' || rel === 'output.css' || isPlanInput(rel)) {
      continue;
    }
    let text = '';
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(f)).toString('utf8');
    } catch {
      continue;
    }
    if (/@(apply|tailwind|screen)\b/.test(text) && text.indexOf(PAGE_SCOPED_MARK) === -1) {
      await ensureInputCss(rootUri);
      if (await ensurePageImport(rootUri, rel)) {
        importsAdded++;
      }
    }
  }

  const htmlFiles = await vscode.workspace.findFiles('**/*.html', '{**/node_modules/**,**/.git/**}');
  for (const f of htmlFiles) {
    const rel = vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
    let text = '';
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(f)).toString('utf8');
    } catch {
      continue;
    }
    const correct = relativeHref(rel, 'style.css');
    const linkRe = /<link\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    let hasGood = false;
    let outHref: string | undefined;
    while ((m = linkRe.exec(text)) !== null) {
      const tag = m[0];
      if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) {
        continue;
      }
      const hm = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (!hm) {
        continue;
      }
      const resolved = resolveHref(dirOf(rel), hm[1]).toLowerCase();
      if (resolved === 'output.css') {
        if (outHref === undefined) {
          outHref = hm[1];
        }
      } else if (isGeneratedCss(resolved)) {
        hasGood = true;
      }
    }
    if (!hasGood) {
      let updated = text;
      if (outHref !== undefined) {
        updated = updated.replace(outHref, correct);
      } else if (/<\/head\s*>/i.test(updated)) {
        updated = updated.replace(/<\/head\s*>/i, '  <link rel="stylesheet" href="' + correct + '">\n</head>');
      } else {
        continue;
      }
      await vscode.workspace.fs.writeFile(f, Buffer.from(updated, 'utf8'));
      fixedLinks++;
    }
  }

  await ensureWatchScript(rootUri);

  let installedNote = '';
  if (!(await isTailwindInstalled(rootUri))) {
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind CSS...', cancellable: false },
        async () => {
          await runCommand(rootUri, 'npm install -D tailwindcss@3');
        }
      );
      installedNote = ' وثُبّت Tailwind';
    } catch {
      vscode.window.showErrorMessage('فشل تثبيت Tailwind. تحقق من الاتصال بالإنترنت.');
      return;
    }
  }

  if (await fileExists(rootUri, 'input.css')) {
    await buildNow(rootUri);
  }

  vscode.window.showInformationMessage(
    'فحص مكتمل' + installedNote + ': روابط مصلحة=' + fixedLinks + '، config محدث=' + (configFixed ? 'نعم' : 'لا حاجة') + '، ملفات CSS مربوطة بالبناء=' + importsAdded
  );
}

interface BuildTarget {
  input: string;
  output: string;
}

function getBuildPlan(): BuildTarget[] {
  const plan: BuildTarget[] = [{ input: 'input.css', output: 'style.css' }];
  const seen: string[] = ['input.css'];
  const cfg = vscode.workspace.getConfiguration('tailwindStarter').get<Array<{ input?: unknown; output?: unknown }>>('targets', []);
  for (const t of cfg || []) {
    if (!t || typeof t.input !== 'string' || typeof t.output !== 'string') {
      continue;
    }
    const inp = sanitizeRelPath(t.input);
    const out = sanitizeRelPath(t.output);
    if (!inp || !out || inp === out) {
      continue;
    }
    if (seen.indexOf(inp.toLowerCase()) !== -1) {
      continue;
    }
    seen.push(inp.toLowerCase());
    plan.push({ input: inp, output: out });
  }
  return plan;
}

function getPlanOutputs(): string[] {
  const outs: string[] = ['style.css', 'output.css'];
  for (const t of getBuildPlan()) {
    const low = t.output.toLowerCase();
    if (outs.indexOf(low) === -1) {
      outs.push(low);
    }
  }
  return outs;
}

function isGeneratedCss(lowerRel: string): boolean {
  return getPlanOutputs().indexOf(lowerRel) !== -1;
}

function isPlanInput(rel: string): boolean {
  const low = rel.toLowerCase();
  for (const t of getBuildPlan()) {
    if (t.input.toLowerCase() === low) {
      return true;
    }
  }
  return false;
}

async function ensureTailwindConfig(rootUri: vscode.Uri): Promise<boolean> {
  const uri = vscode.Uri.joinPath(rootUri, 'tailwind.config.js');
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(configTemplate(), 'utf8'));
    return true;
  }
  const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  if (text.indexOf('**/*.{html') !== -1) {
    return false;
  }
  const replaced = text.replace(/content\s*:\s*\[[^\]]*\]/s, 'content: ' + BROAD_CONTENT_GLOB);
  if (replaced === text) {
    vscode.window.showWarningMessage('تعذر تحديث content في tailwind.config.js تلقائيا — حدثه يدويا.');
    return false;
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(replaced, 'utf8'));
  return true;
}

function configTemplate(): string {
  return '/** @type {import(\'tailwindcss\').Config} */\nmodule.exports = {\n  content: ' + BROAD_CONTENT_GLOB + ',\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}\n';
}

async function ensureInputCss(rootUri: vscode.Uri) {
  if (await fileExists(rootUri, 'input.css')) {
    return;
  }
  const content = '/* ' + MANAGED_MARK + ' */\n\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
  await writeFile(rootUri, 'input.css', content);
}

async function ensurePageImport(rootUri: vscode.Uri, cssRel: string): Promise<boolean> {
  const uri = vscode.Uri.joinPath(rootUri, 'input.css');
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  } catch {
    text = '';
  }
  const line = '@import "./' + cssRel + '";';
  if (text.indexOf(line) !== -1) {
    return false;
  }
  if (text.indexOf(MANAGED_MARK) !== -1) {
    text = text.replace(MANAGED_MARK, MANAGED_MARK + '\n' + line);
  } else {
    text = '/* ' + MANAGED_MARK + ' */\n' + line + '\n\n' + text;
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
  return true;
}

async function createFileIfMissing(rootUri: vscode.Uri, rel: string, content: string): Promise<boolean> {
  if (await fileExists(rootUri, rel)) {
    return false;
  }
  const parts = sanitizeRelPath(rel).split('/');
  parts.pop();
  if (parts.length > 0) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, ...parts));
  }
  await writeFile(rootUri, rel, content);
  return true;
}

function dirOf(rel: string): string {
  const parts = rel.split('/');
  parts.pop();
  return parts.join('/');
}

function relativeHref(fromFile: string, toFile: string): string {
  const fromDir = dirOf(fromFile);
  const fromParts = fromDir ? fromDir.split('/') : [];
  const toParts = toFile.split('/');
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }
  const up = fromParts.length - i;
  const down = toParts.slice(i);
  return '../'.repeat(up) + down.join('/');
}

function resolveHref(fromDir: string, href: string): string {
  const clean = href.split('?')[0].split('#')[0].trim();
  if (!clean || clean.indexOf('://') !== -1 || clean.indexOf('data:') === 0 || clean.charAt(0) === '/') {
    return clean;
  }
  const out: string[] = [];
  const segs = (fromDir ? fromDir.split('/') : []).concat(clean.split('/'));
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

async function ensureWatchScript(rootUri: vscode.Uri) {
  const uri = vscode.Uri.joinPath(rootUri, 'package.json');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'));
  } catch {
    return;
  }
  const scripts = (data.scripts as Record<string, unknown> | undefined) || {};
  if (typeof scripts.watch === 'string') {
    return;
  }
  scripts.watch = CANONICAL_WATCH_SCRIPT;
  data.scripts = scripts;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
}

async function pickHtmlPage(rootUri: vscode.Uri): Promise<string | undefined> {
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

async function pickAssetFile(rootUri: vscode.Uri): Promise<{ rel: string; kind: 'css' | 'js' } | undefined> {
  const files = await vscode.workspace.findFiles('**/*.{css,js}', '{**/node_modules/**,**/.git/**}');
  interface AssetPick extends vscode.QuickPickItem {
    rel: string;
    assetKind: 'css' | 'js';
  }
  const items: AssetPick[] = [];
  for (const f of files) {
    const rel = vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
    if (!rel) {
      continue;
    }
    const lower = rel.toLowerCase();
    if (isGeneratedCss(lower) || isPlanInput(rel)) {
      continue;
    }
    const kind = lower.endsWith('.css') ? 'css' : 'js';
    items.push({ label: rel, description: kind === 'css' ? 'CSS' : 'JS', rel: rel, assetKind: kind });
  }
  if (items.length === 0) {
    vscode.window.showErrorMessage('لا توجد ملفات CSS/JS قابلة للربط.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'اختر ملف CSS أو JS' });
  if (!picked) {
    return undefined;
  }
  return { rel: picked.rel, kind: picked.assetKind };
}

async function linkAssetToPage(rootUri: vscode.Uri, assetRel: string, pageRel: string, kind: 'css' | 'js'): Promise<boolean> {
  const pageUri = vscode.Uri.joinPath(rootUri, ...pageRel.split('/'));
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(pageUri)).toString('utf8');
  } catch {
    vscode.window.showErrorMessage('تعذر قراءة الصفحة: ' + pageRel);
    return false;
  }
  if (kind === 'css') {
    let inputText = '';
    try {
      inputText = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, 'input.css'))).toString('utf8');
    } catch {
      inputText = '';
    }
    if (inputText.indexOf('@import "./' + assetRel + '";') !== -1) {
      const go = await vscode.window.showWarningMessage('هذا الملف عام (مستورد في البناء) — الربط المباشر سيكرر التنسيق. متابعة؟', 'متابعة', 'إلغاء');
      if (go !== 'متابعة') {
        return false;
      }
    }
    const href = relativeHref(pageRel, assetRel);
    if (text.indexOf(href) !== -1) {
      vscode.window.showInformationMessage('مربوط مسبقا في الصفحة.');
      return false;
    }
    if (/<\/head\s*>/i.test(text)) {
      text = text.replace(/<\/head\s*>/i, '  <link rel="stylesheet" href="' + href + '">\n</head>');
    } else {
      vscode.window.showErrorMessage('لا يوجد </head> في الصفحة.');
      return false;
    }
  } else {
    const src = relativeHref(pageRel, assetRel);
    if (text.indexOf(src) !== -1) {
      vscode.window.showInformationMessage('مربوط مسبقا في الصفحة.');
      return false;
    }
    const tag = '\n  <script src="' + src + '" defer></script>';
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

function scopedCssTemplate(base: string): string {
  return '/* Custom styles — tailwind-starter: page-scoped (linked only from its page) */\n.' + base + '-wrap {\n  padding: 1rem;\n}\n';
}

function pageJsTemplate(base: string): string {
  return "// " + base + " page script — linked only from its HTML page\ndocument.addEventListener('DOMContentLoaded', () => {\n  // TODO: page logic here\n});\n";
}

function pageHtmlTemplate(title: string, sharedHref: string, extraHref?: string, scriptHref?: string): string {
  const extra = extraHref ? '\n  <link rel="stylesheet" href="' + extraHref + '">' : '';
  const script = scriptHref ? '\n  <script src="' + scriptHref + '" defer></script>' : '';
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + title + '</title>\n  <link rel="stylesheet" href="' + sharedHref + '">' + extra + '\n</head>\n<body class="bg-gray-100">\n  <h1 class="text-3xl font-bold p-8">' + title + '</h1>' + script + '\n</body>\n</html>\n';
}

function tailwindPageCssTemplate(base: string): string {
  return '/* Custom styles for ' + base + ' (Tailwind-powered: supports @apply) */\n.' + base + '-wrap {\n  @apply p-4;\n}\n';
}

async function removePageImport(rootUri: vscode.Uri, cssRel: string): Promise<boolean> {
  const inputUri = vscode.Uri.joinPath(rootUri, 'input.css');
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(inputUri)).toString('utf8');
  } catch {
    return false;
  }
  const line = '@import "./' + cssRel + '";';
  if (text.indexOf(line) === -1) {
    return false;
  }
  const cleaned = text.split('\n').filter((ln) => ln.trim() !== line).join('\n');
  await vscode.workspace.fs.writeFile(inputUri, Buffer.from(cleaned, 'utf8'));
  return true;
}

async function addTargetSetting(rootUri: vscode.Uri, input: string, output: string): Promise<boolean> {
  const dirUri = vscode.Uri.joinPath(rootUri, '.vscode');
  await vscode.workspace.fs.createDirectory(dirUri);
  const settingsUri = vscode.Uri.joinPath(dirUri, 'settings.json');
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(settingsUri)).toString('utf8'));
  } catch {
    settings = {};
  }
  const raw = settings['tailwindStarter.targets'];
  const arr = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
  for (const t of arr) {
    if (t && typeof t.input === 'string' && t.input.toLowerCase() === input.toLowerCase()) {
      return false;
    }
  }
  arr.push({ input: input, output: output });
  settings['tailwindStarter.targets'] = arr;
  await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(JSON.stringify(settings, null, 2), 'utf8'));
  return true;
}

function ownInputCssTemplate(base: string): string {
  return '/* Standalone Tailwind input for ' + base + ' (compiled to its own output) */\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n.' + base + '-wrap {\n  @apply p-4;\n}\n';
}

function plainPageCssTemplate(base: string): string {
  return '/* Custom styles for ' + base + ' */\n/* tailwind-starter: page-scoped — linked only from its page */\n.' + base + '-wrap {\n  padding: 1rem;\n}\n';
}

let sharedOutput: vscode.OutputChannel | undefined;
let sharedStatus: vscode.StatusBarItem | undefined;
let building = false;
let pendingBuild = false;
let errorNotified = false;
let autoEngaged = false;
let engaging = false;
let scaffolding = false;
let installErrorShown = false;
let buildTimer: NodeJS.Timeout | undefined;
let diagCollection: vscode.DiagnosticCollection | undefined;

function autoBuildEnabled(): boolean {
  return vscode.workspace.getConfiguration('tailwindStarter').get<boolean>('autoBuild', true);
}

function autoFixEnabled(): boolean {
  return vscode.workspace.getConfiguration('tailwindStarter').get<boolean>('autoFix', true);
}

function setStatus(state: 'ok' | 'building' | 'error') {
  if (!sharedStatus) {
    return;
  }
  if (state === 'building') {
    sharedStatus.text = '$(sync~spin) Tailwind';
  } else if (state === 'error') {
    sharedStatus.text = '$(error) Tailwind';
  } else {
    sharedStatus.text = '$(check) Tailwind';
  }
}

function logLine(msg: string) {
  if (sharedOutput) {
    sharedOutput.appendLine(msg);
  }
}

function relOf(rootUri: vscode.Uri, uri: vscode.Uri): string | undefined {
  const root = rootUri.fsPath.toLowerCase();
  const p = uri.fsPath.toLowerCase();
  if (p !== root && p.indexOf(root + '\\') !== 0 && p.indexOf(root + '/') !== 0) {
    return undefined;
  }
  return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
}

function scheduleBuild(rootUri: vscode.Uri) {
  if (!autoBuildEnabled()) {
    return;
  }
  if (buildTimer) {
    clearTimeout(buildTimer);
  }
  buildTimer = setTimeout(() => {
    void buildNow(rootUri);
  }, 300);
}

function parseBuildError(msg: string, rootUri: vscode.Uri): { uri: vscode.Uri; line: number; col: number; text: string } | undefined {
  const m = /([A-Za-z]:[\\/][^\n:]+\.css|\S+\.css):(\d+):(\d+)/.exec(msg);
  if (!m) {
    return undefined;
  }
  const filePath = m[1];
  const line = Math.max(0, parseInt(m[2], 10) - 1);
  const col = Math.max(0, parseInt(m[3], 10) - 1);
  let uri: vscode.Uri;
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.charAt(0) === '/') {
    uri = vscode.Uri.file(filePath);
  } else {
    const clean = filePath.replace(/^\.\//, '');
    uri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
  }
  const text = msg.length > 500 ? msg.slice(0, 500) + '...' : msg;
  return { uri, line, col, text };
}

const scopedWarned = new Set<string>();

const diagBuffer: Map<string, vscode.Diagnostic[]> = new Map();

function bufferDiagnostic(uri: vscode.Uri, d: vscode.Diagnostic) {
  const key = uri.toString();
  const arr = diagBuffer.get(key);
  if (arr) {
    arr.push(d);
  } else {
    diagBuffer.set(key, [d]);
  }
}

function flushDiagnostics() {
  if (!diagCollection) {
    diagBuffer.clear();
    return;
  }
  diagBuffer.forEach((arr, key) => {
    const collection = diagCollection as vscode.DiagnosticCollection;
    collection.set(vscode.Uri.parse(key), arr);
  });
  diagBuffer.clear();
}

function cleanBuildMessage(msg: string): string {
  const reason = /reason:\s*'([^']+)'/.exec(msg);
  if (reason) {
    return reason[1];
  }
  const lines = msg.split('\n');
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) {
      continue;
    }
    if (/browserslist|caniuse|update-browserslist|why you should do it|rebuilding\.\.\.|^\s*at\s/i.test(t)) {
      continue;
    }
    if (/CssSyntaxError|SyntaxError/i.test(t)) {
      return t.slice(0, 300);
    }
  }
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) {
      continue;
    }
    if (/browserslist|caniuse|update-browserslist|why you should do it|rebuilding\.\.\.|^\s*at\s/i.test(t)) {
      continue;
    }
    return t.slice(0, 300);
  }
  return msg.slice(0, 200);
}

function reportBuildError(rootUri: vscode.Uri, msg: string) {
  const display = cleanBuildMessage(msg);
  const parsed = parseBuildError(msg, rootUri);
  if (parsed) {
    const range = new vscode.Range(parsed.line, parsed.col, parsed.line, parsed.col + 20);
    const d = new vscode.Diagnostic(range, 'Tailwind: ' + display, vscode.DiagnosticSeverity.Error);
    d.source = 'Tailwind Starter';
    bufferDiagnostic(parsed.uri, d);
    return;
  }
  const fallbackUri = vscode.Uri.joinPath(rootUri, 'input.css');
  const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 20), 'Tailwind build failed: ' + display, vscode.DiagnosticSeverity.Error);
  d.source = 'Tailwind Starter';
  bufferDiagnostic(fallbackUri, d);
}

function collectWarnings(rootUri: vscode.Uri, combined: string) {
  if (!diagCollection) {
    return;
  }
  const found: string[] = [];
  const lines = combined.split('\n');
  for (const ln of lines) {
    const t = ln.trim();
    if (/^warn(ing)?\b/i.test(t)) {
      const clean = t.replace(/^warn(ing)?\s*[-:]?\s*/i, '').trim();
      if (clean && found.indexOf(clean) === -1) {
        found.push(clean);
      }
    }
    if (found.length >= 5) {
      break;
    }
  }
  if (found.length === 0) {
    return;
  }
  const uri = vscode.Uri.joinPath(rootUri, 'input.css');
  const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 30), 'Tailwind: ' + found.join(' | '), vscode.DiagnosticSeverity.Warning);
  d.source = 'Tailwind Starter';
  bufferDiagnostic(uri, d);
}

function clearBuildErrors() {
  diagBuffer.clear();
  if (diagCollection) {
    diagCollection.clear();
  }
}

async function buildNow(rootUri: vscode.Uri): Promise<boolean> {
  clearBuildErrors();
  const plan = getBuildPlan();
  if (!(await fileExists(rootUri, plan[0].input))) {
    return false;
  }
  if (!(await isTailwindInstalled(rootUri))) {
    setStatus('error');
    vscode.window.showErrorMessage('Tailwind غير مثبت. شغل Tailwind Starter: Check & Fix Project.');
    return false;
  }
  if (building) {
    pendingBuild = true;
    return false;
  }
  building = true;
  setStatus('building');
  let okAll = true;
  try {
    for (const t of plan) {
      if (!(await fileExists(rootUri, t.input))) {
        logLine('Skip target, missing input: ' + t.input);
        continue;
      }
      const r = await runCapture(rootUri, 'npx tailwindcss -i "./' + t.input + '" -o "./' + t.output + '"');
      collectWarnings(rootUri, r.stdout + '\n' + r.stderr);
      if (r.ok) {
        logLine('Build OK [' + t.input + ' -> ' + t.output + ']: ' + new Date().toLocaleTimeString());
      } else {
        okAll = false;
        logLine('Build FAILED [' + t.input + ' -> ' + t.output + ']: ' + cleanBuildMessage(r.message));
        reportBuildError(rootUri, r.message);
      }
    }
    flushDiagnostics();
    setStatus(okAll ? 'ok' : 'error');
    if (!okAll) {
      if (!errorNotified) {
        errorNotified = true;
        vscode.window.showErrorMessage('فشل بناء Tailwind. افتح Output > Tailwind Starter.', 'Show log').then((sel) => {
          if (sel === 'Show log' && sharedOutput) {
            sharedOutput.show();
          }
        });
      }
    } else {
      errorNotified = false;
    }
    return okAll;
  } finally {
    building = false;
    if (pendingBuild) {
      pendingBuild = false;
      void buildNow(rootUri);
    }
  }
}

async function ensureHtmlLink(rootUri: vscode.Uri, fileUri: vscode.Uri): Promise<boolean> {
  const rel = relOf(rootUri, fileUri);
  if (!rel) {
    return false;
  }
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
  } catch {
    return false;
  }
  const correct = relativeHref(rel, 'style.css');
  const linkRe = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    const tag = m[0];
    if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) {
      continue;
    }
    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!hm) {
      continue;
    }
    const resolved = resolveHref(dirOf(rel), hm[1]).toLowerCase();
    if (resolved === 'output.css') {
      continue;
    }
    if (isGeneratedCss(resolved)) {
      return false;
    }
  }
  let updated = text;
  const outMatch = /<link\b[^>]*href\s*=\s*["']([^"']*output\.css[^"']*)["'][^>]*>/i.exec(text);
  if (outMatch && resolveHref(dirOf(rel), outMatch[1]).toLowerCase() === 'output.css') {
    updated = updated.replace(outMatch[1], correct);
  } else if (/<\/head\s*>/i.test(updated)) {
    updated = updated.replace(/<\/head\s*>/i, '  <link rel="stylesheet" href="' + correct + '">\n</head>');
  } else {
    return false;
  }
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(updated, 'utf8'));
  return true;
}

async function ensureCssWired(rootUri: vscode.Uri, fileUri: vscode.Uri, rel: string): Promise<boolean> {
  if (isPlanInput(rel) || isGeneratedCss(rel.toLowerCase())) {
    return false;
  }
  let text = '';
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
  } catch {
    return false;
  }
  if (text.indexOf(PAGE_SCOPED_MARK) !== -1) {
    if (/@apply\b/.test(text) && !scopedWarned.has(rel)) {
      scopedWarned.add(rel);
      vscode.window.showWarningMessage('ملف ' + rel + ' خاص بصفحة — @apply يحتاج البناء المشترك. احذف سطر page-scoped لجعله عاما.');
    }
    return false;
  }
  if (!/@(apply|tailwind|screen)\b/.test(text)) {
    return false;
  }
  await ensureInputCss(rootUri);
  if (await ensurePageImport(rootUri, rel)) {
    vscode.window.showInformationMessage('Tailwind Starter: imported ' + rel + ' into input.css');
    return true;
  }
  return false;
}

async function handleCreatedFile(rootUri: vscode.Uri, uri: vscode.Uri) {
  const rel = relOf(rootUri, uri);
  if (!rel || /node_modules/i.test(rel)) {
    return;
  }
  if (!(await ensureEngaged(rootUri, true))) {
    return;
  }
  const lower = rel.toLowerCase();
  if (isGeneratedCss(lower)) {
    return;
  }
  if (lower.endsWith('.html')) {
    if (autoFixEnabled() && (await ensureHtmlLink(rootUri, uri))) {
      vscode.window.showInformationMessage('Tailwind Starter: linked ' + rel + ' to style.css');
      scheduleBuild(rootUri);
    }
    return;
  }
  if (lower.endsWith('.css')) {
    if (await ensureCssWired(rootUri, uri, rel)) {
      scheduleBuild(rootUri);
    }
  }
}

async function handleDeletedFile(rootUri: vscode.Uri, uri: vscode.Uri) {
  const rel = relOf(rootUri, uri);
  if (!rel) {
    return;
  }
  if (!(await ensureEngaged(rootUri, true))) {
    return;
  }
  const lower = rel.toLowerCase();
  if (isGeneratedCss(lower)) {
    scheduleBuild(rootUri);
    return;
  }
  if (!lower.endsWith('.css')) {
    return;
  }
  if (await removePageImport(rootUri, rel)) {
    vscode.window.showInformationMessage('Tailwind Starter: removed deleted ' + rel + ' from input.css');
    scheduleBuild(rootUri);
  }
}

async function isTailwindProject(rootUri: vscode.Uri): Promise<boolean> {
  return (await fileExists(rootUri, 'tailwind.config.js')) || (await fileExists(rootUri, 'input.css'));
}

async function ensureEngaged(rootUri: vscode.Uri, allowInstall: boolean): Promise<boolean> {
  if (scaffolding) {
    return false;
  }
  if (autoEngaged || engaging) {
    return autoEngaged;
  }
  engaging = true;
  try {
    if (!(await isTailwindProject(rootUri))) {
      return false;
    }
    autoEngaged = true;
    if (allowInstall && !(await isTailwindInstalled(rootUri))) {
      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'جاري تثبيت Tailwind CSS...', cancellable: false },
          async () => {
            await runCommand(rootUri, 'npm install -D tailwindcss@3');
          }
        );
      } catch {
        autoEngaged = false;
        setStatus('error');
        if (!installErrorShown) {
          installErrorShown = true;
          vscode.window.showErrorMessage('فشل تثبيت Tailwind. شغل Check & Fix Project لاحقا.');
        }
        return false;
      }
    }
    await buildNow(rootUri);
    return true;
  } finally {
    engaging = false;
  }
}

async function startAutoMode(context: vscode.ExtensionContext, output: vscode.OutputChannel, status: vscode.StatusBarItem) {
  sharedOutput = output;
  sharedStatus = status;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }
  const rootUri = folders[0].uri;

  const saveSub = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (doc.uri.scheme !== 'file') {
      return;
    }
    const rel = relOf(rootUri, doc.uri);
    if (!rel || /node_modules/i.test(rel)) {
      return;
    }
    if (!(await ensureEngaged(rootUri, true))) {
      return;
    }
    const lower = rel.toLowerCase();
    if (isGeneratedCss(lower)) {
      return;
    }
    if (!/\.(html|css|js|jsx|ts|tsx)$/i.test(lower)) {
      return;
    }
    if (autoFixEnabled()) {
      if (lower.endsWith('.html')) {
        await ensureHtmlLink(rootUri, doc.uri);
      } else if (lower.endsWith('.css')) {
        await ensureCssWired(rootUri, doc.uri, rel);
      }
    }
    scheduleBuild(rootUri);
  });

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{html,css}', false, true, false);
  watcher.onDidCreate((uri) => {
    void handleCreatedFile(rootUri, uri);
  });
  watcher.onDidDelete((uri) => {
    void handleDeletedFile(rootUri, uri);
  });
  context.subscriptions.push(saveSub, watcher);

  await ensureEngaged(rootUri, true);
}

function getWatchTerminal(rootUri: vscode.Uri): vscode.Terminal {
  const existing = vscode.window.terminals.find((t) => t.name === 'Tailwind Watch');
  if (existing) {
    return existing;
  }
  return vscode.window.createTerminal({ name: 'Tailwind Watch', cwd: rootUri.fsPath });
}

interface CaptureResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  message: string;
}

function runCapture(cwd: vscode.Uri, command: string): Promise<CaptureResult> {
  return new Promise((resolve) => {
    exec(command, { cwd: cwd.fsPath, timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const out = String(stdout || '');
      const err = String(stderr || '');
      const message = (err + '\n' + (error ? error.message : '')).trim().slice(0, 2000);
      resolve({ ok: !error, stdout: out, stderr: err, message });
    });
  });
}

function runCommand(cwd: vscode.Uri, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: cwd.fsPath, timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message).slice(0, 2000)));
      } else {
        resolve(stdout);
      }
    });
  });
}
