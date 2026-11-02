import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';

/**
 * Strips HTML from every string a request hands a route, walking arrays and
 * plain objects. Anything else passes through untouched: an uploaded file's
 * `Buffer`, a `Date`, a class instance. Rebuilding those as plain objects
 * turned multer's buffer into `{ 0: …, 1: … }`, and every upload failed.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.stripHtml(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (isPlainObject(value)) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    return value;
  }

  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
