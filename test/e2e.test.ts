import { describe, test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const RUN = process.env.OR_E2E === '1';
const describeIf = RUN ? describe : describe.skip;

const BIN = join(process.cwd(), 'node_modules', '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SRC = join(process.cwd(), 'src', 'cli.ts');

describeIf('e2e (real OpenRouter)', () => {
  test('t2i generates a PNG', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-e2e-'));
    const out = join(dir, 'out.png');
    try {
      const r = spawnSync(BIN, [SRC, 't2i', '--prompt', 'a tiny red square on white', '--out', out], {
        env: process.env,
        encoding: 'utf8',
        timeout: 60_000,
      });
      expect(r.status).toBe(0);
      const buf = await readFile(out);
      expect(buf[0]).toBe(0x89);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
