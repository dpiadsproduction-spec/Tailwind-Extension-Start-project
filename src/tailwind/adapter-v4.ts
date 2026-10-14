import type { TailwindAdapter } from './adapter';

export class AdapterV4 implements TailwindAdapter {
  major(): 3 | 4 {
    return 4;
  }

  cliPackage(): string {
    return '@tailwindcss/cli';
  }

  buildArgs(input: string, output: string): string[] {
    return ['@tailwindcss/cli', '-i', input, '-o', output];
  }

  entryDirectives(): string {
    return '@import "tailwindcss";\n';
  }

  usesJsConfig(): boolean {
    return false;
  }

  contentDetection(): 'config' | 'auto' {
    return 'auto';
  }

  detectApplyErrorNeedsReference(buildErrorText: string): boolean {
    return /cannot apply|unknown utility|@reference|@apply/i.test(buildErrorText);
  }
}
