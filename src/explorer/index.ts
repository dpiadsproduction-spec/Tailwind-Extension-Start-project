import * as vscode from 'vscode';
import { CleanExplorerProvider, createTreeWatcher } from './provider';
import { CleanExplorerDnD } from './dnd';
import { CleanEntry } from './entry';
import { relinkMovedCss, resyncMovedDir } from './actions';

export interface ExplorerHandle {
  provider: CleanExplorerProvider;
  view: vscode.TreeView<CleanEntry>;
  rootUri: vscode.Uri;
  refresh: () => void;
  dispose: () => void;
}

export function setupExplorer(rootUri: vscode.Uri): ExplorerHandle {
  const provider = new CleanExplorerProvider(rootUri);

  const dnd = new CleanExplorerDnD(rootUri, (oldRel, newRel, isDir) => {
    void (async () => {
      if (isDir) {
        await resyncMovedDir(rootUri, oldRel, newRel);
      } else if (oldRel.toLowerCase().endsWith('.css')) {
        await relinkMovedCss(rootUri, oldRel, newRel);
      }
    })();
  });

  const view = vscode.window.createTreeView('cleanFilesView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: true,
    dragAndDropController: dnd
  });

  const watcher = createTreeWatcher(() => provider.refresh());
  let disposed = false;

  return {
    provider,
    view,
    rootUri,
    refresh: () => provider.refresh(),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      watcher.dispose();
      view.dispose();
    }
  };
}
