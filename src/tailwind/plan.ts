import { sanitizeRelPath } from '../core/paths';

export interface BuildTarget {
  input: string;
  output: string;
}

export const DEFAULT_TARGET: BuildTarget = { input: 'input.css', output: 'style.css' };

export function buildPlan(targets: BuildTarget[] = [], defaultTarget: BuildTarget = DEFAULT_TARGET): BuildTarget[] {
  const plan: BuildTarget[] = [{ ...defaultTarget }];
  const seen = new Set<string>([defaultTarget.input.toLowerCase()]);
  for (const t of targets || []) {
    if (!t || typeof t.input !== 'string' || typeof t.output !== 'string') {
      continue;
    }
    const input = sanitizeRelPath(t.input);
    const output = sanitizeRelPath(t.output);
    if (!input || !output || input === output) {
      continue;
    }
    if (seen.has(input.toLowerCase())) {
      continue;
    }
    seen.add(input.toLowerCase());
    plan.push({ input, output });
  }
  return plan;
}

export function planOutputs(plan: BuildTarget[]): string[] {
  const outs: string[] = ['style.css', 'output.css'];
  for (const t of plan) {
    const low = t.output.toLowerCase();
    if (outs.indexOf(low) === -1) {
      outs.push(low);
    }
  }
  return outs;
}

export function isGeneratedCss(rel: string, plan: BuildTarget[]): boolean {
  return planOutputs(plan).indexOf(rel.toLowerCase()) !== -1;
}

export function isPlanInput(rel: string, plan: BuildTarget[]): boolean {
  const low = rel.toLowerCase();
  return plan.some((t) => t.input.toLowerCase() === low);
}
