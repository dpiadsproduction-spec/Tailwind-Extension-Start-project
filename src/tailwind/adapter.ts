import { AdapterV3 } from './adapter-v3';
import { AdapterV4 } from './adapter-v4';

export interface TailwindAdapter {
  major(): 3 | 4;
  cliPackage(): string;
  buildArgs(input: string, output: string): string[];
  entryDirectives(): string;
  usesJsConfig(): boolean;
  contentDetection(): 'config' | 'auto';
  detectApplyErrorNeedsReference(buildErrorText: string): boolean;
}

export function createAdapter(major: 3 | 4): TailwindAdapter {
  return major === 4 ? new AdapterV4() : new AdapterV3();
}
