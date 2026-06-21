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