import * as vscode from 'vscode';
import { readTextFile, writeFile, fileExists } from '../core/fs-util';
import {
  MANAGED_MARK,
  addManagedImport,
  removeManagedImport,
  removeImportsUnder,
  isTailwindPowered,
  hasPageScopedMark
} from './imports';
import { inputCssTemplate } from './templates';
import { createAdapter } from './adapter';
import { detectProjectMajor } from './detect-vscode';

export async function ensureInputCss(rootUri: vscode.Uri): Promise<void> {
  if (await fileExists(rootUri, 'input.css')) {
    return;
  }
  const adapter = createAdapter(await detectProjectMajor(rootUri));
  await writeFile(rootUri, 'input.css', inputCssTemplate(adapter.entryDirectives()));
}

export async function ensurePageImport(rootUri: vscode.Uri, cssRel: string): Promise<boolean> {
  const current = (await readTextFile(rootUri, 'input.css')) || '';
  const updated = addManagedImport(current, cssRel);
  if (updated === current) {
    return false;
  }
  await writeFile(rootUri, 'input.css', updated);
  return true;
}

export async function removePageImport(rootUri: vscode.Uri, cssRel: string): Promise<boolean> {
  const current = await readTextFile(rootUri, 'input.css');
  if (current === undefined) {
    return false;
  }
  const updated = removeManagedImport(current, cssRel);
  if (updated === current) {
    return false;
  }
  await writeFile(rootUri, 'input.css', updated);
  return true;
}

export async function removeImportsUnderDir(rootUri: vscode.Uri, dirRel: string): Promise<boolean> {
  const current = await readTextFile(rootUri, 'input.css');
  if (current === undefined) {
    return false;
  }
  const updated = removeImportsUnder(current, dirRel);
  if (updated === current) {
    return false;
  }
  await writeFile(rootUri, 'input.css', updated);
  return true;
}

export async function isPageScoped(rootUri: vscode.Uri, rel: string): Promise<boolean> {
  const text = await readTextFile(rootUri, rel);
  return text !== undefined && hasPageScopedMark(text);
}

export { MANAGED_MARK, isTailwindPowered, hasPageScopedMark };
