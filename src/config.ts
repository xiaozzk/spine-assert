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

export function getConfig(opts: ConfigOpts): AppConfig {
  const apiKey = resolveApiKey(opts);
  if (!apiKey) {
    throw new UsageError(
      'OPENROUTER_API_KEY not set. Provide via --api-key, env var, or .env file.',
    );
  }
  return { apiKey, proxyUrl: undefined };
}
