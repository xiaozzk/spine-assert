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
export function classifyError(status: number, bodyText: string, headers: Headers): Error {
  throw new Error('not implemented');
}
export function getDispatcher(_cfg: AppConfig): Dispatcher | undefined {
  return undefined;
}
export async function generateImage(_opts: GenerateOpts, _cfg: AppConfig): Promise<Buffer> {
  throw new Error('not implemented');
}