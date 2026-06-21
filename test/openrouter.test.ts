import { describe, test, expect } from 'vitest';
import { buildPayload } from '../src/openrouter.js';
import { makePng } from './helpers/makePng.js';

describe('buildPayload', () => {
  test('text-only payload', () => {
    const payload = buildPayload({
      prompt: 'a cat',
      model: 'google/gemini-3.1-flash-image-preview',
    });
    expect(payload.model).toBe('google/gemini-3.1-flash-image-preview');
    expect(payload.modalities).toEqual(['image', 'text']);
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0].role).toBe('user');
    expect(payload.messages[0].content).toEqual([{ type: 'text', text: 'a cat' }]);
  });

  test('text + reference image payload', async () => {
    const png = await makePng({ width: 2, height: 2 });
    const payload = buildPayload({
      prompt: 'make it blue',
      model: 'm',
      ref: { mime: 'image/png', b64: png.toString('base64') },
    });
    const content = payload.messages[0].content;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: 'text', text: 'make it blue' });
    expect(content[1].type).toBe('image_url');
    expect(content[1].image_url.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('does not include strength/size in payload (those are CLI-only hints)', () => {
    const payload = buildPayload({
      prompt: 'x',
      model: 'm',
      size: '512x512',
      strength: 0.5,
    });
    const json = JSON.stringify(payload);
    expect(json).not.toContain('strength');
    expect(json).not.toContain('size');
  });
});