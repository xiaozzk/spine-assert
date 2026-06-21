import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
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

export async function saveFromBase64(b64: string, outPath: string): Promise<void> {
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch (e) {
    throw new FileIOError(`Invalid base64 input: ${e instanceof Error ? e.message : e}`);
  }

  try {
    await sharp(buf).metadata();
  } catch (e) {
    throw new FileIOError(
      `Decoded bytes are not a valid image: ${e instanceof Error ? e.message : e}`,
    );
  }

  try {
    await mkdir(dirname(outPath), { recursive: true });
    await sharp(buf).toFile(outPath);
  } catch (e) {
    throw new FileIOError(`Cannot write ${outPath}: ${e instanceof Error ? e.message : e}`);
  }
}

export function defaultOutPath(index?: number): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = index !== undefined ? `-${index}` : '';
  return `output/or-image-${ts}${suffix}.png`;
}

export interface GrayscaleMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export async function maskToGrayscale(path: string): Promise<GrayscaleMask> {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch (e) {
    throw new FileIOError(`Cannot read mask ${path}: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const { data, info } = await sharp(buf).grayscale().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data) };
  } catch (e) {
    throw new FileIOError(`Cannot decode mask ${path}: ${e instanceof Error ? e.message : e}`);
  }
}
