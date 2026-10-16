import * as vscode from 'vscode';
import { readTextFile } from '../core/fs-util';
import { hasManagedImport, hasPageScopedMark } from '../tailwind/imports';
import { isPlanInput } from '../tailwind/plan';
import { currentPlan } from '../tailwind/targets';
import { detectProjectMajor, isTailwindProject } from '../tailwind/detect-vscode';
import { ensureInputCss, ensurePageImport } from '../tailwind/imports-vscode';
import { scheduleBuild } from '../tailwind/build';
import {
  analyzeCss,
  addReference,
  convertToV4Entry,
  convertToV3Entry,
  type LiveContext,
  type LiveIssue
} from './live-rules';

export const LIVE_SOURCE = 'Tailwind Starter';
export const LINK_FILE_TO_BUILD_COMMAND = 'tailwind-starter.linkFileToBuild';

const DEBOUNCE_MS = 250;

function isCssDocument(doc: vscode.TextDocument): boolean {
  return doc.uri.scheme === 'file' && (doc.languageId === 'css' || doc.fileName.toLowerCase().endsWith('.css'));
}

async function buildContext(doc: vscode.TextDocument, rootUri: vscode.Uri): Promise<LiveContext> {
  const rel = vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
  const plan = currentPlan();
  const inputText = (await readTextFile(rootUri, 'input.css')) || '';
  const text = doc.getText();
  return {
    major: await detectProjectMajor(rootUri),
    inSharedBundle: isPlanInput(rel, plan) || hasManagedImport(inputText, rel),
    isPageScoped: hasPageScopedMark(text)
  };
}

function toDiagnostics(doc: vscode.TextDocument, issues: LiveIssue[]): vscode.Diagnostic[] {
  const out: vscode.Diagnostic[] = [];
  const lastLine = Math.max(0, doc.lineCount - 1);
  for (const issue of issues) {
    const line = Math.min(Math.max(0, issue.line), lastLine);
    const lineText = doc.lineAt(line).text;
    const range = new vscode.Range(line, 0, line, Math.max(1, lineText.length));
    const severity = issue.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
    const diag = new vscode.Diagnostic(range, issue.message, severity);
    diag.source = LIVE_SOURCE;
    diag.code = issue.code;
    out.push(diag);
  }
  return out;
}

export class TailwindLiveCodeActions implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source !== LIVE_SOURCE) {
        continue;
      }
      const code = typeof diag.code === 'string' ? diag.code : '';
      if (code === 'apply-needs-reference') {
        const action = new vscode.CodeAction('إضافة @reference "tailwindcss"', vscode.CodeActionKind.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange(document), addReference(document.getText()));
        action.edit = edit;
        action.diagnostics = [diag];
        action.isPreferred = true;
        actions.push(action);
      } else if (code === 'apply-page-scoped') {
        const action = new vscode.CodeAction(
          'ربط هذا الملف بالبناء (استيراد في input.css)',
          vscode.CodeActionKind.QuickFix
        );
        action.command = {
          command: LINK_FILE_TO_BUILD_COMMAND,
          title: 'ربط الملف بالبناء',
          arguments: [document.uri]
        };
        action.diagnostics = [diag];
        actions.push(action);
      } else if (code === 'directive-v3-in-v4') {
        const action = new vscode.CodeAction('تحويل إلى صيغة Tailwind v4', vscode.CodeActionKind.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange(document), convertToV4Entry(document.getText()));
        action.edit = edit;
        action.diagnostics = [diag];
        actions.push(action);
      } else if (code === 'directive-v4-in-v3') {
        const action = new vscode.CodeAction('تحويل إلى صيغة Tailwind v3', vscode.CodeActionKind.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange(document), convertToV3Entry(document.getText()));
        action.edit = edit;
        action.diagnostics = [diag];
        actions.push(action);
      }
    }
    return actions;
  }
}

function fullRange(document: vscode.TextDocument): vscode.Range {
  const last = Math.max(0, document.lineCount - 1);
  return new vscode.Range(0, 0, last, document.lineAt(last).text.length);
}

export function registerLiveDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('tailwind-starter-live');
  const timers = new Map<string, NodeJS.Timeout>();

  const analyze = async (doc: vscode.TextDocument): Promise<void> => {
    if (!isCssDocument(doc)) {
      return;
    }
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!folder) {
      collection.delete(doc.uri);
      return;
    }
    if (!(await isTailwindProject(folder.uri))) {
      collection.delete(doc.uri);
      return;
    }
    const ctx = await buildContext(doc, folder.uri);
    const issues = analyzeCss(doc.getText(), ctx);
    if (issues.length === 0) {
      collection.delete(doc.uri);
      return;
    }
    collection.set(doc.uri, toDiagnostics(doc, issues));
  };

  const schedule = (doc: vscode.TextDocument): void => {
    if (!isCssDocument(doc)) {
      return;
    }
    const key = doc.uri.toString();
    const existing = timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void analyze(doc);
      }, DEBOUNCE_MS)
    );
  };

  const linkCommand = vscode.commands.registerCommand(LINK_FILE_TO_BUILD_COMMAND, async (uri?: vscode.Uri) => {
    if (!uri) {
      return;
    }
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return;
    }
    const rel = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
    await ensureInputCss(folder.uri);
    const added = await ensurePageImport(folder.uri, rel);
    if (added) {
      vscode.window.showInformationMessage('تم ربط الملف بالبناء: ' + rel);
      scheduleBuild(folder.uri);
    } else {
      vscode.window.showInformationMessage('الملف مربوط بالبناء مسبقا: ' + rel);
    }
  });

  context.subscriptions.push(
    collection,
    linkCommand,
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'css', scheme: 'file' },
        { language: 'scss', scheme: 'file' },
        { language: 'less', scheme: 'file' }
      ],
      new TailwindLiveCodeActions(),
      { providedCodeActionKinds: TailwindLiveCodeActions.providedCodeActionKinds }
    ),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc) => schedule(doc)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        schedule(editor.document);
      }
    })
  );

  for (const doc of vscode.workspace.textDocuments) {
    schedule(doc);
  }
}
