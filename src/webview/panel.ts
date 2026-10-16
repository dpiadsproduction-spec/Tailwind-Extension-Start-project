import * as vscode from 'vscode';
import { getWebviewHtml } from './html';
import { parseCreateData } from './parse';
import type { CreateData } from '../commands/scaffold';

export const CREATE_PROJECT_PANEL_VIEW = 'tailwindStarter';

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export interface CreateProjectPanelOptions {
  extensionUri: vscode.Uri;
  onCreate: (data: CreateData) => Promise<void>;
}

export function openCreateProjectPanel(
  context: vscode.ExtensionContext,
  options: CreateProjectPanelOptions
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    CREATE_PROJECT_PANEL_VIEW,
    'Create Tailwind Project',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [options.extensionUri],
      retainContextWhenHidden: true
    }
  );

  const nonce = createNonce();
  panel.webview.html = getWebviewHtml({ cspSource: panel.webview.cspSource, nonce });

  panel.webview.onDidReceiveMessage(
    async (message: unknown) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      const rec = message as Record<string, unknown>;
      if (rec.command !== 'createProject') {
        return;
      }
      const data = parseCreateData(rec.data);
      if (!data) {
        vscode.window.showErrorMessage('بيانات إنشاء المشروع غير صالحة.');
        return;
      }
      panel.dispose();
      await options.onCreate(data);
    },
    undefined,
    context.subscriptions
  );

  return panel;
}
