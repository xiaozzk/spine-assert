#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getConfig } from './config.js';
import { generateImage } from './openrouter.js';
import { defaultOutPath, readAsBase64, saveFromBase64, maskToGrayscale } from './image.js';
import { runBatch } from './batch.js';
import {
  AuthError,
  ContentPolicyError,
  OrImageError,
  UsageError,
  type BatchTask,
  type GenerateOpts,
} from './types.js';

interface GlobalFlags {
  apiKey?: string;
  proxy?: string;
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
  retry?: boolean;
}

function attachGlobalFlags(cmd: Command): Command {
  return cmd
    .option('--api-key <key>', 'override OPENROUTER_API_KEY')
    .option('--proxy <url>', 'override HTTPS_PROXY')
    .option('--model <id>', 'override model id', 'google/gemini-3.1-flash-image-preview')
    .option('--dry-run', 'print payload, do not send')
    .option('--verbose', 'print request/response details')
    .option('--no-retry', 'disable automatic retry');
}

async function readBatchJson(path: string): Promise<BatchTask[]> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    throw new UsageError(`Cannot read batch file ${path}: ${e instanceof Error ? e.message : e}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new UsageError(`Batch file is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  if (!Array.isArray(parsed)) {
    throw new UsageError('Batch file must be a JSON array');
  }
  for (let i = 0; i < parsed.length; i++) {
    const t = parsed[i] as Partial<BatchTask>;
    if (!t || typeof t.prompt !== 'string' || typeof t.out !== 'string') {
      throw new UsageError(`Batch entry ${i} missing required "prompt" and "out"`);
    }
  }
  return parsed as BatchTask[];
}

async function generateAndSave(opts: GenerateOpts, flags: GlobalFlags, outPath: string): Promise<void> {
  let cfg;
  try {
    cfg = getConfig(flags);
  } catch (e) {
    if (e instanceof UsageError && /OPENROUTER_API_KEY/.test(e.message)) {
      throw new AuthError(e.message);
    }
    throw e;
  }

  if (flags.dryRun) {
    const refData = opts.ref ? await readAsBase64(opts.ref.path) : undefined;
    const { buildPayload } = await import('./openrouter.js');
    const payload = buildPayload({
      prompt: opts.prompt,
      model: flags.model!,
      ref: refData,
    });
    const dryRunOut = { prompt: opts.prompt, payload };
    process.stdout.write(JSON.stringify(dryRunOut, null, 2) + '\n');
    return;
  }

  const t0 = Date.now();
  const buf = await generateImage(opts, cfg, { retry: flags.retry !== false });
  await mkdir(dirname(outPath), { recursive: true });
  await saveFromBase64(buf.toString('base64'), outPath);
  const ms = Date.now() - t0;
  const sizeMb = (buf.length / 1024 / 1024).toFixed(2);
  process.stdout.write(`[OK] ${outPath} · ${sizeMb}MB · ${(ms / 1000).toFixed(1)}s\n`);
  if (flags.verbose && cfg.proxyUrl) {
    const masked = cfg.proxyUrl.replace(/\/\/[^@/]+@/, '//***@');
    process.stdout.write(`via proxy: ${masked}\n`);
  } else if (flags.verbose) {
    process.stdout.write('direct\n');
  }
}

function buildT2iGenerateOpts(opts: { prompt: string; size?: string }): GenerateOpts {
  const o: GenerateOpts = { prompt: opts.prompt };
  if (opts.size) o.size = opts.size;
  return o;
}

function buildI2iGenerateOpts(opts: { prompt: string; ref?: string; strength?: number }): GenerateOpts {
  if (!opts.ref) throw new UsageError('--ref <path> is required for i2i');
  const o: GenerateOpts = { prompt: opts.prompt, ref: { path: opts.ref } };
  if (opts.strength !== undefined) o.strength = opts.strength;
  return o;
}

function buildEditGenerateOpts(opts: { prompt: string; ref?: string; mask?: string }): GenerateOpts {
  if (!opts.ref) throw new UsageError('--ref <path> is required for edit');
  if (!opts.mask) throw new UsageError('--mask <path> is required for edit');
  return { prompt: opts.prompt, ref: { path: opts.ref }, mask: { path: opts.mask } };
}

const program = new Command();
program
  .name('or-image')
  .description('OpenRouter × Gemini image CLI')
  .version('0.1.0');
program.exitOverride();
program.configureOutput({
  writeErr: () => {},
  writeOut: (str) => process.stdout.write(str),
});

attachGlobalFlags(
  program
    .command('t2i')
    .description('Text-to-image')
    .requiredOption('-p, --prompt <text>', 'prompt text')
    .option('--out <path>', 'output file path')
    .option('--size <WxH>', 'output size (e.g. 1024x1024)'),
).action(async (opts, cmd: Command) => {
  const flags = cmd.optsWithGlobals() as GlobalFlags;
  const out = opts.out ?? defaultOutPath();
  await generateAndSave(buildT2iGenerateOpts(opts), flags, out);
});

attachGlobalFlags(
  program
    .command('i2i')
    .description('Image-to-image (style transfer / variation)')
    .requiredOption('-p, --prompt <text>', 'prompt text')
    .requiredOption('--ref <path>', 'reference image path')
    .option('--strength <0..1>', 'reference strength', (v) => Number(v))
    .option('--out <path>', 'output file path'),
).action(async (opts, cmd: Command) => {
  const flags = cmd.optsWithGlobals() as GlobalFlags;
  const out = opts.out ?? defaultOutPath();
  await generateAndSave(buildI2iGenerateOpts(opts), flags, out);
});

attachGlobalFlags(
  program
    .command('edit')
    .description('Local edit / inpaint (reference + mask)')
    .requiredOption('-p, --prompt <text>', 'prompt text')
    .requiredOption('--ref <path>', 'reference image path')
    .requiredOption('--mask <path>', 'mask image path (white = editable)')
    .option('--out <path>', 'output file path'),
).action(async (opts, cmd: Command) => {
  const flags = cmd.optsWithGlobals() as GlobalFlags;
  const out = opts.out ?? defaultOutPath();
  await generateAndSave(buildEditGenerateOpts(opts), flags, out);
});

attachGlobalFlags(
  program
    .command('batch')
    .description('Batch process a JSON array of tasks')
    .requiredOption('--in <path>', 'input JSON file path')
    .option('--out-dir <path>', 'output directory (used if entry.out is missing)', './output/')
    .option('--concurrency <n>', 'max parallel requests', (v) => Number(v), 4)
    .option('--errors-file <path>', 'write failures JSON to this file'),
).action(async (opts, cmd: Command) => {
  const flags = cmd.optsWithGlobals() as GlobalFlags;
  const tasks = await readBatchJson(opts.in);
  let cfg;
  try {
    cfg = getConfig(flags);
  } catch (e) {
    if (e instanceof UsageError && /OPENROUTER_API_KEY/.test(e.message)) {
      throw new AuthError(e.message);
    }
    throw e;
  }
  const report = await runBatch(tasks, {
    concurrency: opts.concurrency,
    generate: async (task) => {
      const o: GenerateOpts = { prompt: task.prompt };
      if (task.ref) o.ref = { path: task.ref };
      if (task.mask) o.mask = { path: task.mask };
      if (task.strength !== undefined) o.strength = task.strength;
      if (task.size) o.size = task.size;
      return generateImage(o, cfg, { retry: flags.retry !== false });
    },
    save: async (buf, outPath) => {
      await mkdir(dirname(outPath), { recursive: true });
      await saveFromBase64(buf.toString('base64'), outPath);
    },
    onProgress: (e) => {
      if (e.kind === 'success') {
        process.stdout.write(`[OK] #${e.index} ${e.out}\n`);
      } else if (e.kind === 'failure') {
        process.stdout.write(`[ERR] #${e.index} ${e.prompt.slice(0, 40)}: ${e.error.message}\n`);
      }
    },
  });

  const secs = (report.totalMs / 1000).toFixed(1);
  process.stdout.write(`[BATCH] ${report.total} total · ${report.succeeded} succeeded · ${report.failed} failed in ${secs}s\n`);

  if (opts.errorsFile && report.failures.length > 0) {
    await writeFile(opts.errorsFile, JSON.stringify(report.failures, null, 2), 'utf8');
    process.stdout.write(`[BATCH] errors written to ${opts.errorsFile}\n`);
  }

  if (report.failed > 0) process.exit(1);
});

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof CommanderError) {
    if (
      err.code === 'commander.missingMandatoryOptionValue' ||
      err.code === 'commander.missingArgument' ||
      err.code === 'commander.optionMissingArgument' ||
      err.code === 'commander.unknownOption' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.excessArguments'
    ) {
      process.stderr.write(`✗ ${err.message}\n`);
      process.exit(64);
    }
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.help') {
      process.exit(0);
    }
    if (err.code === 'commander.version') {
      process.exit(0);
    }
    process.stderr.write(`✗ ${err.message}\n`);
    process.exit(err.exitCode);
  }
  const e = err instanceof OrImageError ? err : new Error(err instanceof Error ? err.message : String(err));
  process.stderr.write(`✗ ${e.message}\n`);
  if (e instanceof ContentPolicyError) process.exit(4);
  else if (e instanceof AuthError) process.exit(2);
  else if (e instanceof UsageError) process.exit(64);
  else if ('exitCode' in e) process.exit((e as OrImageError).exitCode);
  else process.exit(1);
});