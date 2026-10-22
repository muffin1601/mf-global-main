const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PRODUCT_UPLOAD_DIR = path.resolve(__dirname, "../uploads/products");
const PRODUCT_PUBLIC_PREFIX = "/uploads/products/";

const detectImageExtension = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return ".jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return ".gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return ".webp";
  return null;
};

const saveProductImage = async (file) => {
  if (!file) return null;
  const extension = detectImageExtension(file.buffer);
  if (!extension) {
    const error = new Error("The uploaded file content is not a supported image.");
    error.status = 400;
    throw error;
  }
  await fs.promises.mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });
  const filename = `product-${crypto.randomUUID()}${extension}`;
  await fs.promises.writeFile(path.join(PRODUCT_UPLOAD_DIR, filename), file.buffer, { flag: "wx" });
  return `${PRODUCT_PUBLIC_PREFIX}${filename}`;
};

const resolveStoredImagePath = (publicPath) => {
  if (typeof publicPath !== "string" || !publicPath.startsWith(PRODUCT_PUBLIC_PREFIX)) return null;
  const filename = publicPath.slice(PRODUCT_PUBLIC_PREFIX.length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || path.basename(filename) !== filename) return null;
  const resolved = path.resolve(PRODUCT_UPLOAD_DIR, filename);
  return path.dirname(resolved) === PRODUCT_UPLOAD_DIR ? resolved : null;
};

const deleteProductImage = async (publicPath) => {
  const storedPath = resolveStoredImagePath(publicPath);
  if (!storedPath) return false;
  try {
    await fs.promises.unlink(storedPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

module.exports = { PRODUCT_UPLOAD_DIR, PRODUCT_PUBLIC_PREFIX, detectImageExtension, saveProductImage, resolveStoredImagePath, deleteProductImage };
