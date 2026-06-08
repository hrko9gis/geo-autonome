import { spawn } from 'node:child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface IChildProcessExecutor {
  exec(command: string, args: string[], cwd?: string): Promise<ExecResult>;
}

export class NodeChildProcessExecutor implements IChildProcessExecutor {
  exec(command: string, args: string[], cwd?: string): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { cwd, shell: false });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ${command}: ${err.message}`));
      });
    });
  }
}
