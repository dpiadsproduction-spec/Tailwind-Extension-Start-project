import * as vscode from 'vscode';
import { buildPlan, DEFAULT_TARGET, type BuildTarget } from './plan';

export function readTargets(): BuildTarget[] {
  const cfg = vscode.workspace
    .getConfiguration('tailwindStarter')
    .get<Array<{ input?: unknown; output?: unknown }>>('targets', []);
  return (cfg || []).map((t) => ({
    input: typeof t?.input === 'string' ? t.input : '',
    output: typeof t?.output === 'string' ? t.output : ''
  }));
}

export function currentPlan(): BuildTarget[] {
  return buildPlan(readTargets(), DEFAULT_TARGET);
}
