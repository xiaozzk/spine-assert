import { describe, test, expect, vi } from 'vitest';
import { runBatch } from '../src/batch.js';
import { AuthError } from '../src/types.js';
import type { BatchTask } from '../src/types.js';

function makeTask(i: number): BatchTask {
  return { prompt: `task ${i}`, out: `./out-${i}.png` };
}

describe('runBatch', () => {
  test('runs all tasks and reports all succeeded', async () => {
    const gen = vi.fn().mockResolvedValue(Buffer.from([0x89]));
    const save = vi.fn().mockResolvedValue(undefined);
    const report = await runBatch([makeTask(1), makeTask(2), makeTask(3)], {
      generate: gen,
      save,
      concurrency: 2,
    });
    expect(report.total).toBe(3);
    expect(report.succeeded).toBe(3);
    expect(report.failed).toBe(0);
    expect(gen).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenCalledTimes(3);
  });

  test('continues after individual failures', async () => {
    const gen = vi.fn()
      .mockResolvedValueOnce(Buffer.from([0x89]))
      .mockRejectedValueOnce(new AuthError('bad key'))
      .mockResolvedValueOnce(Buffer.from([0x89]));
    const report = await runBatch([makeTask(1), makeTask(2), makeTask(3)], {
      generate: gen,
      save: vi.fn(),
      concurrency: 1,
    });
    expect(report.total).toBe(3);
    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].index).toBe(1);
    expect(report.failures[0].error.name).toBe('AuthError');
  });

  test('respects concurrency cap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const gen = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return Buffer.from([0x89]);
    });
    await runBatch(Array.from({ length: 10 }, (_, i) => makeTask(i)), {
      generate: gen,
      save: vi.fn(),
      concurrency: 3,
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  test('emits progress via onProgress', async () => {
    const events: Array<{ kind: string; index?: number }> = [];
    await runBatch([makeTask(1), makeTask(2)], {
      generate: vi.fn().mockResolvedValue(Buffer.from([0x89])),
      save: vi.fn(),
      concurrency: 1,
      onProgress: (e) => events.push(e as { kind: string }),
    });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('start');
    expect(kinds).toContain('success');
    expect(kinds.filter((k) => k === 'start')).toHaveLength(2);
  });

  test('default concurrency is 4', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const gen = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return Buffer.from([0x89]);
    });
    await runBatch(Array.from({ length: 8 }, (_, i) => makeTask(i)), {
      generate: gen,
      save: vi.fn(),
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });
});
