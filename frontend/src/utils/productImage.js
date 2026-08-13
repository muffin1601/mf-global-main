// Shared helpers for product images.
//
// Product images are uploaded once by the product module (POST /add-product,
// multer -> backend/uploads/products) and stored on the product document as a
// relative path in `p_image` (e.g. "/uploads/products/1712-abc.png"). Nothing
// here uploads or copies files — a quotation item only ever keeps that same
// relative path, so an old quotation keeps pointing at the same upload and no
// image is duplicated.

/** Inline SVG placeholder — no network request, so it can never itself break. */
export const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="8" fill="#eceff3"/>
      <path d="M18 54l14-17 11 13 7-8 12 12z" fill="#c3cad4"/>
      <circle cx="29" cy="27" r="6" fill="#c3cad4"/>
    </svg>`.replace(/\s+/g, " ")
  );

/**
 * Turn a stored `p_image` path into a loadable URL.
 * Returns "" when there is no image so callers can render the placeholder.
 */
export const resolveProductImageUrl = (path) => {
  if (!path || typeof path !== "string") return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  // Already absolute (or a data URI) — use as-is.
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const base = (import.meta.env.VITE_IMAGE_URL || "").replace(/\/$/, "");
  return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
};

/**
 * Fetch an image and inline it as a data URI.
 * Used by the PDF generator: html2canvas taints/skips cross-origin images that
 * were cached without CORS headers, so the bytes are inlined up front instead.
 * Always resolves — a missing/broken image falls back to the placeholder.
 */
export const toProductImageDataUrl = async (path) => {
  const url = resolveProductImageUrl(path);
  if (!url) return PRODUCT_IMAGE_PLACEHOLDER;
  if (url.startsWith("data:")) return url;

  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return PRODUCT_IMAGE_PLACEHOLDER;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || PRODUCT_IMAGE_PLACEHOLDER);
      reader.onerror = () => resolve(PRODUCT_IMAGE_PLACEHOLDER);
      reader.readAsDataURL(blob);
    });
  } catch {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }
};
