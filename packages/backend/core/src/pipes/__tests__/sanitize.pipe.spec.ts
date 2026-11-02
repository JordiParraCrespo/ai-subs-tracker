import { describe, expect, it } from 'vitest';
import { SanitizePipe } from '../sanitize.pipe';

const pipe = new SanitizePipe();
const meta = { type: 'body' } as const;

describe('SanitizePipe', () => {
  it('strips HTML from strings in nested objects and arrays', () => {
    expect(pipe.transform({ a: '<b>hi</b>', list: ['<i>x</i>'] }, meta)).toEqual({
      a: 'hi',
      list: ['x'],
    });
  });

  // Rebuilding a Buffer as a plain object turned multer's upload into
  // `{ 0: …, 1: … }`, and writing it to storage threw: every avatar upload
  // answered 500.
  it('passes an uploaded file through with its Buffer intact', () => {
    const file = { originalname: 'a.png', buffer: Buffer.from([1, 2, 3]) };
    const out = pipe.transform(file, { type: 'custom' }) as typeof file;
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect([...out.buffer]).toEqual([1, 2, 3]);
  });

  it('leaves a Date as a Date', () => {
    const at = new Date('2026-11-02T00:00:00Z');
    expect(pipe.transform({ at }, meta)).toEqual({ at });
    expect((pipe.transform({ at }, meta) as { at: unknown }).at).toBeInstanceOf(Date);
  });
});
