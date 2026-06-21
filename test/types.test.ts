import { describe, test, expect } from 'vitest';
import {
  OrImageError,
  UsageError,
  AuthError,
  RateLimitError,
  ContentPolicyError,
  NetworkError,
  ParseError,
  FileIOError,
} from '../src/types.js';

describe('error classes', () => {
  test('UsageError is an OrImageError with exitCode 64', () => {
    const e = new UsageError('bad arg');
    expect(e).toBeInstanceOf(OrImageError);
    expect(e.exitCode).toBe(64);
    expect(e.message).toBe('bad arg');
  });

  test('AuthError has exitCode 2', () => {
    expect(new AuthError('x').exitCode).toBe(2);
  });

  test('RateLimitError has exitCode 3 and optional retryAfterSec', () => {
    const e = new RateLimitError('slow down', 12);
    expect(e.exitCode).toBe(3);
    expect(e.retryAfterSec).toBe(12);
  });

  test('RateLimitError retryAfterSec is optional', () => {
    expect(new RateLimitError('x').retryAfterSec).toBeUndefined();
  });

  test('ContentPolicyError has exitCode 4', () => {
    expect(new ContentPolicyError('x').exitCode).toBe(4);
  });

  test('NetworkError has exitCode 5', () => {
    expect(new NetworkError('x').exitCode).toBe(5);
  });

  test('ParseError has exitCode 6', () => {
    expect(new ParseError('x').exitCode).toBe(6);
  });

  test('FileIOError has exitCode 7', () => {
    expect(new FileIOError('x').exitCode).toBe(7);
  });

  test('name property reflects concrete class', () => {
    expect(new AuthError('x').name).toBe('AuthError');
    expect(new NetworkError('x').name).toBe('NetworkError');
  });
});
