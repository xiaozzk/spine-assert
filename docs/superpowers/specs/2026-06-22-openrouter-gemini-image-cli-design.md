# OpenRouter × Gemini Image CLI — Design

**Date:** 2026-06-22
**Status:** Approved (pending user spec review)
**Owner:** xiaozzk

## Purpose

A Node.js + TypeScript CLI that wraps the OpenRouter API to drive
`google/gemini-3.1-flash-image-preview` for image generation. Supports
text-to-image, image-to-image, local inpaint/edit, and JSON-driven batch
processing. No multi-turn conversation.

## Non-Goals

- Multi-turn chat with the model
- Direct Google AI Studio API (must go through OpenRouter)
- GUI / TUI
- Other providers or models in this CLI (the interface is generic enough
  to add later via `--model`, but no code is added for them now)

## Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 22 (LTS) | Native `fetch`, no deps |
| Language | TypeScript (strict) | Type safety for API contracts |
| CLI parser | `commander` | De facto standard, minimal API |
| HTTP | native `fetch` | Zero deps |
| Image I/O | `sharp` | Format conversion + base64 helpers |
| Env loading | `dotenv` | Reads `.env` automatically |
| Concurrency | `p-limit` | Bounded concurrency for batch |
| Testing | `vitest` | Fast, native TS/ESM |
| Build | `tsc` → `dist/` | Simple, no bundler needed |
| Distribution | `bin/or-image` shebang → `dist/cli.js` | Runs after `npm i -g` |

## Architecture

Layered modules under `src/`:

```
bin/or-image ──► src/cli.ts (commander)
                     │
                     ▼
              src/openrouter.ts ── HTTP + payload + response parsing
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   src/image.ts  src/batch.ts  src/config.ts
   (I/O)        (concurrency) (env + .env)
        │            │            │
        └────────────┴────────────┘
                     ▼
              src/types.ts (shared)
```

Each module has one responsibility, exposes a small surface, and is
unit-tested in isolation. `cli.ts` is the only place that wires modules
together.

### Module Responsibilities

**`bin/or-image`** — shebang entry. `#!/usr/bin/env node` + `require('../dist/cli.js')`.

**`src/cli.ts`** — defines 4 subcommands (`t2i`, `i2i`, `edit`, `batch`),
global flags (`--model`, `--api-key`, `--dry-run`, `--verbose`,
`--no-retry`). Validates inputs, calls into other modules, formats
console output, sets process exit code.

**`src/config.ts`** — resolves API key in this order:
1. `argv.apiKey` (`--api-key`)
2. `process.env.OPENROUTER_API_KEY`
3. `.env` file at cwd (loaded by `dotenv`)
Returns `string` or throws `UsageError("OPENROUTER_API_KEY not set")`.

**`src/openrouter.ts`** — exports:
- `generateImage(opts: GenerateOpts): Promise<Buffer>`
- internal `buildPayload(opts)`, `parseResponse(json)`, `classifyError(status, body)`

Payload shape sent to OpenRouter (`/api/v1/chat/completions`):

```json
{
  "model": "google/gemini-3.1-flash-image-preview",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "<prompt>" },
      { "type": "image_url", "image_url": { "url": "data:<mime>;base64,<...>" } }
    ]
  }],
  "modalities": ["image", "text"]
}
```

Response shape: `choices[0].message.images[]` where each image is
`{type: "image_url", image_url: {url: "data:image/png;base64,..."}}`.
We decode the base64 portion and return it as a `Buffer`.

**`src/image.ts`** — exports:
- `readAsBase64(path: string): Promise<{mime: string, b64: string}>`
  - Reads file, sniffs MIME from magic bytes (PNG/JPEG/WEBP), returns data URL parts.
- `saveFromBase64(b64: string, outPath: string): Promise<void>`
  - Writes buffer to disk, creates parent dirs. Uses `sharp` only for
    format validation (catches corrupt data).
- `defaultOutPath(index?: number): string`
  - Returns `./output/or-image-<ts>-<n>.png`.

**`src/batch.ts`** — exports:
- `runBatch(tasks: BatchTask[], opts: BatchOpts): Promise<BatchReport>`
  - Uses `p-limit(opts.concurrency ?? 4)` to bound in-flight calls.
  - Wraps each task in try/catch; failures accumulate, do not abort.
  - Emits per-task lines via callback (`onProgress(task, result|error)`).
  - Returns `{total, succeeded, failed, failures: [{index, error}]}`.

**`src/types.ts`** — all shared interfaces: `GenerateOpts`, `BatchTask`,
`BatchReport`, `Mode` union, error class hierarchy.

## CLI Command Surface

```bash
# 1) Text-to-image
or-image t2i \
  --prompt "a cyberpunk cat, neon lighting" \
  --out ./cat.png \
  [--size 1024x1024] \
  [--seed 42]

# 2) Image-to-image
or-image i2i \
  --prompt "make it watercolor" \
  --ref ./cat.png \
  --strength 0.6 \
  --out ./cat-watercolor.png

# 3) Local edit (inpaint)
or-image edit \
  --prompt "replace with a fox" \
  --ref ./cat.png \
  --mask ./cat-mask.png \
  --out ./cat-fox.png

# 4) Batch
or-image batch \
  --in ./prompts.json \
  [--concurrency 4] \
  [--out-dir ./output/]

# Global flags (apply to every subcommand)
--model google/gemini-3.1-flash-image-preview   # default
--api-key sk-xxx                                 # override env (not recommended)
--dry-run                                        # print payload, don't send
--verbose                                        # full request/response
--no-retry                                       # disable auto-retry
```

`prompts.json` (batch input):

```json
[
  { "prompt": "a cyberpunk cat", "out": "./cat.png" },
  {
    "prompt": "make it watercolor",
    "ref": "./cat.png",
    "strength": 0.6,
    "out": "./cat-watercolor.png"
  },
  {
    "prompt": "replace with a fox",
    "ref": "./cat.png",
    "mask": "./cat-mask.png",
    "out": "./cat-fox.png"
  }
]
```

`mask` is a single-channel grayscale PNG; white pixels = editable region.
The implementation calls `sharp(maskPath).grayscale().raw()` to extract the
mask regardless of whether the source PNG is RGB or already grayscale.

`--size` applies only to `t2i`; `i2i` and `edit` inherit dimensions from
`--ref`.

API key resolution priority (highest to lowest): `--api-key` flag >
`OPENROUTER_API_KEY` env var > `.env` file at cwd.

## Error Handling

Typed error hierarchy in `src/types.ts`:

```ts
class OrImageError extends Error { abstract exitCode: number }
class UsageError extends OrImageError { exitCode = 64 }
class AuthError extends OrImageError { exitCode = 2 }
class RateLimitError extends OrImageError { exitCode = 3; retryAfterSec?: number }
class ContentPolicyError extends OrImageError { exitCode = 4 }
class NetworkError extends OrImageError { exitCode = 5 }
class ParseError extends OrImageError { exitCode = 6 }
class FileIOError extends OrImageError { exitCode = 7 }
```

`openrouter.ts` maps HTTP status + body to these classes.
`cli.ts` catches at the top, prints `✗ <msg>`, sets exit code.

### Retry Policy

- Applies only to `RateLimitError` and `NetworkError`.
- Exponential backoff: 1s → 2s → 4s, max 3 attempts.
- Honors `Retry-After` header on 429.
- `--no-retry` disables.

### Batch Fault Tolerance

- Per-task try/catch; failures don't abort the batch.
- Summary line on completion: `[BATCH] 12 total · 10 succeeded · 2 failed in 45.3s`
- Optional `--errors-file ./errors.json` writes
  `[{index, prompt, error: {name, message}}]`.

## Data Flow

### Single call (`t2i`)

1. `bin/or-image` → `cli.ts` parses argv into `GenerateOpts`.
2. `config.ts` resolves API key (env or `.env`).
3. `openrouter.generateImage(opts)` builds payload, POSTs, parses response.
4. `image.saveFromBase64(b64, outPath)` writes file.
5. `cli.ts` prints `[OK] ./cat.png · 1.2MB · 4.2s` and exits 0.

### Batch

1. `batch.runBatch(tasks, opts)` reads JSON, validates each task.
2. Schedules tasks through `p-limit(concurrency)`.
3. Each task calls `openrouter.generateImage` + `image.saveFromBase64`.
4. `onProgress` emits per-line status.
5. On completion: write summary; optionally write `--errors-file`.

## Output Conventions

- `[OK]` prefix on success.
- `[ERR]` on individual failure (batch mode).
- `[BATCH]` summary.
- `✗` for top-level errors.
- Sizes in MB / KB, durations in seconds (1 decimal).
- Paths printed as the user wrote them (no normalization).

## Project Layout

```
spine/
├── bin/
│   └── or-image                  # shebang entry
├── src/
│   ├── cli.ts                    # commander setup, exit handling
│   ├── openrouter.ts             # API client
│   ├── image.ts                  # file I/O helpers
│   ├── batch.ts                  # batch dispatcher
│   ├── config.ts                 # env + .env resolution
│   └── types.ts                  # interfaces + error classes
├── test/
│   ├── openrouter.test.ts
│   ├── image.test.ts
│   ├── batch.test.ts
│   └── cli.test.ts
├── docs/superpowers/specs/       # this file
├── package.json
├── tsconfig.json
├── .env.example                  # documents OPENROUTER_API_KEY
├── .gitignore                    # node_modules, dist, .env
└── README.md                     # usage examples + install
```

## Dependencies

Runtime:
- `commander` ^12
- `sharp` ^0.33
- `dotenv` ^16
- `p-limit` ^5

Dev:
- `typescript` ^5.4
- `vitest` ^1.6
- `@types/node` ^22

`package.json` `bin` field: `{ "or-image": "bin/or-image" }`.

## Testing Strategy

| Layer | File | Method | Coverage |
|---|---|---|---|
| Unit | `openrouter.test.ts` | mock `globalThis.fetch` | payload build, base64 parse, error classification, retry |
| Unit | `image.test.ts` | real fs + tmp dir | base64 round-trip, sharp validation, default path |
| Unit | `batch.test.ts` | inject mock `generateImage` | concurrency cap, error isolation, summary |
| Unit | `cli.test.ts` | `child_process.spawn` | argv parsing, --dry-run output, exit codes |
| E2E | `e2e.test.ts` | real API | gated on `OR_E2E=1`, default off |

Key test cases:

- `extracts base64 image from multimodal response`
- `raises AuthError on 401`
- `raises RateLimitError on 429, reads Retry-After`
- `raises ContentPolicyError on 400 with safety block`
- `retries NetworkError up to 3 times with exponential backoff`
- `--no-retry disables retry`
- `batch runs N tasks with concurrency cap`
- `batch continues after individual failures`
- `batch emits summary line at the end`
- `batch writes errors.json when --errors-file is set`

Scripts in `package.json`:

- `npm test` — vitest, excludes `e2e.test.ts`
- `npm run test:e2e` — `OR_E2E=1 vitest run`
- `npm run lint` — `tsc --noEmit`
- `npm run build` — `tsc` → `dist/`
- `npm run dev` — `tsx src/cli.ts` for local runs

## Open Questions for User

None — all design questions resolved during brainstorming.
