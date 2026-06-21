import { describe, test, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAsBase64 } from '../src/image.js';
import { makePng } from './helpers/makePng.js';

describe('readAsBase64', () => {
  test('reads a PNG file and returns data URL parts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'a.png');
    await writeFile(file, await makePng({ width: 4, height: 4 }));
    const result = await readAsBase64(file);
    expect(result.mime).toBe('image/png');
    expect(typeof result.b64).toBe('string');
    expect(result.b64.length).toBeGreaterThan(0);
    const buf = Buffer.from(result.b64, 'base64');
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  test('sniffs JPEG MIME from magic bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'a.jpg');
    const sharp = (await import('sharp')).default;
    const jpegBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .jpeg()
      .toBuffer();
    await writeFile(file, jpegBuf);
    const result = await readAsBase64(file);
    expect(result.mime).toBe('image/jpeg');
  });

  test('throws FileIOError on missing file', async () => {
    await expect(readAsBase64('/nonexistent/path.png')).rejects.toThrow(/ENOENT|FileIOError/);
  });

  test('throws FileIOError on unknown format', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'or-image-'));
    const file = join(dir, 'a.txt');
    await writeFile(file, 'hello world');
    await expect(readAsBase64(file)).rejects.toThrow(/unsupported/i);
  });
});
