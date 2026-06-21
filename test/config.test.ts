import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, resolveApiKey } from '../src/config.js';
import { UsageError } from '../src/types.js';

describe('getConfig — api key', () => {
  const ORIGINAL_ENV = process.env;

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

  test('resolveApiKey returns undefined when no key', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(resolveApiKey({})).toBeUndefined();
  });

  test('getConfig throws UsageError when resolveApiKey returns undefined', () => {
    expect(() => getConfig({ apiKey: undefined })).toThrow(UsageError);
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
