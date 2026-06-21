import { describe, test, expect, afterEach } from 'vitest';
import {
  buildPayload,
  parseResponse,
  classifyError,
  getDispatcher,
  _resetDispatcherCacheForTests,
} from '../src/openrouter.js';
import { makePng } from './helpers/makePng.js';
import sharp from 'sharp';
import { AuthError, ContentPolicyError, RateLimitError, NetworkError } from '../src/types.js';
import type { AppConfig } from '../src/config.js';

const cfg = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  apiKey: 'sk-or-v1-x',
  proxyUrl: undefined,
  ...overrides,
});

afterEach(() => {
  _resetDispatcherCacheForTests();
});

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
    expect(buf[0]).toBe(0x89);
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
  test('400 generic → message preserved', () => {
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