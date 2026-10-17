import * as vscode from 'vscode';
import { state } from '../core/state';
import { isTailwindProject, isTailwindInstalled, detectProjectMajor } from '../tailwind/detect-vscode';
import { buildNow, scheduleBuild, autoFixEnabled } from '../tailwind/build';
import { isGeneratedCss, isPlanInput } from '../tailwind/plan';
import { currentPlan } from '../tailwind/targets';
import { removePageImport } from '../tailwind/imports-vscode';
import { watcher } from '../tailwind/watch';
import { ensureHtmlLink, ensureCssWired, asRelative } from '../tailwind/wire';
import { ensureTailwindInstalled } from '../commands/install';

const AUTO_SOURCE_EXT = /\.(html|css|js|jsx|ts|tsx)$/i;

export async function ensureEngaged(rootUri: vscode.Uri, allowInstall: boolean): Promise<boolean> {
  if (state.scaffolding) {
    return false;
  }
  if (state.autoEngaged || state.engaging) {
    return state.autoEngaged;
  }
  state.engaging = true;
  try {
    if (!(await isTailwindProject(rootUri))) {
      return false;
    }
    if (!vscode.workspace.isTrusted) {
      state.log('Workspace is not trusted: automatic install and builds are disabled.');
      return false;
    }
    state.autoEngaged = true;
    state.showStatus();
    if (allowInstall && !(await isTailwindInstalled(rootUri))) {
      try {
        await ensureTailwindInstalled(rootUri, await detectProjectMajor(rootUri));
      } catch {
        state.autoEngaged = false;
        state.setStatus('error');
        if (!state.installErrorShown) {
          state.installErrorShown = true;
          vscode.window.showErrorMessage('فشل تثبيت Tailwind. شغل Check & Fix Project لاحقا.');
        }
        return false;
      }
    }
    await buildNow(rootUri);
    return true;
  } finally {
    state.engaging = false;
  }
}

async function handleCreatedFile(rootUri: vscode.Uri, uri: vscode.Uri): Promise<void> {
  const rel = asRelative(uri);
  if (!rel || /node_modules/i.test(rel)) {
    return;
  }
  if (!(await ensureEngaged(rootUri, true))) {
    return;
  }
  const lower = rel.toLowerCase();
  const plan = currentPlan();
  if (isGeneratedCss(lower, plan)) {
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

async function handleDeletedFile(rootUri: vscode.Uri, uri: vscode.Uri): Promise<void> {
  const rel = asRelative(uri);
  if (!rel) {
    return;
  }
  if (!(await ensureEngaged(rootUri, true))) {
    return;
  }
  const lower = rel.toLowerCase();
  const plan = currentPlan();
  if (isGeneratedCss(lower, plan)) {
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

async function handleSaved(rootUri: vscode.Uri, doc: vscode.TextDocument): Promise<void> {
  if (doc.uri.scheme !== 'file') {
    return;
  }
  const rel = asRelative(doc.uri);
  if (!rel || /node_modules/i.test(rel)) {
    return;
  }
  if (!(await ensureEngaged(rootUri, true))) {
    return;
  }
  const lower = rel.toLowerCase();
  const plan = currentPlan();
  if (isGeneratedCss(lower, plan) || isPlanInput(rel, plan)) {
    scheduleBuild(rootUri);
    return;
  }
  if (!AUTO_SOURCE_EXT.test(lower)) {
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
}

export async function updateStatusVisibility(uri?: vscode.Uri): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    state.hideStatus();
    return;
  }
  const folder = uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
  const rootUri = (folder || folders[0]).uri;
  if (await isTailwindProject(rootUri)) {
    state.showStatus();
  } else {
    state.hideStatus();
  }
}

export function startAutoMode(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      if (folder) {
        void handleSaved(folder.uri, doc);
      }
    })
  );

  const createdWatcher = vscode.workspace.createFileSystemWatcher('**/*.{html,css}', false, true, false);
  createdWatcher.onDidCreate((uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    void handleCreatedFile(folder ? folder.uri : vscode.Uri.file(uri.fsPath), uri);
  });
  createdWatcher.onDidDelete((uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    void handleDeletedFile(folder ? folder.uri : vscode.Uri.file(uri.fsPath), uri);
  });
  context.subscriptions.push(createdWatcher);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void updateStatusVisibility(editor ? editor.document.uri : undefined);
    })
  );

  void updateStatusVisibility();
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    void ensureEngaged(folders[0].uri, true);
  }
}

export function stopAutoMode(): void {
  watcher.stop();
}
