export interface ParsedError {
  file: string;
  line: number;
  col: number;
  text: string;
}

export function parseBuildError(msg: string): ParsedError | undefined {
  const m = /([A-Za-z]:[\\/][^\n:]+\.css|\S+\.css):(\d+):(\d+)/.exec(msg);
  if (!m) {
    return undefined;
  }
  const line = Math.max(0, parseInt(m[2], 10) - 1);
  const col = Math.max(0, parseInt(m[3], 10) - 1);
  const text = msg.length > 500 ? msg.slice(0, 500) + '...' : msg;
  return { file: m[1], line, col, text };
}

const NOISE = /browserslist|caniuse|update-browserslist|why you should do it|rebuilding\.\.\.|^\s*at\s/i;

export function cleanBuildMessage(msg: string): string {
  const reason = /reason:\s*'([^']+)'/.exec(msg);
  if (reason) {
    return reason[1];
  }
  const lines = msg.split('\n');
  for (const ln of lines) {
    const t = ln.trim();
    if (!t || NOISE.test(t)) {
      continue;
    }
    if (/CssSyntaxError|SyntaxError/i.test(t)) {
      return t.slice(0, 300);
    }
  }
  for (const ln of lines) {
    const t = ln.trim();
    if (!t || NOISE.test(t)) {
      continue;
    }
    return t.slice(0, 300);
  }
  return msg.slice(0, 200);
}

export function collectWarnings(combined: string, limit = 5): string[] {
  const found: string[] = [];
  for (const ln of combined.split('\n')) {
    const t = ln.trim();
    if (/^warn(ing)?\b/i.test(t)) {
      const clean = t.replace(/^warn(ing)?\s*[-:]?\s*/i, '').trim();
      if (clean && found.indexOf(clean) === -1) {
        found.push(clean);
      }
    }
    if (found.length >= limit) {
      break;
    }
  }
  return found;
}
