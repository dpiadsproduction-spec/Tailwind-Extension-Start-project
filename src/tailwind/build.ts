import * as vscode from 'vscode';
import { state } from '../core/state';
import { fileExists } from '../core/fs-util';
import { createAdapter } from './adapter';
import { detectProjectMajor, isTailwindInstalled } from './detect-vscode';
import { currentPlan } from './targets';
import { runCapture } from './runner';
import {
  beginBuildDiagnostics,
  collectBuildWarnings,
  flushBuildDiagnostics,
  clearBuildDiagnostics,
  reportBuildError
} from '../diagnostics/build-diagnostics';
import { cleanBuildMessage } from '../diagnostics/parse';

export function autoBuildEnabled(): boolean {
  return vscode.workspace.getConfiguration('tailwindStarter').get<boolean>('autoBuild', true);
}

export function autoFixEnabled(): boolean {
  return vscode.workspace.getConfiguration('tailwindStarter').get<boolean>('autoFix', true);
}

export function scheduleBuild(rootUri: vscode.Uri): void {
  if (!autoBuildEnabled()) {
    return;
  }
  if (state.buildTimer) {
    clearTimeout(state.buildTimer);
  }
  state.buildTimer = setTimeout(() => {
    void buildNow(rootUri);
  }, 300);
}

export async function buildNow(rootUri: vscode.Uri): Promise<boolean> {
  clearBuildDiagnostics();
  const plan = currentPlan();
  const first = plan[0];
  if (!(await fileExists(rootUri, first.input))) {
    return false;
  }
  if (!(await isTailwindInstalled(rootUri))) {
    state.setStatus('error');
    vscode.window.showErrorMessage('Tailwind غير مثبت. شغل Tailwind Starter: Check & Fix Project.');
    return false;
  }
  if (state.building) {
    state.pendingBuild = true;
    return false;
  }
  state.building = true;
  state.setStatus('building');
  beginBuildDiagnostics();

  const adapter = createAdapter(await detectProjectMajor(rootUri));
  let okAll = true;
  try {
    for (const t of plan) {
      if (!(await fileExists(rootUri, t.input))) {
        state.log('Skip target, missing input: ' + t.input);
        continue;
      }
      const result = await runCapture('npx', adapter.buildArgs(t.input, t.output), { cwd: rootUri.fsPath });
      collectBuildWarnings(rootUri, result.stdout + '\n' + result.stderr);
      if (result.ok) {
        state.log('Build OK [' + t.input + ' -> ' + t.output + ']: ' + new Date().toLocaleTimeString());
      } else {
        okAll = false;
        state.log('Build FAILED [' + t.input + ' -> ' + t.output + ']: ' + cleanBuildMessage(result.message));
        reportBuildError(rootUri, result.message);
      }
    }
    flushBuildDiagnostics();
    state.setStatus(okAll ? 'ok' : 'error');
    if (!okAll) {
      if (!state.errorNotified) {
        state.errorNotified = true;
        vscode.window
          .showErrorMessage('فشل بناء Tailwind. افتح Output > Tailwind Starter.', 'Show log')
          .then((sel) => {
            if (sel === 'Show log' && state.output) {
              state.output.show();
            }
          });
      }
    } else {
      state.errorNotified = false;
    }
    return okAll;
  } finally {
    state.building = false;
    if (state.pendingBuild) {
      state.pendingBuild = false;
      void buildNow(rootUri);
    }
  }
}
