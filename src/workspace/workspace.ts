import * as vscode from 'vscode';
import { matchRoot, type RootInfo } from './roots';

const LAST_ROOT_KEY = 'tailwindStarter.lastRoot';

export function listRoots(): RootInfo[] {
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.map((f) => ({ name: f.name, fsPath: f.uri.fsPath }));
}

export function folderUri(info: RootInfo): vscode.Uri {
  const folders = vscode.workspace.workspaceFolders || [];
  const found = folders.find((f) => f.uri.fsPath === info.fsPath);
  return found ? found.uri : vscode.Uri.file(info.fsPath);
}

export function activeRoot(uri?: vscode.Uri): RootInfo | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  if (uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      return { name: folder.name, fsPath: folder.uri.fsPath };
    }
    const matched = matchRoot(
      folders.map((f) => ({ name: f.name, fsPath: f.uri.fsPath })),
      uri.fsPath
    );
    if (matched) {
      return matched;
    }
  }
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme === 'file') {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) {
      return { name: folder.name, fsPath: folder.uri.fsPath };
    }
  }
  return { name: folders[0].name, fsPath: folders[0].uri.fsPath };
}

export interface RootPick extends vscode.QuickPickItem {
  root: RootInfo;
}

export async function pickRoot(placeHolder = 'اختر المشروع'): Promise<RootInfo | undefined> {
  const roots = listRoots();
  if (roots.length === 0) {
    vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
    return undefined;
  }
  if (roots.length === 1) {
    return roots[0];
  }
  const items: RootPick[] = roots.map((root) => ({
    label: root.name,
    description: root.fsPath,
    root
  }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder });
  return picked ? picked.root : undefined;
}

export async function pickRootRemembering(
  context: vscode.ExtensionContext,
  uri?: vscode.Uri,
  placeHolder = 'اختر المشروع'
): Promise<RootInfo | undefined> {
  const roots = listRoots();
  if (roots.length <= 1) {
    return roots[0];
  }
  if (uri) {
    const inferred = activeRoot(uri);
    if (inferred) {
      await context.workspaceState.update(LAST_ROOT_KEY, inferred.fsPath);
      return inferred;
    }
  }
  const picked = await pickRoot(placeHolder);
  if (picked) {
    await context.workspaceState.update(LAST_ROOT_KEY, picked.fsPath);
  }
  return picked;
}

export function rememberedRoot(context: vscode.ExtensionContext): RootInfo | undefined {
  const lastFsPath = context.workspaceState.get<string>(LAST_ROOT_KEY);
  if (!lastFsPath) {
    return undefined;
  }
  return listRoots().find((r) => r.fsPath === lastFsPath);
}
