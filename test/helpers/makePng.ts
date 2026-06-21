import sharp from 'sharp';

export async function makePng(opts: {
  width?: number;
  height?: number;
  color?: { r: number; g: number; b: number; alpha?: number };
}): Promise<Buffer> {
  const { width = 4, height = 4, color = { r: 255, g: 0, b: 0, alpha: 1 } } = opts;
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}
