import * as vscode from 'vscode';
import { CleanEntry } from '../explorer/entry';
import { relOf } from '../explorer/rels';
import { linkAssetToPage, unlinkAssetFromPage, pickHtmlPage } from '../explorer/actions';
import { isGeneratedCss, isPlanInput } from '../tailwind/plan';
import { currentPlan } from '../tailwind/targets';
import { pickRootRemembering, folderUri } from '../workspace/workspace';

export const LINK_ASSET_COMMAND = 'tailwind-starter.linkToPage';
export const UNLINK_ASSET_COMMAND = 'tailwind-starter.unlinkFromPage';

async function pickAssetFile(rootUri: vscode.Uri): Promise<{ rel: string; kind: 'css' | 'js' } | undefined> {
  void rootUri;
  const files = await vscode.workspace.findFiles('**/*.{css,js}', '{**/node_modules/**,**/.git/**}');
  interface AssetPick extends vscode.QuickPickItem {
    rel: string;
    assetKind: 'css' | 'js';
  }
  const plan = currentPlan();
  const items: AssetPick[] = [];
  for (const f of files) {
    const rel = vscode.workspace.asRelativePath(f, false).replace(/\\/g, '/');
    if (!rel) {
      continue;
    }
    const lower = rel.toLowerCase();
    if (isGeneratedCss(lower, plan) || isPlanInput(rel, plan)) {
      continue;
    }
    const kind = lower.endsWith('.css') ? 'css' : 'js';
    items.push({ label: rel, description: kind === 'css' ? 'CSS' : 'JS', rel, assetKind: kind });
  }
  if (items.length === 0) {
    vscode.window.showErrorMessage('لا توجد ملفات CSS/JS قابلة للربط.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'اختر ملف CSS أو JS' });
  if (!picked) {
    return undefined;
  }
  return { rel: picked.rel, kind: picked.assetKind };
}

function nodeAsset(node: CleanEntry | undefined): { rel: string; kind: 'css' | 'js' } | undefined {
  if (!node || node.isDir) {
    return undefined;
  }
  const rel = vscode.workspace.asRelativePath(node.uri, false).replace(/\\/g, '/');
  const lower = rel.toLowerCase();
  if (lower.endsWith('.css')) {
    return { rel, kind: 'css' };
  }
  if (lower.endsWith('.js')) {
    return { rel, kind: 'js' };
  }
  return undefined;
}

async function resolveAsset(
  rootUri: vscode.Uri,
  node: CleanEntry | undefined
): Promise<{ rel: string; kind: 'css' | 'js' } | undefined> {
  const fromNode = nodeAsset(node);
  if (fromNode && relOf(rootUri, node!.uri) !== undefined) {
    return fromNode;
  }
  return pickAssetFile(rootUri);
}

export async function runLinkAsset(context: vscode.ExtensionContext, node?: CleanEntry): Promise<void> {
  const root = await pickRootRemembering(context, node ? node.uri : undefined, 'اختر المشروع');
  if (!root) {
    return;
  }
  const rootUri = folderUri(root);
  const asset = await resolveAsset(rootUri, node);
  if (!asset) {
    return;
  }
  const pageRel = await pickHtmlPage(rootUri);
  if (!pageRel) {
    return;
  }
  await linkAssetToPage(rootUri, asset.rel, pageRel, asset.kind);
}

export async function runUnlinkAsset(context: vscode.ExtensionContext, node?: CleanEntry): Promise<void> {
  const root = await pickRootRemembering(context, node ? node.uri : undefined, 'اختر المشروع');
  if (!root) {
    return;
  }
  const rootUri = folderUri(root);
  const asset = await resolveAsset(rootUri, node);
  if (!asset) {
    return;
  }
  const pageRel = await pickHtmlPage(rootUri);
  if (!pageRel) {
    return;
  }
  await unlinkAssetFromPage(rootUri, asset.rel, pageRel);
}
