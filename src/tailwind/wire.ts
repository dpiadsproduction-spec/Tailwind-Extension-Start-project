import * as vscode from 'vscode';
import { dirOf, relativeHref, resolveHref } from '../core/paths';
import { isGeneratedCss, isPlanInput } from './plan';
import { currentPlan } from './targets';
import { PAGE_SCOPED_MARK } from './imports';
import { ensureInputCss, ensurePageImport } from './imports-vscode';

const scopedWarned = new Set<string>();

export function asRelative(uri: vscode.Uri): string {
  return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
}

export async function ensureHtmlLink(_rootUri: vscode.Uri, fileUri: vscode.Uri): Promise<boolean> {
  const rel = asRelative(fileUri);
  if (!rel) {
    return false;
  }
  let text: string;
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
  } catch {
    return false;
  }
  const plan = currentPlan();
  const correct = relativeHref(rel, 'style.css');
  const linkRe = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    const tag = m[0];
    if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) {
      continue;
    }
    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!hm) {
      continue;
    }
    const resolved = resolveHref(dirOf(rel), hm[1]).toLowerCase();
    if (resolved === 'output.css') {
      continue;
    }
    if (isGeneratedCss(resolved, plan)) {
      return false;
    }
  }
  let updated = text;
  const outMatch = /<link\b[^>]*href\s*=\s*["']([^"']*output\.css[^"']*)["'][^>]*>/i.exec(text);
  if (outMatch && resolveHref(dirOf(rel), outMatch[1]).toLowerCase() === 'output.css') {
    updated = updated.replace(outMatch[1], correct);
  } else if (/<\/head\s*>/i.test(updated)) {
    updated = updated.replace(/<\/head\s*>/i, '  <link rel="stylesheet" href="' + correct + '">\n</head>');
  } else {
    return false;
  }
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(updated, 'utf8'));
  return true;
}

export async function ensureCssWired(rootUri: vscode.Uri, fileUri: vscode.Uri, rel: string): Promise<boolean> {
  const plan = currentPlan();
  if (isPlanInput(rel, plan) || isGeneratedCss(rel, plan)) {
    return false;
  }
  let text: string;
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
  } catch {
    return false;
  }
  if (text.indexOf(PAGE_SCOPED_MARK) !== -1) {
    if (/@apply\b/.test(text) && !scopedWarned.has(rel)) {
      scopedWarned.add(rel);
      vscode.window.showWarningMessage(
        'ملف ' + rel + ' خاص بصفحة — @apply يحتاج البناء المشترك. احذف سطر page-scoped لجعله عاما.'
      );
    }
    return false;
  }
  if (!/@(apply|tailwind|screen)\b/.test(text)) {
    return false;
  }
  await ensureInputCss(rootUri);
  if (await ensurePageImport(rootUri, rel)) {
    vscode.window.showInformationMessage('Tailwind Starter: imported ' + rel + ' into input.css');
    return true;
  }
  return false;
}
