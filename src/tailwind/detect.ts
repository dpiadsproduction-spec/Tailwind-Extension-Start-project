export interface DetectInput {
  hasV4Cli: boolean;
  tailwindMajor?: 3 | 4;
  cssText?: string;
  fallback?: 3 | 4;
}

export function detectMajor(input: DetectInput): 3 | 4 {
  if (input.hasV4Cli) {
    return 4;
  }
  if (input.tailwindMajor === 3 || input.tailwindMajor === 4) {
    return input.tailwindMajor;
  }
  const css = input.cssText || '';
  if (/@import\s+["']tailwindcss["']/.test(css)) {
    return 4;
  }
  if (/@tailwind\s+(base|components|utilities)/.test(css)) {
    return 3;
  }
  return input.fallback ?? 4;
}

export function isTailwindProject(flags: { hasConfig: boolean; hasInput: boolean }): boolean {
  return flags.hasConfig || flags.hasInput;
}
