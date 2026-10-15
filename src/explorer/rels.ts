import * as vscode from 'vscode';

export function relOf(rootUri: vscode.Uri, uri: vscode.Uri): string | undefined {
  const root = rootUri.fsPath.toLowerCase();
  const p = uri.fsPath.toLowerCase();
  if (p !== root && p.indexOf(root + '\\') !== 0 && p.indexOf(root + '/') !== 0) {
    return undefined;
  }
  return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
}
