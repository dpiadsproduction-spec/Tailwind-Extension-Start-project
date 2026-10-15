import * as vscode from 'vscode';
import { CleanEntry } from './entry';
import { relOf } from './rels';

export function copyEntryRecursive(srcUri: vscode.Uri, destUri: vscode.Uri): Promise<void> {
  return (async () => {
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
  })();
}

export class CleanExplorerDnD implements vscode.TreeDragAndDropController<CleanEntry> {
  readonly dragMimeTypes: string[] = ['application/vnd.code.tree.cleanFilesView'];
  readonly dropMimeTypes: string[] = ['application/vnd.code.tree.cleanFilesView', 'text/uri-list'];

  constructor(private readonly rootUri: vscode.Uri, private readonly onMoved: (oldRel: string, newRel: string, isDir: boolean) => void) {}

  async handleDrag(source: readonly CleanEntry[], dataTransfer: vscode.DataTransfer): Promise<void> {
    const payload = JSON.stringify(source.map((s) => ({ u: s.uri.toString(), d: s.isDir })));
    dataTransfer.set('application/vnd.code.tree.cleanFilesView', new vscode.DataTransferItem(payload));
  }

  async handleDrop(target: CleanEntry | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
    const destDir = target ? (target.isDir ? target.uri : target.parentDir) : this.rootUri;

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
        const rel = relOf(this.rootUri, srcUri);
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
          // free -> move
        }
        try {
          await vscode.workspace.fs.rename(srcUri, dest, { overwrite: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage('تعذر النقل: ' + msg);
          continue;
        }
        const newRel = relOf(this.rootUri, dest);
        if (newRel) {
          this.onMoved(rel, newRel, it.d === true);
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
    const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '' && s.charAt(0) !== '#');
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
        // free -> copy
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
