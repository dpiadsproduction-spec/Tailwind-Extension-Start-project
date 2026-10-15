import * as vscode from 'vscode';
import { CleanEntry } from './entry';
import { filterEntries, sortEntries, skipTreePath } from './exclude';

export function getExplorerExclude(): string[] {
  const list = vscode.workspace.getConfiguration('tailwindStarter').get<string[]>('explorerExclude', []);
  return (list || []).map((s) => String(s).toLowerCase());
}

export class CleanExplorerProvider implements vscode.TreeDataProvider<CleanEntry> {
  private changeEmitter = new vscode.EventEmitter<CleanEntry | undefined | void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly rootUri: vscode.Uri) {}

  refresh(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: CleanEntry): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CleanEntry): Promise<CleanEntry[]> {
    const dirUri = element ? element.uri : this.rootUri;
    const depth = element ? element.depth + 1 : 0;
    let entries: Array<[string, vscode.FileType]>;
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return [];
    }
    const exclude = getExplorerExclude();
    const mapped = entries.map(([name, ftype]) => ({
      name,
      isDir: (ftype & vscode.FileType.Directory) !== 0
    }));
    const visible = sortEntries(filterEntries(mapped, exclude));
    return visible.map((e) => new CleanEntry(e.name, vscode.Uri.joinPath(dirUri, e.name), dirUri, e.isDir, depth));
  }
}

export function createTreeWatcher(onChange: () => void): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);
  let timer: NodeJS.Timeout | undefined;
  const queue = (uri: vscode.Uri) => {
    if (skipTreePath(uri.fsPath)) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(onChange, 300);
  };
  watcher.onDidCreate(queue);
  watcher.onDidDelete(queue);
  watcher.onDidChange(queue);
  return watcher;
}
