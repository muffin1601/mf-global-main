// Content sniffing for uploads. Never trust the client-supplied MIME type or the
// file extension: check the leading bytes.
export type DetectedFile = "jpeg" | "png" | "webp" | "gif" | "pdf" | "doc" | "docx" | "xlsx" | "csv-or-text";

const startsWith = (b: Buffer, bytes: number[]) => b.length >= bytes.length && bytes.every((v, i) => b[i] === v);

export function detectFileType(buffer: Buffer): DetectedFile | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buffer.subarray(0, 6).toString("latin1") === "GIF87a" || buffer.subarray(0, 6).toString("latin1") === "GIF89a") return "gif";
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    if (buffer.includes(Buffer.from("word/document.xml"))) return "docx";
    if (buffer.includes(Buffer.from("xl/workbook.xml"))) return "xlsx";
  }
  return null;
}

export const IMAGE_TYPES: ReadonlySet<DetectedFile> = new Set(["jpeg", "png", "webp", "gif"]);
export const MIME: Record<DetectedFile, string> = {
  jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "csv-or-text": "text/plain",
};
export const EXTENSION: Record<DetectedFile, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif", pdf: "pdf", doc: "doc", docx: "docx", xlsx: "xlsx", "csv-or-text": "txt" };
