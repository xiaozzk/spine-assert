import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { FileIOError } from './types.js';

export interface DataUrlParts {
  mime: string;
  b64: string;
}

const MAGIC_TO_MIME: Array<{ mime: string; check: (b: Buffer) => boolean }> = [
  { mime: 'image/png', check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', check: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'image/gif', check: (b) => b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a' },
];

export async function readAsBase64(path: string): Promise<DataUrlParts> {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new FileIOError(`Cannot read ${path}: ${msg}`);
  }

  const mime = sniffMime(buf);
  if (!mime) {
    throw new FileIOError(`Unsupported image format: ${path}`);
  }
  return { mime, b64: buf.toString('base64') };
}

function sniffMime(buf: Buffer): string | undefined {
  for (const { mime, check } of MAGIC_TO_MIME) {
    if (check(buf)) return mime;
  }
  return undefined;
}
