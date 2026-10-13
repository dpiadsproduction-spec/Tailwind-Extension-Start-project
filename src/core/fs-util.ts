import * as vscode from 'vscode';
import { sanitizeRelPath } from './paths';

export async function fileExistsUri(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function fileExists(rootUri: vscode.Uri, relPath: string): Promise<boolean> {
  const clean = sanitizeRelPath(relPath);
  if (!clean) {
    return false;
  }
  return fileExistsUri(vscode.Uri.joinPath(rootUri, ...clean.split('/')));
}

export async function readTextFile(rootUri: vscode.Uri, relPath: string): Promise<string | undefined> {
  const clean = sanitizeRelPath(relPath);
  if (!clean) {
    return undefined;
  }
  try {
    const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, ...clean.split('/')));
    return Buffer.from(raw).toString('utf8');
  } catch {
    return undefined;
  }
}

export async function writeFile(rootUri: vscode.Uri, relPath: string, content: string): Promise<void> {
  const clean = sanitizeRelPath(relPath);
  if (!clean) {
    throw new Error('Invalid path: ' + relPath);
  }
  const uri = vscode.Uri.joinPath(rootUri, ...clean.split('/'));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

export async function createFileIfMissing(rootUri: vscode.Uri, relPath: string, content: string): Promise<boolean> {
  if (await fileExists(rootUri, relPath)) {
    return false;
  }
  const parts = sanitizeRelPath(relPath).split('/');
  parts.pop();
  if (parts.length > 0) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, ...parts));
  }
  await writeFile(rootUri, relPath, content);
  return true;
}
