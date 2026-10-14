import type { TailwindAdapter } from './adapter';

export class AdapterV3 implements TailwindAdapter {
  major(): 3 | 4 {
    return 3;
  }

  cliPackage(): string {
    return 'tailwindcss';
  }

  buildArgs(input: string, output: string): string[] {
    return ['tailwindcss', '-i', input, '-o', output];
  }

  entryDirectives(): string {
    return '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
  }

  usesJsConfig(): boolean {
    return true;
  }

  contentDetection(): 'config' | 'auto' {
    return 'config';
  }

  detectApplyErrorNeedsReference(): boolean {
    return false;
  }
}
