import * as vscode from 'vscode';
import { CleanExplorerProvider, createTreeWatcher } from './provider';
import { CleanExplorerDnD } from './dnd';
import { CleanEntry } from './entry';
import {
  createExplorerEntry,
  deleteExplorerEntries,
  renameExplorerEntry,
  relinkMovedCss,
  resyncMovedDir
} from './actions';

export interface ExplorerHandle {
  provider: CleanExplorerProvider;
  view: vscode.TreeView<CleanEntry>;
  refresh: () => void;
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
  const refresh = () => provider.refresh();

  const disposables: vscode.Disposable[] = [
    view,
    watcher,
    vscode.commands.registerCommand('tailwind-starter.refreshExplorer', refresh),
    vscode.commands.registerCommand('tailwind-starter.newFile', (node?: CleanEntry) => {
      void createExplorerEntry(node, false, rootUri);
    }),
    vscode.commands.registerCommand('tailwind-starter.newFolder', (node?: CleanEntry) => {
      void createExplorerEntry(node, true, rootUri);
    }),
    vscode.commands.registerCommand('tailwind-starter.deleteEntry', (node?: CleanEntry) => {
      const targets = view.selection && view.selection.length > 0 ? Array.from(view.selection) : node ? [node] : [];
      void deleteExplorerEntries(targets, rootUri);
    }),
    vscode.commands.registerCommand('tailwind-starter.renameEntry', (node?: CleanEntry) => {
      void renameExplorerEntry(node, rootUri);
    })
  ];

  return { provider, view, refresh };
}
