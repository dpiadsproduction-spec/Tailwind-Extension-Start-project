import * as vscode from 'vscode';
import { state } from '../core/state';
import { parseBuildError, cleanBuildMessage, collectWarnings } from './parse';

let buffer = new Map<string, vscode.Diagnostic[]>();

export function beginBuildDiagnostics(): void {
  buffer = new Map();
}

function bufferDiagnostic(uri: vscode.Uri, d: vscode.Diagnostic): void {
  const key = uri.toString();
  const arr = buffer.get(key);
  if (arr) {
    arr.push(d);
  } else {
    buffer.set(key, [d]);
  }
}

export function reportBuildError(rootUri: vscode.Uri, msg: string): void {
  const display = cleanBuildMessage(msg);
  const parsed = parseBuildError(msg);
  if (parsed) {
    const range = new vscode.Range(parsed.line, parsed.col, parsed.line, parsed.col + 20);
    const d = new vscode.Diagnostic(range, 'Tailwind: ' + display, vscode.DiagnosticSeverity.Error);
    d.source = 'Tailwind Starter';
    let uri: vscode.Uri;
    if (/^[A-Za-z]:[\\/]/.test(parsed.file) || parsed.file.charAt(0) === '/') {
      uri = vscode.Uri.file(parsed.file);
    } else {
      const clean = parsed.file.replace(/^\.\//, '');
      uri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
    }
    bufferDiagnostic(uri, d);
    return;
  }
  const fallbackUri = vscode.Uri.joinPath(rootUri, 'input.css');
  const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 20), 'Tailwind build failed: ' + display, vscode.DiagnosticSeverity.Error);
  d.source = 'Tailwind Starter';
  bufferDiagnostic(fallbackUri, d);
}

export function collectBuildWarnings(rootUri: vscode.Uri, combined: string): void {
  const found = collectWarnings(combined);
  if (found.length === 0) {
    return;
  }
  const uri = vscode.Uri.joinPath(rootUri, 'input.css');
  const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 30), 'Tailwind: ' + found.join(' | '), vscode.DiagnosticSeverity.Warning);
  d.source = 'Tailwind Starter';
  bufferDiagnostic(uri, d);
}

export function flushBuildDiagnostics(): void {
  if (!state.diagnostics) {
    return;
  }
  state.diagnostics.clear();
  buffer.forEach((arr, key) => {
    state.diagnostics.set(vscode.Uri.parse(key), arr);
  });
  buffer = new Map();
}

export function clearBuildDiagnostics(): void {
  buffer = new Map();
  if (state.diagnostics) {
    state.diagnostics.clear();
  }
}
