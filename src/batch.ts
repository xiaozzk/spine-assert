import pLimit from 'p-limit';
import type { BatchReport, BatchTask } from './types.js';

export interface BatchDeps {
  generate: (task: BatchTask) => Promise<Buffer>;
  save: (buf: Buffer, outPath: string) => Promise<void>;
  concurrency?: number;
  onProgress?: (event: ProgressEvent) => void;
}

export type ProgressEvent =
  | { kind: 'start'; index: number; prompt: string }
  | { kind: 'success'; index: number; out: string }
  | { kind: 'failure'; index: number; prompt: string; error: { name: string; message: string } };

export async function runBatch(tasks: BatchTask[], deps: BatchDeps): Promise<BatchReport> {
  const concurrency = deps.concurrency ?? 4;
  const limit = pLimit(concurrency);
  const start = Date.now();

  const failures: BatchReport['failures'] = [];
  let succeeded = 0;

  await Promise.all(
    tasks.map((task, index) =>
      limit(async () => {
        deps.onProgress?.({ kind: 'start', index, prompt: task.prompt });
        try {
          const buf = await deps.generate(task);
          await deps.save(buf, task.out);
          succeeded++;
          deps.onProgress?.({ kind: 'success', index, out: task.out });
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          failures.push({
            index,
            prompt: task.prompt,
            error: { name: err.name, message: err.message },
          });
          deps.onProgress?.({
            kind: 'failure',
            index,
            prompt: task.prompt,
            error: { name: err.name, message: err.message },
          });
        }
      }),
    ),
  );

  return {
    total: tasks.length,
    succeeded,
    failed: failures.length,
    failures,
    totalMs: Date.now() - start,
  };
}
