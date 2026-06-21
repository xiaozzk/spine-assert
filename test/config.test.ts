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
