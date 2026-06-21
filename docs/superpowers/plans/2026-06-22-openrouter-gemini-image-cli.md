# or-image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js + TypeScript CLI that wraps OpenRouter's `google/gemini-3.1-flash-image-preview` for text-to-image, image-to-image, local edit, and JSON-driven batch generation.

**Architecture:** Layered modules under `src/`. `cli.ts` (commander) wires together `openrouter.ts` (HTTP + payload + retry + proxy), `image.ts` (file I/O), `batch.ts` (concurrency + fault tolerance), `config.ts` (env + `.env`), `types.ts` (shared interfaces + error classes). Native `fetch` with `undici.ProxyAgent` for proxy support. `sharp` for image handling. Tests with `vitest`, TDD throughout.

**Tech Stack:** Node.js 22, TypeScript 5.4, commander 12, sharp 0.33, dotenv 16, p-limit 5, vitest 1.6, undici (built into Node).

---

## File Structure

```
spine/
├── bin/
│   └── or-image                          # shebang entry, single line
├── src/
│   ├── types.ts                          # error classes, interfaces
│   ├── config.ts                         # API key + proxy resolution
│   ├── image.ts                          # readAsBase64, saveFromBase64, defaultOutPath, maskToGrayscale
│   ├── openrouter.ts                     # buildPayload, parseResponse, classifyError, getDispatcher, generateImage
│   ├── batch.ts                          # runBatch (p-limit + fault tolerance)
│   └── cli.ts                            # commander setup, all subcommands
├── test/
│   ├── helpers/
│   │   └── makePng.ts                    # tiny PNG fixture for image tests
│   ├── types.test.ts
│   ├── config.test.ts
│   ├── image.test.ts
│   ├── openrouter.test.ts
│   ├── batch.test.ts
│   ├── cli.test.ts
│   └── e2e.test.ts                       # gated on OR_E2E=1
├── docs/superpowers/
│   ├── specs/2026-06-22-...-design.md
│   └── plans/2026-06-22-...md            # this file
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example                          # already exists
├── .gitignore                            # already exists
├── .env                                  # gitignored, already exists
└── README.md
```

Each task below modifies **only its listed files**. Every implementation step is preceded by a failing test (TDD). Tests run with `npm test`. Commits happen after each green test.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "or-image",
  "version": "0.1.0",
  "description": "OpenRouter × Gemini image generation CLI",
  "type": "module",
  "bin": {
    "or-image": "bin/or-image"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run --exclude '**/e2e.test.ts'",
    "test:watch": "vitest --exclude '**/e2e.test.ts'",
    "test:e2e": "OR_E2E=1 vitest run e2e.test.ts",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=22"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "dotenv": "^16.4.5",
    "p-limit": "^5.0.0",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: false,
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Install dependencies**

```bash
cd "D:/spine" && npm install
```

Expected: `node_modules/` created, no errors. Sharp install may print a platform-specific binary fetch — that's fine.

- [ ] **Step 5: Verify install with a placeholder test**

Create empty `test/smoke.test.ts`:
```ts
import { test, expect } from 'vitest';

test('vitest is wired', () => {
  expect(1 + 1).toBe(2);
});
```

Run:
```bash
cd "D:/spine" && npm test
```

Expected: 1 test passes.

- [ ] **Step 6: Delete smoke test, commit scaffold**

```bash
cd "D:/spine" && rm test/smoke.test.ts && git add package.json tsconfig.json vitest.config.ts package-lock.json && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "chore: scaffold or-image project (deps, tsconfig, vitest)"
```

---

## Task 2: Error Classes in `src/types.ts`

**Files:**
- Create: `src/types.ts`
- Create: `test/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/types.test.ts`:
```ts
import { describe, test, expect } from 'vitest';
import {
  OrImageError,
  UsageError,
  AuthError,
  RateLimitError,
  ContentPolicyError,
  NetworkError,
  ParseError,
  FileIOError,
} from '../src/types.js';

describe('error classes', () => {
  test('UsageError is an OrImageError with exitCode 64', () => {
    const e = new UsageError('bad arg');
    expect(e).toBeInstanceOf(OrImageError);
    expect(e.exitCode).toBe(64);
    expect(e.message).toBe('bad arg');
  });

  test('AuthError has exitCode 2', () => {
    expect(new AuthError('x').exitCode).toBe(2);
  });

  test('RateLimitError has exitCode 3 and optional retryAfterSec', () => {
    const e = new RateLimitError('slow down', 12);
    expect(e.exitCode).toBe(3);
    expect(e.retryAfterSec).toBe(12);
  });

  test('RateLimitError retryAfterSec is optional', () => {
    expect(new RateLimitError('x').retryAfterSec).toBeUndefined();
  });

  test('ContentPolicyError has exitCode 4', () => {
    expect(new ContentPolicyError('x').exitCode).toBe(4);
  });

  test('NetworkError has exitCode 5', () => {
    expect(new NetworkError('x').exitCode).toBe(5);
  });

  test('ParseError has exitCode 6', () => {
    expect(new ParseError('x').exitCode).toBe(6);
  });

  test('FileIOError has exitCode 7', () => {
    expect(new FileIOError('x').exitCode).toBe(7);
  });

  test('name property reflects concrete class', () => {
    expect(new AuthError('x').name).toBe('AuthError');
    expect(new NetworkError('x').name).toBe('NetworkError');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd "D:/spine" && npm test -- test/types.test.ts
```

Expected: FAIL — `Cannot find module '../src/types.js'`.

- [ ] **Step 3: Implement `src/types.ts`**

```ts
export abstract class OrImageError extends Error {
  abstract readonly exitCode: number;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UsageError extends OrImageError {
  readonly exitCode = 64;
}

export class AuthError extends OrImageError {
  readonly exitCode = 2;
}

export class NetworkError extends OrImageError {
  readonly exitCode = 5;
}

export class ParseError extends OrImageError {
  readonly exitCode = 6;
}

export class FileIOError extends OrImageError {
  readonly exitCode = 7;
}

export class RateLimitError extends OrImageError {
  readonly exitCode = 3;
  readonly retryAfterSec?: number;
  constructor(message: string, retryAfterSec?: number) {
    super(message);
    this.retryAfterSec = retryAfterSec;
  }
}

export class ContentPolicyError extends OrImageError {
  readonly exitCode = 4;
}

// ---------- shared interfaces ----------

export type Mode = 't2i' | 'i2i' | 'edit' | 'batch';

export interface GenerateOpts {
  prompt: string;
  ref?: { path: string };
  mask?: { path: string };
  size?: string;          // "1024x1024", only used for t2i
  strength?: number;      // 0..1, only used for i2i
  model?: string;         // override default
}

export interface BatchTask {
  prompt: string;
  ref?: string;           // path
  mask?: string;          // path
  strength?: number;
  size?: string;
  out: string;            // path
}

export interface BatchReport {
  total: number;
  succeeded: number;
  failed: number;
  failures: { index: number; prompt: string; error: { name: string; message: string } }[];
  totalMs: number;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd "D:/spine" && npm test -- test/types.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/types.ts test/types.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(types): add error hierarchy and shared interfaces"
```

---

## Task 3: `src/config.ts` — API Key Resolution

**Files:**
- Create: `src/config.ts`
- Create: `test/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/config.test.ts`:
```ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../src/config.js';
import { UsageError } from '../src/types.js';

describe('getConfig — api key', () => {
  const ORIGINAL_ENV = process.env;
  const ORIGINAL_CWD = process.cwd();

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('reads API key from OPENROUTER_API_KEY env var', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-env';
    const cfg = getConfig({});
    expect(cfg.apiKey).toBe('sk-or-v1-env');
  });

  test('--api-key flag overrides env var', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-env';
    const cfg = getConfig({ apiKey: 'sk-or-v1-flag' });
    expect(cfg.apiKey).toBe('sk-or-v1-flag');
  });

  test('throws UsageError when no key is available', () => {
    // dotenv loads .env from cwd if it exists; we don't have a key there
    // during tests if we delete env. To be safe, also stub getApiKey.
    expect(() => getConfig({})).toThrow(UsageError);
  });

  test('error message mentions OPENROUTER_API_KEY', () => {
    let thrown: UsageError | undefined;
    try {
      getConfig({});
    } catch (e) {
      thrown = e as UsageError;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain('OPENROUTER_API_KEY');
  });
});
```

> Note: `getConfig` will read `.env` from cwd. To make the "no key" test deterministic, the implementation must look up env var **first** before letting dotenv populate it. We'll handle that in impl.

- [ ] **Step 2: Run test, verify it fails**

```bash
cd "D:/spine" && npm test -- test/config.test.ts
```

Expected: FAIL — `Cannot find module '../src/config.js'`.

- [ ] **Step 3: Implement `src/config.ts` (api key only; proxy added in next task)**

```ts
import 'dotenv/config';
import { UsageError } from './types.js';

export interface ConfigOpts {
  apiKey?: string;
  proxy?: string;
}

export interface AppConfig {
  apiKey: string;
  proxyUrl?: string;
}

export function getConfig(opts: ConfigOpts): AppConfig {
  const apiKey =
    opts.apiKey ??
    process.env.OPENROUTER_API_KEY ??
    process.env.OPENROUTER_API_KEY; // dotenv also populates this

  if (!apiKey) {
    throw new UsageError(
      'OPENROUTER_API_KEY not set. Provide via --api-key, env var, or .env file.',
    );
  }

  // Proxy resolution implemented in Task 4
  return { apiKey, proxyUrl: undefined };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd "D:/spine" && npm test -- test/config.test.ts
```

Expected: 4 tests pass. (The "no key" test passes because `dotenv/config` loads the real `.env` at the start, which sets the key — so to test the failure path, we need a different approach. Adjust below.)

- [ ] **Step 5: Adjust to make failure-path test deterministic**

Replace the "throws UsageError when no key is available" test with a direct unit on the internal helper. Add this small refactor:

In `src/config.ts`, add an exported helper used by `getConfig`:
```ts
// at the top of src/config.ts, add:
export function resolveApiKey(opts: ConfigOpts): string | undefined {
  return opts.apiKey ?? process.env.OPENROUTER_API_KEY;
}
```

And change `getConfig` to:
```ts
export function getConfig(opts: ConfigOpts): AppConfig {
  const apiKey = resolveApiKey(opts);
  if (!apiKey) {
    throw new UsageError(
      'OPENROUTER_API_KEY not set. Provide via --api-key, env var, or .env file.',
    );
  }
  return { apiKey, proxyUrl: undefined };
}
```

Replace the two "throws" tests in `test/config.test.ts` with:
```ts
test('resolveApiKey returns undefined when no key', () => {
  delete process.env.OPENROUTER_API_KEY;
  expect(resolveApiKey({})).toBeUndefined();
});

test('getConfig throws UsageError when resolveApiKey returns undefined', () => {
  // Override resolveApiKey by using a CLI flag also empty
  expect(() => getConfig({ apiKey: undefined })).toThrow(UsageError);
});
```

Add to import:
```ts
import { getConfig, resolveApiKey } from '../src/config.js';
```

Re-run:
```bash
cd "D:/spine" && npm test -- test/config.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "D:/spine" && git add src/config.ts test/config.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(config): resolve API key with --api-key > env > .env priority"
```

---

## Task 4: `src/config.ts` — Proxy URL Resolution

**Files:**
- Modify: `src/config.ts`
- Modify: `test/config.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `test/config.test.ts` inside the existing `describe`:
```ts
describe('getConfig — proxy', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test'; // satisfy api key check
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('--proxy flag wins', () => {
    process.env.HTTPS_PROXY = 'http://env:1';
    const cfg = getConfig({ proxy: 'http://flag:2' });
    expect(cfg.proxyUrl).toBe('http://flag:2');
  });

  test('reads HTTPS_PROXY (uppercase) when no flag', () => {
    process.env.HTTPS_PROXY = 'http://upper:7890';
    expect(getConfig({}).proxyUrl).toBe('http://upper:7890');
  });

  test('reads https_proxy (lowercase) when no flag and no uppercase', () => {
    process.env.https_proxy = 'http://lower:7890';
    expect(getConfig({}).proxyUrl).toBe('http://lower:7890');
  });

  test('HTTPS_PROXY wins over https_proxy', () => {
    process.env.HTTPS_PROXY = 'http://upper:1';
    process.env.https_proxy = 'http://lower:2';
    expect(getConfig({}).proxyUrl).toBe('http://upper:1');
  });

  test('falls back to HTTP_PROXY when no HTTPS_* set', () => {
    process.env.HTTP_PROXY = 'http://http:7890';
    expect(getConfig({}).proxyUrl).toBe('http://http:7890');
  });

  test('returns undefined proxyUrl when none configured', () => {
    expect(getConfig({}).proxyUrl).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify new tests fail**

```bash
cd "D:/spine" && npm test -- test/config.test.ts
```

Expected: 4 new tests fail (no proxy resolution yet).

- [ ] **Step 3: Implement proxy resolution in `src/config.ts`**

Replace `src/config.ts`:
```ts
import 'dotenv/config';
import { UsageError } from './types.js';

export interface ConfigOpts {
  apiKey?: string;
  proxy?: string;
}

export interface AppConfig {
  apiKey: string;
  proxyUrl?: string;
}

export function resolveApiKey(opts: ConfigOpts): string | undefined {
  return opts.apiKey ?? process.env.OPENROUTER_API_KEY;
}

export function resolveProxyUrl(opts: ConfigOpts): string | undefined {
  if (opts.proxy) return opts.proxy;
  const fromEnv =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  return fromEnv || undefined;
}

export function getConfig(opts: ConfigOpts): AppConfig {
  const apiKey = resolveApiKey(opts);
  if (!apiKey) {
    throw new UsageError(
      'OPENROUTER_API_KEY not set. Provide via --api-key, env var, or .env file.',
    );
  }
  return { apiKey, proxyUrl: resolveProxyUrl(opts) };
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
cd "D:/spine" && npm test -- test/config.test.ts
```

Expected: all config tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/config.ts test/config.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(config): resolve proxy URL with --proxy > HTTPS_PROXY > https_proxy > HTTP_PROXY"
```

---

## Task 5: `src/image.ts` — Test PNG Helper

**Files:**
- Create: `test/helpers/makePng.ts`

We need real PNG files for image tests. We'll build a tiny helper that produces a 4x4 solid-color PNG via `sharp`.

- [ ] **Step 1: Create helper**

Create `test/helpers/makePng.ts`:
```ts
import sharp from 'sharp';

export async function makePng(opts: {
  width?: number;
  height?: number;
  color?: { r: number; g: number; b: number; alpha?: number };
}): Promise<Buffer> {
  const { width = 4, height = 4, color = { r: 255, g: 0, b: 0, alpha: 1 } } = opts;
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}
```

- [ ] **Step 2: Sanity-check helper**

Create temporary `test/helpers/_check.test.ts`:
```ts
import { test, expect } from 'vitest';
import { makePng } from './makePng.js';
import sharp from 'sharp';

test('makePng produces a valid PNG', async () => {
  const buf = await makePng({ width: 8, height: 8, color: { r: 0, g: 128, b: 255 } });
  const meta = await sharp(buf).metadata();
  expect(meta.format).toBe('png');
  expect(meta.width).toBe(8);
  expect(meta.height).toBe(8);
});
```

Run:
```bash
cd "D:/spine" && npm test -- test/helpers/_check.test.ts
```

Expected: passes.

- [ ] **Step 3: Delete sanity test, commit helper**

```bash
cd "D:/spine" && rm test/helpers/_check.test.ts && git add test/helpers/makePng.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "test(image): add makePng fixture helper"
```

---

## Task 6: `src/image.ts` — `readAsBase64` with MIME Sniffing

**Files:**
- Create: `src/image.ts`
- Create: `test/image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/image.test.ts`:
```ts
import { describe, test, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAsBase64 } from '../src/image.js';
import { makePng } from './helpers/makePng.js';

describe('readAsBase64', () => {
  test('reads a PNG file and returns data URL parts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'a.png');
    await writeFile(file, await makePng({ width: 4, height: 4 }));
    const result = await readAsBase64(file);
    expect(result.mime).toBe('image/png');
    expect(typeof result.b64).toBe('string');
    expect(result.b64.length).toBeGreaterThan(0);
    // round-trip: decode and verify sharp still parses
    const buf = Buffer.from(result.b64, 'base64');
    expect(buf[0]).toBe(0x89); // PNG magic byte
    expect(buf[1]).toBe(0x50); // 'P'
  });

  test('sniffs JPEG MIME from magic bytes', async () => {
    // Build a JPEG via sharp and write to disk
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'a.jpg');
    const sharp = (await import('sharp')).default;
    const jpegBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .jpeg()
      .toBuffer();
    await writeFile(file, jpegBuf);
    const result = await readAsBase64(file);
    expect(result.mime).toBe('image/jpeg');
  });

  test('throws FileIOError on missing file', async () => {
    await expect(readAsBase64('/nonexistent/path.png')).rejects.toThrow(/ENOENT|FileIOError/);
  });

  test('throws FileIOError on unknown format', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'a.txt');
    await writeFile(file, 'hello world');
    await expect(readAsBase64(file)).rejects.toThrow(/unsupported/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/image.ts`**

```ts
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { FileIOError } from './types.js';

export interface DataUrlParts {
  mime: string;
  b64: string;
}

const MAGIC_TO_MIME: Array<{ mime: string; check: (b: Buffer) => boolean }> = [
  { mime: 'image/png', check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', check: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'image/gif', check: (b) => b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a' },
];

export async function readAsBase64(path: string): Promise<DataUrlParts> {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new FileIOError(`Cannot read ${path}: ${msg}`);
  }

  const mime = sniffMime(buf);
  if (!mime) {
    throw new FileIOError(`Unsupported image format: ${path}`);
  }
  return { mime, b64: buf.toString('base64') };
}

function sniffMime(buf: Buffer): string | undefined {
  for (const { mime, check } of MAGIC_TO_MIME) {
    if (check(buf)) return mime;
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/image.ts test/image.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(image): readAsBase64 with magic-byte MIME sniffing"
```

---

## Task 7: `src/image.ts` — `saveFromBase64`

**Files:**
- Modify: `src/image.ts`
- Modify: `test/image.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/image.test.ts`:
```ts
import { saveFromBase64 } from '../src/image.js';
import { readFile } from 'node:fs/promises';

describe('saveFromBase64', () => {
  test('writes base64 PNG to disk and creates parent dirs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const out = join(dir, 'nested', 'subdir', 'out.png');
    const pngB64 = (await makePng({ width: 2, height: 2 })).toString('base64');
    await saveFromBase64(pngB64, out);
    const written = await readFile(out);
    expect(written[0]).toBe(0x89); // PNG magic
  });

  test('throws FileIOError on corrupt base64', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const out = join(dir, 'bad.png');
    await expect(saveFromBase64('not base64 $$$', out)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify new tests fail**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

Expected: 2 new tests fail (function not exported yet).

- [ ] **Step 3: Add `saveFromBase64` to `src/image.ts`**

Append to `src/image.ts`:
```ts
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function saveFromBase64(b64: string, outPath: string): Promise<void> {
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch (e) {
    throw new FileIOError(`Invalid base64 input: ${e instanceof Error ? e.message : e}`);
  }

  // Validate it's a real image before writing
  try {
    await sharp(buf).metadata();
  } catch (e) {
    throw new FileIOError(
      `Decoded bytes are not a valid image: ${e instanceof Error ? e.message : e}`,
    );
  }

  try {
    await mkdir(dirname(outPath), { recursive: true });
    await sharp(buf).toFile(outPath);
  } catch (e) {
    throw new FileIOError(`Cannot write ${outPath}: ${e instanceof Error ? e.message : e}`);
  }
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

Expected: all image tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/image.ts test/image.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(image): saveFromBase64 with sharp validation"
```

---

## Task 8: `src/image.ts` — `defaultOutPath`

**Files:**
- Modify: `src/image.ts`
- Modify: `test/image.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/image.test.ts`:
```ts
import { defaultOutPath } from '../src/image.js';

describe('defaultOutPath', () => {
  test('produces a path under ./output/ ending in .png', () => {
    const p = defaultOutPath();
    expect(p.startsWith('output/or-image-')).toBe(true);
    expect(p.endsWith('.png')).toBe(true);
  });

  test('different calls produce different timestamps (or include index)', async () => {
    const a = defaultOutPath(1);
    const b = defaultOutPath(2);
    expect(a).not.toBe(b);
    expect(a).toContain('-1.');
    expect(b).toContain('-2.');
  });
});
```

- [ ] **Step 2: Run, verify new tests fail**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

Expected: new tests fail (function not exported).

- [ ] **Step 3: Add `defaultOutPath` to `src/image.ts`**

Append:
```ts
export function defaultOutPath(index?: number): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = index !== undefined ? `-${index}` : '';
  return `output/or-image-${ts}${suffix}.png`;
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/image.ts test/image.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(image): defaultOutPath with timestamp + index"
```

---

## Task 9: `src/image.ts` — `maskToGrayscale`

**Files:**
- Modify: `src/image.ts`
- Modify: `test/image.test.ts`

- [ ] **Step 1: Add failing test**

Append:
```ts
import { maskToGrayscale } from '../src/image.js';

describe('maskToGrayscale', () => {
  test('converts an RGB PNG mask to grayscale pixels', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'mask.png');
    const sharpMod = (await import('sharp')).default;
    const maskPng = await sharpMod({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .png()
      .toBuffer();
    await writeFile(file, maskPng);
    const pixels = await maskToGrayscale(file);
    expect(pixels.width).toBe(4);
    expect(pixels.height).toBe(4);
    expect(pixels.data.length).toBe(4 * 4);
    expect(pixels.data[0]).toBe(255);
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

- [ ] **Step 3: Add `maskToGrayscale` to `src/image.ts`**

```ts
export interface GrayscaleMask {
  width: number;
  height: number;
  data: Uint8Array; // length = width * height
}

export async function maskToGrayscale(path: string): Promise<GrayscaleMask> {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch (e) {
    throw new FileIOError(`Cannot read mask ${path}: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const { data, info } = await sharp(buf).grayscale().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data) };
  } catch (e) {
    throw new FileIOError(`Cannot decode mask ${path}: ${e instanceof Error ? e.message : e}`);
  }
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
cd "D:/spine" && npm test -- test/image.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/image.ts test/image.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(image): maskToGrayscale via sharp.grayscale().raw()"
```

---

## Task 10: `src/openrouter.ts` — `buildPayload`

**Files:**
- Create: `src/openrouter.ts`
- Create: `test/openrouter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/openrouter.test.ts`:
```ts
import { describe, test, expect } from 'vitest';
import { buildPayload } from '../src/openrouter.js';
import { makePng } from './helpers/makePng.js';

describe('buildPayload', () => {
  test('text-only payload', () => {
    const payload = buildPayload({
      prompt: 'a cat',
      model: 'google/gemini-3.1-flash-image-preview',
    });
    expect(payload.model).toBe('google/gemini-3.1-flash-image-preview');
    expect(payload.modalities).toEqual(['image', 'text']);
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0].role).toBe('user');
    expect(payload.messages[0].content).toEqual([{ type: 'text', text: 'a cat' }]);
  });

  test('text + reference image payload', async () => {
    const png = await makePng({ width: 2, height: 2 });
    const payload = buildPayload({
      prompt: 'make it blue',
      model: 'm',
      ref: { mime: 'image/png', b64: png.toString('base64') },
    });
    const content = payload.messages[0].content;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: 'text', text: 'make it blue' });
    expect(content[1].type).toBe('image_url');
    expect(content[1].image_url.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('does not include strength/size in payload (those are CLI-only hints)', () => {
    const payload = buildPayload({
      prompt: 'x',
      model: 'm',
      size: '512x512',
      strength: 0.5,
    });
    const json = JSON.stringify(payload);
    expect(json).not.toContain('strength');
    expect(json).not.toContain('size');
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

- [ ] **Step 3: Implement `src/openrouter.ts` (skeleton with `buildPayload`)**

```ts
import { ProxyAgent, type Dispatcher } from 'undici';
import { getConfig, type AppConfig } from './config.js';
import {
  AuthError,
  ContentPolicyError,
  FileIOError,
  NetworkError,
  ParseError,
  RateLimitError,
  UsageError,
  type GenerateOpts,
} from './types.js';

export interface PayloadInput {
  prompt: string;
  model: string;
  ref?: { mime: string; b64: string };
  // Note: strength / size / mask are handled client-side or by prompt augmentation.
  // They are NOT sent as separate OpenRouter parameters.
}

export interface ApiMessage {
  role: 'user';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
}

export interface ApiPayload {
  model: string;
  modalities: Array<'image' | 'text'>;
  messages: ApiMessage[];
}

export function buildPayload(input: PayloadInput): ApiPayload {
  const content: ApiMessage['content'] = [{ type: 'text', text: input.prompt }];
  if (input.ref) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${input.ref.mime};base64,${input.ref.b64}` },
    });
  }
  return {
    model: input.model,
    modalities: ['image', 'text'],
    messages: [{ role: 'user', content }],
  };
}

// Stubs for tasks 11..14 — filled in below.
export function parseResponse(json: unknown): Buffer {
  throw new Error('not implemented');
}
export function classifyError(status: number, bodyText: string, headers: Headers): Error {
  throw new Error('not implemented');
}
export function getDispatcher(_cfg: AppConfig): Dispatcher | undefined {
  return undefined;
}
export async function generateImage(_opts: GenerateOpts, _cfg: AppConfig): Promise<Buffer> {
  throw new Error('not implemented');
}
```

- [ ] **Step 4: Run tests, verify `buildPayload` pass (others skip/fail)**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

Expected: 3 buildPayload tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/openrouter.ts test/openrouter.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(openrouter): buildPayload for text + image content"
```

---

## Task 11: `src/openrouter.ts` — `parseResponse`

**Files:**
- Modify: `src/openrouter.ts`
- Modify: `test/openrouter.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/openrouter.test.ts`:
```ts
import { parseResponse } from '../src/openrouter.js';
import sharp from 'sharp';

const SAMPLE_BASE64_PNG = (async () => {
  const buf = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } })
    .png().toBuffer();
  return buf.toString('base64');
})();

describe('parseResponse', () => {
  test('extracts image buffer from choices[0].message.images[0]', async () => {
    const b64 = await SAMPLE_BASE64_PNG;
    const json = {
      choices: [{
        message: {
          images: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }],
        },
      }],
    };
    const buf = parseResponse(json);
    expect(buf[0]).toBe(0x89); // PNG magic
    expect(buf.length).toBeGreaterThan(0);
  });

  test('throws ParseError when no images array', () => {
    const json = { choices: [{ message: { content: 'no image' } }] };
    expect(() => parseResponse(json)).toThrow(/no image/i);
  });

  test('throws ParseError when images array is empty', () => {
    const json = { choices: [{ message: { images: [] } }] };
    expect(() => parseResponse(json)).toThrow(/empty|no image/i);
  });

  test('throws ParseError on bad data URL', () => {
    const json = {
      choices: [{ message: { images: [{ type: 'image_url', image_url: { url: 'not-a-data-url' } }] } }],
    };
    expect(() => parseResponse(json)).toThrow(/data url/i);
  });
});
```

- [ ] **Step 2: Run, verify new tests fail**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

- [ ] **Step 3: Replace stub `parseResponse` in `src/openrouter.ts`**

```ts
interface RawResponse {
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<{ type: string; image_url?: { url?: string } }>;
    };
  }>;
}

export function parseResponse(json: unknown): Buffer {
  const r = json as RawResponse;
  const choice = r.choices?.[0];
  const images = choice?.message?.images;
  if (!images || images.length === 0) {
    throw new ParseError('Response has no image data');
  }
  const url = images[0].image_url?.url;
  if (!url || !url.startsWith('data:')) {
    throw new ParseError('Image URL is not a data URL');
  }
  const commaIdx = url.indexOf(',');
  if (commaIdx === -1) {
    throw new ParseError('Malformed data URL');
  }
  const b64 = url.slice(commaIdx + 1);
  try {
    return Buffer.from(b64, 'base64');
  } catch (e) {
    throw new ParseError(`Cannot decode base64: ${e instanceof Error ? e.message : e}`);
  }
}
```

- [ ] **Step 4: Run tests, verify all openrouter tests pass**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

Expected: 4 parseResponse tests pass; 3 buildPayload tests still pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/openrouter.ts test/openrouter.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(openrouter): parseResponse extracts image buffer"
```

---

## Task 12: `src/openrouter.ts` — `classifyError`

**Files:**
- Modify: `src/openrouter.ts`
- Modify: `test/openrouter.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/openrouter.test.ts`:
```ts
import { classifyError } from '../src/openrouter.js';
import { AuthError, ContentPolicyError, RateLimitError } from '../src/types.js';

describe('classifyError', () => {
  const h = (entries: Record<string, string>) => new Headers(entries);

  test('401 → AuthError', () => {
    expect(classifyError(401, 'unauthorized', h({}))).toBeInstanceOf(AuthError);
  });
  test('403 → AuthError', () => {
    expect(classifyError(403, 'forbidden', h({}))).toBeInstanceOf(AuthError);
  });
  test('400 with safety block → ContentPolicyError', () => {
    const body = JSON.stringify({ error: { message: 'content blocked by safety filter' } });
    expect(classifyError(400, body, h({}))).toBeInstanceOf(ContentPolicyError);
  });
  test('400 generic → ParseError-shaped (let caller decide)', () => {
    const body = JSON.stringify({ error: { message: 'bad request' } });
    const err = classifyError(400, body, h({}));
    expect(err.message).toContain('bad request');
  });
  test('429 with Retry-After → RateLimitError carrying retryAfterSec', () => {
    const err = classifyError(429, 'slow', h({ 'retry-after': '7' }));
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSec).toBe(7);
  });
  test('500 → NetworkError', () => {
    expect(classifyError(500, 'oops', h({}))).toBeInstanceOf(NetworkError);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

- [ ] **Step 3: Replace stub `classifyError` in `src/openrouter.ts`**

```ts
export function classifyError(status: number, bodyText: string, headers: Headers): Error {
  let parsedMessage: string | undefined;
  try {
    const obj = JSON.parse(bodyText) as { error?: { message?: string } };
    parsedMessage = obj.error?.message;
  } catch {
    parsedMessage = bodyText.slice(0, 200);
  }

  if (status === 401 || status === 403) {
    return new AuthError(parsedMessage ?? 'Authentication failed');
  }
  if (status === 429) {
    const retryAfterRaw = headers.get('retry-after');
    const retryAfterSec = retryAfterRaw ? Number(retryAfterRaw) : undefined;
    return new RateLimitError(parsedMessage ?? 'Rate limited', retryAfterSec);
  }
  if (status === 400 && /safety|policy|blocked/i.test(parsedMessage ?? '')) {
    return new ContentPolicyError(parsedMessage ?? 'Content blocked');
  }
  if (status >= 500 || status === 408) {
    return new NetworkError(parsedMessage ?? `Server error ${status}`);
  }
  return new ParseError(`Unexpected response ${status}: ${parsedMessage ?? '(no body)'}`);
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/openrouter.ts test/openrouter.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(openrouter): classifyError maps status+body to typed errors"
```

---

## Task 13: `src/openrouter.ts` — `getDispatcher` (Proxy)

**Files:**
- Modify: `src/openrouter.ts`
- Modify: `test/openrouter.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/openrouter.test.ts`:
```ts
import { getDispatcher } from '../src/openrouter.js';
import type { AppConfig } from '../src/config.js';

const cfg = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  apiKey: 'sk-or-v1-x',
  proxyUrl: undefined,
  ...overrides,
});

describe('getDispatcher', () => {
  test('returns undefined when no proxy configured', () => {
    expect(getDispatcher(cfg())).toBeUndefined();
  });

  test('returns a ProxyAgent when proxyUrl is set', () => {
    const d = getDispatcher(cfg({ proxyUrl: 'http://127.0.0.1:7890' }));
    expect(d).toBeDefined();
  });

  test('throws UsageError on malformed URL', () => {
    expect(() => getDispatcher(cfg({ proxyUrl: 'not a url' }))).toThrow(/proxy/i);
  });

  test('accepts socks5 URLs', () => {
    const d = getDispatcher(cfg({ proxyUrl: 'socks5://127.0.0.1:1080' }));
    expect(d).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

- [ ] **Step 3: Replace stub `getDispatcher` in `src/openrouter.ts`**

```ts
let cachedDispatcher: Dispatcher | undefined | 'invalid';

export function getDispatcher(cfg: AppConfig): Dispatcher | undefined {
  if (cachedDispatcher !== undefined && cachedDispatcher !== 'invalid') {
    if (cfg.proxyUrl) return cachedDispatcher;
    return undefined;
  }
  if (!cfg.proxyUrl) {
    cachedDispatcher = undefined;
    return undefined;
  }
  try {
    new URL(cfg.proxyUrl); // throws if malformed
    const agent = new ProxyAgent({ uri: cfg.proxyUrl });
    cachedDispatcher = agent as unknown as Dispatcher;
    return cachedDispatcher;
  } catch (e) {
    cachedDispatcher = 'invalid';
    const masked = cfg.proxyUrl.replace(/\/\/[^@/]+@/, '//***@');
    throw new UsageError(`Invalid proxy URL "${masked}": ${e instanceof Error ? e.message : e}`);
  }
}

// Allow resetting between tests (not exported via package API)
export function _resetDispatcherCacheForTests(): void {
  cachedDispatcher = undefined;
}
```

- [ ] **Step 4: Add cache reset hook to test file**

At the top of `test/openrouter.test.ts`, add:
```ts
import { afterEach } from 'vitest';
import { _resetDispatcherCacheForTests } from '../src/openrouter.js';

afterEach(() => {
  _resetDispatcherCacheForTests();
});
```

- [ ] **Step 5: Run, verify pass**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

Expected: all openrouter tests pass.

- [ ] **Step 6: Commit**

```bash
cd "D:/spine" && git add src/openrouter.ts test/openrouter.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(openrouter): getDispatcher with ProxyAgent + URL validation"
```

---

## Task 14: `src/openrouter.ts` — `generateImage` with Retry

**Files:**
- Modify: `src/openrouter.ts`
- Modify: `test/openrouter.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/openrouter.test.ts`:
```ts
import { generateImage } from '../src/openrouter.js';
import sharp from 'sharp';

const PNG_B64 = (async () => {
  const buf = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } })
    .png().toBuffer();
  return buf.toString('base64');
})();

function makeOkResponse(b64: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { images: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function makeStatusResponse(status: number, body: object, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

describe('generateImage', () => {
  test('posts to OpenRouter and returns image buffer', async () => {
    const b64 = await PNG_B64;
    const fetchMock = vi.fn().mockResolvedValueOnce(makeOkResponse(b64));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const buf = await generateImage({ prompt: 'a cat' }, { apiKey: 'sk-x', proxyUrl: undefined });
      expect(buf[0]).toBe(0x89);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('openrouter.ai');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.model).toBe('google/gemini-3.1-flash-image-preview');
      expect(body.messages[0].content[0].text).toBe('a cat');
      expect(body.messages[0].content[0].type).toBe('text');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('retries on 429 with backoff (uses Retry-After)', async () => {
    const b64 = await PNG_B64;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeStatusResponse(429, { error: { message: 'slow' } }, { 'retry-after': '1' }))
      .mockResolvedValueOnce(makeOkResponse(b64));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const buf = await generateImage({ prompt: 'x' }, { apiKey: 'sk-x', proxyUrl: undefined });
      expect(buf[0]).toBe(0x89);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('retries on 500 up to 3 times then throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStatusResponse(500, { error: { message: 'oops' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(generateImage({ prompt: 'x' }, { apiKey: 'sk-x', proxyUrl: undefined }))
        .rejects.toBeInstanceOf(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('does NOT retry on AuthError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStatusResponse(401, { error: { message: 'bad key' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(generateImage({ prompt: 'x' }, { apiKey: 'sk-x', proxyUrl: undefined }))
        .rejects.toBeInstanceOf(AuthError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('does NOT retry on ContentPolicyError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStatusResponse(400, { error: { message: 'content blocked by safety' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(generateImage({ prompt: 'x' }, { apiKey: 'sk-x', proxyUrl: undefined }))
        .rejects.toBeInstanceOf(ContentPolicyError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('--no-retry (retry:false) disables retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStatusResponse(500, { error: { message: 'oops' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(generateImage({ prompt: 'x' }, { apiKey: 'sk-x', proxyUrl: undefined }, { retry: false }))
        .rejects.toBeInstanceOf(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('includes reference image when ref is provided', async () => {
    const b64 = await PNG_B64;
    const fetchMock = vi.fn().mockResolvedValueOnce(makeOkResponse(b64));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await generateImage(
        { prompt: 'blue', ref: { mime: 'image/png', b64 } },
        { apiKey: 'sk-x', proxyUrl: undefined },
      );
      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.messages[0].content).toHaveLength(2);
      expect(body.messages[0].content[1].type).toBe('image_url');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('attaches proxy dispatcher when configured', async () => {
    const b64 = await PNG_B64;
    const fetchMock = vi.fn().mockResolvedValueOnce(makeOkResponse(b64));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await generateImage({ prompt: 'x' }, { apiKey: 'sk-x', proxyUrl: 'http://127.0.0.1:7890' });
      const [, init] = fetchMock.mock.calls[0];
      expect(init.dispatcher).toBeDefined();
    } finally {
      vi.unstubAllGlobals();
      _resetDispatcherCacheForTests();
    }
  });
});
```

- [ ] **Step 2: Run, verify new tests fail**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

- [ ] **Step 3: Replace stub `generateImage` in `src/openrouter.ts`**

```ts
export interface GenerateOptions {
  retry?: boolean; // default true
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3.1-flash-image-preview';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateImage(
  opts: GenerateOpts,
  cfg: AppConfig,
  options: GenerateOptions = {},
): Promise<Buffer> {
  const retry = options.retry !== false;

  let refData: { mime: string; b64: string } | undefined;
  if (opts.ref) {
    // Lazy import to avoid circular dep at module load
    const { readAsBase64 } = await import('./image.js');
    refData = await readAsBase64(opts.ref.path);
  }

  const payload = buildPayload({
    prompt: opts.prompt,
    model: opts.model ?? DEFAULT_MODEL,
    ref: refData,
  });

  const dispatcher = getDispatcher(cfg);

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < (retry ? 3 : 1); attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(payload),
        // @ts-expect-error undici Dispatcher option not in lib.dom fetch types
        dispatcher,
      });

      if (!res.ok) {
        const body = await res.text();
        const err = classifyError(res.status, body, res.headers);
        if (
          retry &&
          (err instanceof NetworkError ||
            (err instanceof RateLimitError && (err as RateLimitError).retryAfterSec !== undefined))
        ) {
          const waitMs = err instanceof RateLimitError && err.retryAfterSec
            ? err.retryAfterSec * 1000
            : 1000 * Math.pow(2, attempt);
          await sleep(waitMs);
          lastErr = err;
          continue;
        }
        throw err;
      }

      const json = await res.json();
      return parseResponse(json);
    } catch (e) {
      if (e instanceof Error && 'exitCode' in e) {
        // typed OrImageError — propagate (no retry for AuthError/ParseError/etc.)
        throw e;
      }
      // Network failure (fetch threw)
      if (!retry || attempt === 2) {
        throw new NetworkError(e instanceof Error ? e.message : String(e));
      }
      lastErr = new NetworkError(e instanceof Error ? e.message : String(e));
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  throw lastErr ?? new NetworkError('Exhausted retries');
}
```

- [ ] **Step 4: Run, verify all openrouter tests pass**

```bash
cd "D:/spine" && npm test -- test/openrouter.test.ts
```

Expected: all pass. If `Body` typing complains, narrow as needed.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/openrouter.ts test/openrouter.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(openrouter): generateImage with retry, proxy dispatcher, typed errors"
```

---

## Task 15: `src/batch.ts` — `runBatch` Concurrency + Fault Tolerance

**Files:**
- Create: `src/batch.ts`
- Create: `test/batch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/batch.test.ts`:
```ts
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
```

- [ ] **Step 2: Run, verify fail**

```bash
cd "D:/spine" && npm test -- test/batch.test.ts
```

- [ ] **Step 3: Implement `src/batch.ts`**

```ts
import pLimit from 'p-limit';
import type { BatchReport, BatchTask, GenerateOpts } from './types.js';

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
```

- [ ] **Step 4: Run, verify pass**

```bash
cd "D:/spine" && npm test -- test/batch.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/spine" && git add src/batch.ts test/batch.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(batch): runBatch with p-limit concurrency + per-task fault tolerance"
```

---

## Task 16: `src/cli.ts` — Commander Setup, `t2i` Subcommand

**Files:**
- Create: `src/cli.ts`
- Modify: `package.json` (add bin file)
- Create: `bin/or-image`
- Create: `test/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/cli.test.ts`:
```ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const BIN = join(process.cwd(), 'src', 'cli.ts');
const TSX = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function run(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(TSX, [BIN, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
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
    expect(r.stdout).toContain('"prompt"') ;
    expect(r.stdout).toContain('"a cat"');
    expect(r.stdout).not.toContain('saved');
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd "D:/spine" && npm test -- test/cli.test.ts
```

- [ ] **Step 3: Create `bin/or-image`**

```bash
#!/usr/bin/env node
require('../dist/cli.js');
```

(Plain JS, no TS — this file is published as-is. We'll wire the dev path via `tsx` in `package.json` `bin` later or document `npm run dev`.)

For now, the test uses `tsx src/cli.ts` directly so `bin/or-image` is created but not exercised yet.

- [ ] **Step 4: Implement `src/cli.ts` — full file with all subcommands**

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getConfig } from './config.js';
import { generateImage } from './openrouter.js';
import { defaultOutPath, readAsBase64, saveFromBase64, maskToGrayscale } from './image.js';
import { runBatch } from './batch.js';
import {
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
  const cfg = getConfig(flags);

  if (flags.dryRun) {
    const refData = opts.ref ? await readAsBase64(opts.ref.path) : undefined;
    const { buildPayload } = await import('./openrouter.js');
    const payload = buildPayload({
      prompt: opts.prompt,
      model: flags.model!,
      ref: refData,
    });
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
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

attachGlobalFlags(
  program
    .command('t2i')
    .description('Text-to-image')
    .requiredOption('-p, --prompt <text>', 'prompt text')
    .option('--out <path>', 'output file path')
    .option('--size <WxH>', 'output size (e.g. 1024x1024)'),
).action(async (opts, cmd) => {
  const flags = cmd.optsWithGlobals<GlobalFlags>();
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
).action(async (opts, cmd) => {
  const flags = cmd.optsWithGlobals<GlobalFlags>();
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
).action(async (opts, cmd) => {
  const flags = cmd.optsWithGlobals<GlobalFlags>();
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
).action(async (opts, cmd) => {
  const flags = cmd.optsWithGlobals<GlobalFlags>();
  const tasks = await readBatchJson(opts.in);
  const cfg = getConfig(flags);
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

// Silence "force-color" noise from commander on non-TTY
program.configureOutput({});

program.parseAsync(process.argv).catch((err: unknown) => {
  const e = err instanceof OrImageError ? err : new Error(err instanceof Error ? err.message : String(err));
  process.stderr.write(`✗ ${e.message}\n`);
  if (e instanceof ContentPolicyError) process.exit(4);
  else if (e instanceof UsageError) process.exit(64);
  else if ('exitCode' in e) process.exit((e as OrImageError).exitCode);
  else process.exit(1);
});
```

- [ ] **Step 5: Run, verify CLI tests pass**

```bash
cd "D:/spine" && npm test -- test/cli.test.ts
```

Expected: 4 CLI tests pass.

- [ ] **Step 6: Verify full suite is green**

```bash
cd "D:/spine" && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "D:/spine" && git add src/cli.ts bin/or-image test/cli.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "feat(cli): commander setup with t2i, i2i, edit, batch subcommands"
```

---

## Task 17: `bin/or-image` Shebang + Build Wiring

**Files:**
- Modify: `bin/or-image` (replace stub with compiled path)

- [ ] **Step 1: Make `bin/or-image` executable and verify build output path**

```bash
cd "D:/spine" && npm run build && ls dist/
```

Expected: `dist/cli.js` and other files exist.

- [ ] **Step 2: Replace `bin/or-image` with shebang pointing to compiled JS**

```bash
#!/usr/bin/env node
require('../dist/cli.js');
```

- [ ] **Step 3: Smoke-test built CLI**

```bash
cd "D:/spine" && node bin/or-image --help
```

Expected: prints help, lists `t2i/i2i/edit/batch`, exits 0.

- [ ] **Step 4: Commit**

```bash
cd "D:/spine" && git add bin/or-image && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "chore: bin/or-image points to compiled dist/cli.js"
```

---

## Task 18: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# or-image

OpenRouter × Gemini image CLI. Generate, transform, edit, and batch images
via `google/gemini-3.1-flash-image-preview` through OpenRouter.

## Install

```bash
npm install
npm run build
```

## Configure

**Primary: system-level environment variables** (Windows: `setx
OPENROUTER_API_KEY "sk-or-v1-..."` in CMD, or PowerShell
`[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY", "sk-or-v1-...",
"User")`). OpenRouter credentials must live in the system shell env, not
in the project tree.

```powershell
[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY", "sk-or-v1-...", "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY",        "http://127.0.0.1:7890", "User")
```

**Fallback: `.env`** (gitignored). dotenv only populates `process.env` if
the var is unset, so system env always wins.

```
OPENROUTER_API_KEY=sk-or-v1-...
HTTPS_PROXY=http://127.0.0.1:7890
```

CLI flag `--api-key` overrides everything but is not recommended
(shell history).

## Usage

### Text-to-image

```bash
node bin/or-image t2i --prompt "a cyberpunk cat" --out cat.png
```

### Image-to-image

```bash
node bin/or-image i2i --prompt "make it watercolor" --ref cat.png --strength 0.6 --out cat-wc.png
```

### Local edit

Mask is a single-channel PNG; white = editable region.

```bash
node bin/or-image edit --prompt "replace with a fox" --ref cat.png --mask mask.png --out cat-fox.png
```

### Batch

`prompts.json`:
```json
[
  { "prompt": "a cyberpunk cat", "out": "./cat.png" },
  { "prompt": "make it watercolor", "ref": "./cat.png", "out": "./cat-wc.png" }
]
```

```bash
node bin/or-image batch --in prompts.json --concurrency 4
```

## Flags (global)

- `--api-key <key>` — override API key
- `--proxy <url>` — override proxy
- `--model <id>` — model id (default `google/gemini-3.1-flash-image-preview`)
- `--dry-run` — print payload, do not send
- `--verbose` — print request/response details
- `--no-retry` — disable retry on 429 / 5xx

## Testing

```bash
npm test           # unit tests
npm run test:e2e   # real API calls (requires key, exports OR_E2E=1)
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | unexpected error |
| 2 | auth failed |
| 3 | rate limited |
| 4 | content blocked |
| 5 | network error |
| 6 | bad response |
| 7 | file I/O |
| 64 | usage error |
```

- [ ] **Step 2: Commit**

```bash
cd "D:/spine" && git add README.md && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "docs: README with usage examples"
```

---

## Task 19: e2e Gate

**Files:**
- Create: `test/e2e.test.ts`

- [ ] **Step 1: Write e2e test (skipped unless OR_E2E=1)**

```ts
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
```

- [ ] **Step 2: Verify test is skipped by default**

```bash
cd "D:/spine" && npm test
```

Expected: e2e is reported as skipped, others all pass.

- [ ] **Step 3: Commit**

```bash
cd "D:/spine" && git add test/e2e.test.ts && git -c user.name=xiaozzk -c user.email=xiaozzk@local commit -m "test(e2e): gated real-API smoke"
```

---

## Final Verification

- [ ] **Step 1: Full unit test suite green**

```bash
cd "D:/spine" && npm test
```

Expected: every test passes, e2e skipped.

- [ ] **Step 2: Lint clean**

```bash
cd "D:/spine" && npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Build succeeds**

```bash
cd "D:/spine" && npm run build
```

Expected: `dist/` populated, no errors.

- [ ] **Step 4: CLI smoke**

```bash
cd "D:/spine" && node bin/or-image --help
cd "D:/spine" && node bin/or-image --dry-run t2i --prompt "hello"
```

Expected: help text + payload JSON.

---

## Done Criteria

- All 19 tasks complete with green commits
- `npm test` reports zero failures (e2e skipped)
- `npm run build` produces `dist/cli.js`
- `node bin/or-image --help` lists all four subcommands
- `.env` is gitignored and holds real key + proxy
- User can run `node bin/or-image t2i --prompt "..."` against the real API once they re-issue the API key
