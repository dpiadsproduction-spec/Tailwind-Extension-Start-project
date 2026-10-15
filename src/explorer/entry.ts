import * as vscode from 'vscode';

export class CleanEntry extends vscode.TreeItem {
  readonly entryName: string;
  readonly uri: vscode.Uri;
  readonly parentDir: vscode.Uri;
  readonly isDir: boolean;
  readonly depth: number;

  constructor(entryName: string, uri: vscode.Uri, parentDir: vscode.Uri, isDir: boolean, depth: number) {
    super(
      entryName,
      isDir
        ? depth === 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
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

export function entryDisplayName(node: CleanEntry): string {
  if (typeof node.label === 'string') {
    return node.label;
  }
  if (node.label) {
    return node.label.label;
  }
  return node.entryName;
}
