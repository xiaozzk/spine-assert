import { describe, test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const BIN = join(process.cwd(), 'src', 'cli.ts');
const TSX = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function run(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; status: number } {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? `${JSON.stringify(TSX)} ${[BIN, ...args].map((a) => JSON.stringify(a)).join(' ')}` : TSX;
  const spawnArgs = isWin ? [] : [BIN, ...args];
  const r = spawnSync(cmd, spawnArgs, {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: isWin,
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? -1 };
}

describe('CLI smoke', () => {
  test('--help exits 0 and lists subcommands', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('t2i');
    expect(r.stdout).toContain('i2i');
    expect(r.stdout).toContain('edit');
    expect(r.stdout).toContain('batch');
  });

  test('missing --prompt to t2i exits 64', () => {
    const r = run(['t2i'], { OPENROUTER_API_KEY: 'sk-x' });
    expect(r.status).toBe(64);
    expect(r.stderr + r.stdout).toMatch(/prompt|required/i);
  });

  test('missing API key exits 2', () => {
    const r = run(['t2i', '--prompt', 'x'], { OPENROUTER_API_KEY: '' });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/OPENROUTER_API_KEY/);
  });

  test('--dry-run prints payload, does not call fetch', () => {
    const r = run(['t2i', '--prompt', 'a cat', '--dry-run'], { OPENROUTER_API_KEY: 'sk-x' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"prompt"');
    expect(r.stdout).toContain('"a cat"');
    expect(r.stdout).not.toContain('saved');
  });
});