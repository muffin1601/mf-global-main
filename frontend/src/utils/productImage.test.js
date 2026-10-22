import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from './productImage';

describe('product image URL resolution', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the API origin when no separate image origin is configured', () => {
    vi.stubEnv('VITE_IMAGE_URL', '');
    vi.stubEnv('VITE_API_URL', 'http://test.local/api');
    expect(resolveProductImageUrl('/uploads/products/example.png')).toBe('http://test.local/uploads/products/example.png');
  });

  it('preserves absolute URLs and handles empty references', () => {
    expect(resolveProductImageUrl('https://cdn.example.test/a.webp')).toBe('https://cdn.example.test/a.webp');
    expect(resolveProductImageUrl('')).toBe('');
    expect(PRODUCT_IMAGE_PLACEHOLDER.startsWith('data:image/svg+xml')).toBe(true);
  });
});
