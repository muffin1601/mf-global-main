const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { PRODUCT_UPLOAD_DIR, detectImageExtension, resolveStoredImagePath } = require('../utils/productImages');

test('detects supported image formats from file signatures, not names', () => {
  assert.equal(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), '.jpg');
  assert.equal(detectImageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), '.png');
  assert.equal(detectImageExtension(Buffer.from('not really an image')), null);
});

test('stored product paths cannot escape the canonical upload directory', () => {
  assert.equal(resolveStoredImagePath('/uploads/products/../../secret.png'), null);
  assert.equal(resolveStoredImagePath('/uploads/other/file.png'), null);
  assert.equal(resolveStoredImagePath('/uploads/products/product-safe.png'), path.join(PRODUCT_UPLOAD_DIR, 'product-safe.png'));
});
