import * as vscode from 'vscode';
import { readTextFile, fileExists } from '../core/fs-util';
import { detectMajor } from './detect';

async function readJson(rootUri: vscode.Uri, rel: string): Promise<Record<string, unknown> | undefined> {
  const text = await readTextFile(rootUri, rel);
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function installedMajor(rootUri: vscode.Uri): Promise<3 | 4 | undefined> {
  if (await fileExists(rootUri, 'node_modules/@tailwindcss/cli/package.json')) {
    return 4;
  }
  const pkg = await readJson(rootUri, 'node_modules/tailwindcss/package.json');
  if (pkg && typeof pkg.version === 'string') {
    const major = parseInt(pkg.version.split('.')[0], 10);
    if (major === 3 || major === 4) {
      return major;
    }
  }
  return undefined;
}

export async function isTailwindInstalled(rootUri: vscode.Uri): Promise<boolean> {
  return (await installedMajor(rootUri)) !== undefined;
}

export async function detectProjectMajor(rootUri: vscode.Uri, fallback: 3 | 4 = 4): Promise<3 | 4> {
  const major = await installedMajor(rootUri);
  const inputCss = (await readTextFile(rootUri, 'input.css')) || '';
  return detectMajor({
    hasV4Cli: major === 4,
    tailwindMajor: major,
    cssText: inputCss,
    fallback
  });
}

export async function isTailwindProject(rootUri: vscode.Uri): Promise<boolean> {
  const hasConfig = await fileExists(rootUri, 'tailwind.config.js');
  const hasInput = await fileExists(rootUri, 'input.css');
  return hasConfig || hasInput;
}
