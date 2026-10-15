import * as vscode from 'vscode';
import { runChecked } from '../tailwind/runner';
import { isTailwindInstalled } from '../tailwind/detect-vscode';

export function installArgs(major: 3 | 4): string[] {
  return major === 4
    ? ['install', '-D', 'tailwindcss@4', '@tailwindcss/cli@4']
    : ['install', '-D', 'tailwindcss@3'];
}

export async function installTailwind(rootUri: vscode.Uri, major: 3 | 4): Promise<void> {
  await runChecked('npm', installArgs(major), { cwd: rootUri.fsPath, timeoutMs: 600000 });
}

export async function ensureTailwindInstalled(rootUri: vscode.Uri, major: 3 | 4): Promise<boolean> {
  if (await isTailwindInstalled(rootUri)) {
    return true;
  }
  await installTailwind(rootUri, major);
  return isTailwindInstalled(rootUri);
}
