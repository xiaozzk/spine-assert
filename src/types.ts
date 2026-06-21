export abstract class OrImageError extends Error {
  abstract readonly exitCode: number;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UsageError extends OrImageError {
  readonly exitCode = 64;
}

export class AuthError extends OrImageError {
  readonly exitCode = 2;
}

export class NetworkError extends OrImageError {
  readonly exitCode = 5;
}

export class ParseError extends OrImageError {
  readonly exitCode = 6;
}

export class FileIOError extends OrImageError {
  readonly exitCode = 7;
}

export class RateLimitError extends OrImageError {
  readonly exitCode = 3;
  readonly retryAfterSec?: number;
  constructor(message: string, retryAfterSec?: number) {
    super(message);
    this.retryAfterSec = retryAfterSec;
  }
}

export class ContentPolicyError extends OrImageError {
  readonly exitCode = 4;
}

// ---------- shared interfaces ----------

export type Mode = 't2i' | 'i2i' | 'edit' | 'batch';

export interface GenerateOpts {
  prompt: string;
  ref?: { path: string };
  mask?: { path: string };
  size?: string;          // "1024x1024", only used for t2i
  strength?: number;      // 0..1, only used for i2i
  model?: string;         // override default
}

export interface BatchTask {
  prompt: string;
  ref?: string;           // path
  mask?: string;          // path
  strength?: number;
  size?: string;
  out: string;            // path
}

export interface BatchReport {
  total: number;
  succeeded: number;
  failed: number;
  failures: { index: number; prompt: string; error: { name: string; message: string } }[];
  totalMs: number;
}
