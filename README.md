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