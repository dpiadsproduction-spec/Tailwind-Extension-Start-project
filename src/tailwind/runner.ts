import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  message: string;
}

export interface SpawnOptions {
  cwd: string;
  timeoutMs?: number;
  maxBuffer?: number;
}

export function runCapture(command: string, args: string[], opts: SpawnOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(command, args, { cwd: opts.cwd, shell: false, windowsHide: true }) as ChildProcessWithoutNullStreams;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      resolve({ ok: false, stdout: '', stderr: '', message: msg });
      return;
    }

    const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024;
    const timeout = opts.timeoutMs ?? 300000;
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let outLen = 0;
    let errLen = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
      }
    }, timeout);

    const finish = (result: RunResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on('data', (data: Buffer) => {
      if (outLen < maxBuffer) {
        const text = data.toString();
        stdoutChunks.push(text);
        outLen += text.length;
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      if (errLen < maxBuffer) {
        const text = data.toString();
        stderrChunks.push(text);
        errLen += text.length;
      }
    });

    child.on('error', (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      finish({ ok: false, stdout: stdoutChunks.join(''), stderr: stderrChunks.join(''), message: msg });
    });

    child.on('close', (code) => {
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      const ok = code === 0;
      const message = (stderr + '\n' + (ok ? '' : 'exit code ' + String(code))).trim().slice(0, 2000);
      finish({ ok, stdout, stderr, message });
    });
  });
}

export function runChecked(command: string, args: string[], opts: SpawnOptions): Promise<string> {
  return runCapture(command, args, opts).then((r) => {
    if (!r.ok) {
      throw new Error(r.message);
    }
    return r.stdout;
  });
}

export interface StreamHandlers {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onExit?: (code: number | null) => void;
}

export interface ManagedProcess {
  child: ChildProcessWithoutNullStreams;
  stop: () => void;
}

export function spawnStreaming(command: string, args: string[], cwd: string, handlers: StreamHandlers): ManagedProcess {
  const child = spawn(command, args, { cwd, shell: false, windowsHide: true }) as ChildProcessWithoutNullStreams;
  child.stdout.on('data', (data: Buffer) => {
    if (handlers.onStdout) {
      handlers.onStdout(data.toString());
    }
  });
  child.stderr.on('data', (data: Buffer) => {
    if (handlers.onStderr) {
      handlers.onStderr(data.toString());
    }
  });
  child.on('exit', (code) => {
    if (handlers.onExit) {
      handlers.onExit(code);
    }
  });
  child.on('error', () => {
    if (handlers.onExit) {
      handlers.onExit(-1);
    }
  });
  return {
    child,
    stop: () => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  };
}
