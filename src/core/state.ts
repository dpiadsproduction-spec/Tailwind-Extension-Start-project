import * as vscode from 'vscode';

export type StatusState = 'ok' | 'building' | 'error';

export class ExtensionState {
  output!: vscode.OutputChannel;
  status!: vscode.StatusBarItem;
  diagnostics!: vscode.DiagnosticCollection;

  building = false;
  pendingBuild = false;
  errorNotified = false;
  autoEngaged = false;
  engaging = false;
  scaffolding = false;
  installErrorShown = false;
  buildTimer: NodeJS.Timeout | undefined;

  private statusVisible = false;

  init(context: vscode.ExtensionContext): void {
    this.output = vscode.window.createOutputChannel('Tailwind Starter');
    this.diagnostics = vscode.languages.createDiagnosticCollection('tailwind-starter');
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = 'tailwind-starter.rebuildNow';
    this.status.text = '$(check) Tailwind';
    this.status.tooltip = 'Tailwind Starter: اضغط لإعادة البناء';
    context.subscriptions.push(this.output, this.diagnostics, this.status);
  }

  setStatus(state: StatusState): void {
    if (!this.status) {
      return;
    }
    if (state === 'building') {
      this.status.text = '$(sync~spin) Tailwind';
    } else if (state === 'error') {
      this.status.text = '$(error) Tailwind';
    } else {
      this.status.text = '$(check) Tailwind';
    }
  }

  showStatus(): void {
    if (this.status && !this.statusVisible) {
      this.status.show();
      this.statusVisible = true;
    }
  }

  hideStatus(): void {
    if (this.status && this.statusVisible) {
      this.status.hide();
      this.statusVisible = false;
    }
  }

  log(msg: string): void {
    if (this.output) {
      this.output.appendLine(msg);
    }
  }

  dispose(): void {
    if (this.buildTimer) {
      clearTimeout(this.buildTimer);
      this.buildTimer = undefined;
    }
  }
}

export const state = new ExtensionState();
