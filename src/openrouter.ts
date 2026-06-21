import { Agent, ProxyAgent, type Dispatcher } from 'undici';
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
  const url = images[0]?.image_url?.url;
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
    new URL(cfg.proxyUrl);
    const isSocks = /^socks[45]?:/i.test(cfg.proxyUrl);
    let agent: Dispatcher;
    if (isSocks) {
      // undici's Agent supports socks proxy via connect.proxy at runtime,
      // but the public types do not declare it. Cast to keep both happy.
      const opts = { connect: { proxy: cfg.proxyUrl } } as unknown as ConstructorParameters<typeof Agent>[0];
      agent = new Agent(opts) as unknown as Dispatcher;
    } else {
      agent = new ProxyAgent({ uri: cfg.proxyUrl }) as unknown as Dispatcher;
    }
    cachedDispatcher = agent;
    return cachedDispatcher;
  } catch (e) {
    cachedDispatcher = 'invalid';
    const masked = cfg.proxyUrl.replace(/\/\/[^@/]+@/, '//***@');
    throw new UsageError(`Invalid proxy URL "${masked}": ${e instanceof Error ? e.message : e}`);
  }
}

export function _resetDispatcherCacheForTests(): void {
  cachedDispatcher = undefined;
}
export interface GenerateOptions {
  retry?: boolean;
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
    const refObj = opts.ref as { path?: string; mime?: string; b64?: string };
    if (refObj.mime && refObj.b64) {
      refData = { mime: refObj.mime, b64: refObj.b64 };
    } else if (refObj.path) {
      const { readAsBase64 } = await import('./image.js');
      refData = await readAsBase64(refObj.path);
    }
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
        throw e;
      }
      if (!retry || attempt === 2) {
        throw new NetworkError(e instanceof Error ? e.message : String(e));
      }
      lastErr = new NetworkError(e instanceof Error ? e.message : String(e));
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  throw lastErr ?? new NetworkError('Exhausted retries');
}