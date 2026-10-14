import * as vscode from 'vscode';
import { state } from '../core/state';
import { fileExists } from '../core/fs-util';
import { createAdapter } from './adapter';
import { detectProjectMajor } from './detect-vscode';
import { currentPlan } from './targets';
import { spawnStreaming, type ManagedProcess } from './runner';
import type { BuildTarget } from './plan';

class ManagedWatcher {
  private running: ManagedProcess[] = [];
  private active = false;

  get isRunning(): boolean {
    return this.active;
  }

  async start(rootUri: vscode.Uri): Promise<boolean> {
    if (this.active) {
      return false;
    }
    const plan = currentPlan();
    const adapter = createAdapter(await detectProjectMajor(rootUri));
    const targets: BuildTarget[] = [];
    for (const t of plan) {
      if (await fileExists(rootUri, t.input)) {
        targets.push(t);
      }
    }
    if (targets.length === 0) {
      vscode.window.showWarningMessage('لا يوجد input.css — تعذر تشغيل المراقبة.');
      return false;
    }
    this.active = true;
    state.setStatus('building');
    for (const t of targets) {
      const args = adapter.buildArgs(t.input, t.output).concat(['--watch']);
      state.log('Watch start [' + t.input + ' -> ' + t.output + ']');
      const proc = spawnStreaming('npx', args, rootUri.fsPath, {
        onStdout: (chunk) => state.log(chunk.trimEnd()),
        onStderr: (chunk) => state.log(chunk.trimEnd()),
        onExit: (code) => {
          state.log('Watch exited [' + t.input + '], code=' + String(code));
          this.active = false;
          state.setStatus(code === 0 ? 'ok' : 'error');
        }
      });
      this.running.push(proc);
    }
    state.setStatus('ok');
    return true;
  }

  stop(): void {
    for (const proc of this.running) {
      proc.stop();
    }
    this.running = [];
    this.active = false;
    state.log('Watch stopped.');
  }
}

export const watcher = new ManagedWatcher();
