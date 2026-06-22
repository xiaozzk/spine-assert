# or-image

OpenRouter × Gemini image CLI. Generate, transform, edit, and batch images
via `google/gemini-3.1-flash-image-preview` through OpenRouter.

## Install

```bash
npm install
npm run build
```

## Configure

**`OPENROUTER_API_KEY` is configured as a system-level environment variable**,
not in any project file. Set it once per machine:

```powershell
# PowerShell (permanent, user-level)
[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY", "在此粘贴你的 key", "User")
```

```cmd
:: CMD (permanent, requires new terminal)
setx OPENROUTER_API_KEY "在此粘贴你的 key"
```

After setting, **open a new terminal** so the env propagates.

**`HTTPS_PROXY`** (optional) can also be set as a system env var, or kept in
the gitignored `.env` file if you prefer project-local config:

```powershell
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://127.0.0.1:7890", "User")
```

CLI flag `--api-key` overrides everything but is not recommended (shell
history).

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

> **Note (v0.1.0):** `--mask` accepts a grayscale mask path and validates it,
> but the mask image is not currently sent as a separate content part in the
> OpenRouter payload. The `edit` subcommand is effectively equivalent to
> `i2i` with a strong prompt about replacing the white region. True
> server-side inpainting (mask image sent alongside reference) is planned
> for a future version.

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