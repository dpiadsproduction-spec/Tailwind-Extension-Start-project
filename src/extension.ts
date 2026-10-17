import * as vscode from 'vscode';
import { state } from './core/state';
import { setupExplorer, type ExplorerHandle } from './explorer';
import { CleanEntry } from './explorer/entry';
import { createExplorerEntry, deleteExplorerEntries, renameExplorerEntry } from './explorer/actions';
import { registerLiveDiagnostics } from './diagnostics/provider';
import { runCreateProject } from './commands/create-project';
import { runCreatePage } from './commands/create-page';
import { runCheckProject } from './commands/check-project';
import { runLinkAsset, runUnlinkAsset } from './commands/link-asset';
import { runUpgrade } from './commands/upgrade';
import { openCreateProjectPanel } from './webview/panel';
import { startAutoMode, updateStatusVisibility } from './workspace/auto';
import { watcher } from './tailwind/watch';
import { buildNow } from './tailwind/build';
import { activeRoot, folderUri } from './workspace/workspace';

let explorer: ExplorerHandle | undefined;

function explorerRoot(): vscode.Uri | undefined {
  if (explorer) {
    return explorer.rootUri;
  }
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri : undefined;
}

function requireExplorerRoot(): vscode.Uri | undefined {
  const root = explorerRoot();
  if (!root) {
    vscode.window.showErrorMessage('افتح مجلدا أولا. / Please open a folder first.');
  }
  return root;
}

function bindExplorer(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  const rootUri = folders && folders.length > 0 ? folders[0].uri : undefined;
  if (!rootUri) {
    return;
  }
  if (explorer && explorer.rootUri.fsPath === rootUri.fsPath) {
    return;
  }
  explorer?.dispose();
  explorer = setupExplorer(rootUri);
  context.subscriptions.push(explorer.view);
}

export function activate(context: vscode.ExtensionContext): void {
  state.init(context);
  registerLiveDiagnostics(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('tailwind-starter.createProject', () => {
      openCreateProjectPanel(context, {
        extensionUri: context.extensionUri,
        onCreate: (data) => runCreateProject(context, data)
      });
    }),
    vscode.commands.registerCommand('tailwind-starter.createPage', (node?: CleanEntry) => runCreatePage(context, node)),
    vscode.commands.registerCommand('tailwind-starter.checkProject', () => runCheckProject(context)),
    vscode.commands.registerCommand('tailwind-starter.rebuildNow', () => {
      const root = activeRoot();
      return root ? buildNow(folderUri(root)) : undefined;
    }),
    vscode.commands.registerCommand('tailwind-starter.linkToPage', (node?: CleanEntry) => runLinkAsset(context, node)),
    vscode.commands.registerCommand('tailwind-starter.unlinkFromPage', (node?: CleanEntry) =>
      runUnlinkAsset(context, node)
    ),
    vscode.commands.registerCommand('tailwind-starter.startWatch', () => {
      const root = activeRoot();
      return root ? watcher.start(folderUri(root)) : undefined;
    }),
    vscode.commands.registerCommand('tailwind-starter.stopWatch', () => watcher.stop()),
    vscode.commands.registerCommand('tailwind-starter.upgradeToV4', () => runUpgrade(context)),
    vscode.commands.registerCommand('tailwind-starter.refreshExplorer', () => explorer?.refresh()),
    vscode.commands.registerCommand('tailwind-starter.newFile', (node?: CleanEntry) => {
      const root = requireExplorerRoot();
      if (root) {
        void createExplorerEntry(node, false, root);
      }
    }),
    vscode.commands.registerCommand('tailwind-starter.newFolder', (node?: CleanEntry) => {
      const root = requireExplorerRoot();
      if (root) {
        void createExplorerEntry(node, true, root);
      }
    }),
    vscode.commands.registerCommand('tailwind-starter.deleteEntry', (node?: CleanEntry) => {
      const root = requireExplorerRoot();
      if (!root) {
        return;
      }
      const selection = explorer && explorer.view.selection && explorer.view.selection.length > 0
        ? Array.from(explorer.view.selection)
        : node
          ? [node]
          : [];
      void deleteExplorerEntries(selection, root);
    }),
    vscode.commands.registerCommand('tailwind-starter.renameEntry', (node?: CleanEntry) => {
      const root = requireExplorerRoot();
      if (root) {
        void renameExplorerEntry(node, root);
      }
    })
  );

  bindExplorer(context);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      bindExplorer(context);
      void updateStatusVisibility();
    })
  );

  startAutoMode(context);
}

export function deactivate(): void {
  watcher.stop();
  explorer?.dispose();
  explorer = undefined;
  state.dispose();
}
