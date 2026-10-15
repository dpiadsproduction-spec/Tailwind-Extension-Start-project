import * as vscode from 'vscode';
import { readTextFile, writeFile } from '../core/fs-util';
import type { TailwindAdapter } from '../tailwind/adapter';
import { configTemplate } from '../tailwind/templates';

export function watchScript(adapter: TailwindAdapter, input = 'input.css', output = 'style.css'): string {
  return 'npx ' + adapter.cliPackage() + ' -i ./' + input + ' -o ./' + output + ' --watch';
}

export async function ensurePackageJson(rootUri: vscode.Uri, adapter: TailwindAdapter): Promise<void> {
  const existing = await readTextFile(rootUri, 'package.json');
  if (existing !== undefined) {
    return;
  }
  const content = JSON.stringify(
    {
      name: 'tailwind-project',
      version: '1.0.0',
      scripts: { watch: watchScript(adapter) }
    },
    null,
    2
  );
  await writeFile(rootUri, 'package.json', content);
}

async function readJsonObject(rootUri: vscode.Uri, rel: string): Promise<Record<string, unknown> | undefined> {
  const text = await readTextFile(rootUri, rel);
  if (text === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function ensureVscodeSettings(rootUri: vscode.Uri): Promise<void> {
  const dirUri = vscode.Uri.joinPath(rootUri, '.vscode');
  await vscode.workspace.fs.createDirectory(dirUri);
  const settingsUri = vscode.Uri.joinPath(dirUri, 'settings.json');
  const settings = (await readJsonObject(rootUri, '.vscode/settings.json')) || {};
  settings['css.lint.unknownAtRules'] = 'ignore';
  settings['scss.lint.unknownAtRules'] = 'ignore';
  settings['less.lint.unknownAtRules'] = 'ignore';
  await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(JSON.stringify(settings, null, 2), 'utf8'));
}

export async function ensureWatchScript(rootUri: vscode.Uri, adapter: TailwindAdapter): Promise<boolean> {
  const data = await readJsonObject(rootUri, 'package.json');
  if (data === undefined) {
    return false;
  }
  const scripts = (data.scripts as Record<string, unknown> | undefined) || {};
  if (typeof scripts.watch === 'string') {
    return false;
  }
  scripts.watch = watchScript(adapter);
  data.scripts = scripts;
  await writeFile(rootUri, 'package.json', JSON.stringify(data, null, 2));
  return true;
}

export async function ensureTailwindConfig(
  rootUri: vscode.Uri,
  adapter: TailwindAdapter,
  globs: string[]
): Promise<boolean> {
  if (!adapter.usesJsConfig()) {
    return false;
  }
  const existing = await readTextFile(rootUri, 'tailwind.config.js');
  if (existing === undefined) {
    await writeFile(rootUri, 'tailwind.config.js', configTemplate(globs));
    return true;
  }
  if (existing.indexOf('**/*.{html') !== -1) {
    return false;
  }
  const list = globs.map((g) => '"' + g + '"').join(', ');
  const replaced = existing.replace(/content\s*:\s*\[[^\]]*\]/s, 'content: [' + list + ']');
  if (replaced === existing) {
    return false;
  }
  await writeFile(rootUri, 'tailwind.config.js', replaced);
  return true;
}

export async function addTargetSetting(rootUri: vscode.Uri, input: string, output: string): Promise<boolean> {
  const dirUri = vscode.Uri.joinPath(rootUri, '.vscode');
  await vscode.workspace.fs.createDirectory(dirUri);
  const settingsUri = vscode.Uri.joinPath(dirUri, 'settings.json');
  const settings = (await readJsonObject(rootUri, '.vscode/settings.json')) || {};
  const raw = settings['tailwindStarter.targets'];
  const arr = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
  for (const t of arr) {
    if (t && typeof t.input === 'string' && t.input.toLowerCase() === input.toLowerCase()) {
      return false;
    }
  }
  arr.push({ input, output });
  settings['tailwindStarter.targets'] = arr;
  await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(JSON.stringify(settings, null, 2), 'utf8'));
  return true;
}
