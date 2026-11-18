import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { BUCKETS, storage } from "@/lib/storage";
import { detectFileType } from "@/lib/files/signature";
import { prisma } from "@/lib/prisma/client";
import { isAdmin, type Actor } from "@/server/actor";
import { forbidden } from "@/server/errors";
import { calculateLineItem } from "./calc";
import { getQuotation, quotationNumber, type QuotationDto } from "./service";

const MARGIN = 36;
const money = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Product image bytes (JPEG/PNG only) from our own storage; never fetches arbitrary URLs and never throws. */
async function loadItemImage(image: string): Promise<Buffer | null> {
  try {
    if (!image || /^[a-z]+:\/\//i.test(image)) return null;
    const clean = image.replace(/^\/+/, "").replace(/^uploads\/products\//, "");
    if (clean.includes("..")) return null;
    const body = await Promise.race([storage.download(BUCKETS.productImages, clean), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    if (!body || body.length > 2_000_000) return null;
    const type = detectFileType(body);
    return type === "jpeg" || type === "png" ? body : null;
  } catch {
    return null;
  }
}

async function loadQr(): Promise<Buffer | null> {
  try { return await readFile(path.join(process.cwd(), "public", "QR.png")); } catch { return null; }
}

export async function renderQuotationPdf(q: QuotationDto): Promise<Buffer> {
  const settings = await prisma.companySettings.findFirst().catch(() => null);
  const images = await Promise.all(q.items.map((i) => loadItemImage(i.image)));
  const qr = await loadQr();
  const number = quotationNumber(q.invoiceDetails);

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, compress: false, info: { Title: `Quotation ${number}`, Author: settings?.companyName || "Quotation" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });

  const W = doc.page.width - MARGIN * 2;
  const bottom = () => doc.page.height - MARGIN - 20;
  const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };

  // Header
  doc.font("Helvetica-Bold").fontSize(16).text((settings?.companyName || "").toUpperCase() || "QUOTATION", MARGIN, MARGIN, { width: W });
  doc.font("Helvetica").fontSize(9).fillColor("#444");
  if (settings?.address) doc.text(settings.address, { width: W });
  const ids = [settings?.gst ? `GSTIN: ${settings.gst}` : "", settings?.pan ? `PAN: ${settings.pan}` : ""].filter(Boolean).join("   ");
  if (ids) doc.text(ids);
  doc.fillColor("#000").moveDown(0.6);

  // Quotation info
  doc.font("Helvetica-Bold").fontSize(13).text("QUOTATION", { width: W });
  doc.font("Helvetica").fontSize(10);
  doc.text(`Quotation No.: ${number}`);
  doc.text(`Date: ${fmtDate(q.invoiceDetails.date)}      Valid Till: ${fmtDate(q.invoiceDetails.validityDate)}`);
  if (q.invoiceDetails.poNo) doc.text(`PO No.: ${str(q.invoiceDetails.poNo)}`);
  if (q.invoiceDetails.placeOfSupply) doc.text(`Place of Supply: ${str(q.invoiceDetails.placeOfSupply)}`);
  doc.moveDown(0.6);

  // Parties
  const party = q.party;
  const ship = (party.selectedShippingAddress ?? {}) as Record<string, unknown>;
  const top = doc.y;
  const half = W / 2 - 6;
  doc.font("Helvetica-Bold").fontSize(9).text("BILL TO", MARGIN, top, { width: half });
  doc.font("Helvetica-Bold").fontSize(10).text(str(party.company || party.name), { width: half });
  doc.font("Helvetica").fontSize(9);
  if (party.company && party.name && party.company !== party.name) doc.text(str(party.name), { width: half });
  doc.text(str(party.billToAddress), { width: half });
  if (party.phone) doc.text(`Phone: ${str(party.phone)}`, { width: half });
  if (party.pan) doc.text(`PAN: ${str(party.pan)}`, { width: half });
  const leftEnd = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).text("SHIP TO", MARGIN + half + 12, top, { width: half });
  doc.font("Helvetica").fontSize(9).text(str(ship.address || party.billToAddress), { width: half });
  doc.y = Math.max(leftEnd, doc.y) + 10;

  // Items table
  const cols = [
    { h: "No", w: 24, a: "left" as const }, { h: "Image", w: 44, a: "left" as const }, { h: "Description", w: W - 24 - 44 - 36 - 58 - 62 - 34 - 54 - 66, a: "left" as const },
    { h: "Qty", w: 36, a: "right" as const }, { h: "Rate", w: 58, a: "right" as const }, { h: "Taxable", w: 62, a: "right" as const },
    { h: "GST%", w: 34, a: "right" as const }, { h: "GST Amt", w: 54, a: "right" as const }, { h: "Total", w: 66, a: "right" as const },
  ];
  const header = () => {
    const y = doc.y;
    doc.rect(MARGIN, y, W, 18).fill("#eceff3").fillColor("#000").font("Helvetica-Bold").fontSize(8);
    let x = MARGIN;
    for (const c of cols) { doc.text(c.h, x + 3, y + 5, { width: c.w - 6, align: c.a, lineBreak: false }); x += c.w; }
    doc.y = y + 20;
  };
  header();
  q.items.forEach((it, i) => {
    const li = calculateLineItem(it);
    const img = images[i];
    const descH = doc.font("Helvetica").fontSize(8).heightOfString(it.name + (it.hsn ? `\nHSN: ${it.hsn}` : ""), { width: (cols[2]?.w ?? 100) - 6 });
    const rowH = Math.max(img ? 40 : 16, descH + 8);
    if (doc.y + rowH > bottom()) { doc.addPage(); header(); }
    const y = doc.y;
    const cells = [String(i + 1), "", it.name + (it.hsn ? `\nHSN: ${it.hsn}` : ""), String(it.qty), li.price.toFixed(2), li.taxableValue.toFixed(2), `${li.taxRate}%`, li.taxAmount.toFixed(2), li.total.toFixed(2)];
    let x = MARGIN;
    cols.forEach((c, k) => {
      if (k !== 1) doc.font("Helvetica").fontSize(8).text(cells[k] ?? "", x + 3, y + 4, { width: c.w - 6, align: c.a });
      x += c.w;
    });
    if (img) { try { doc.image(img, MARGIN + (cols[0]?.w ?? 24) + 3, y + 2, { fit: [38, 36] }); } catch { /* unreadable image: skip */ } }
    doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + W, y + rowH).strokeColor("#d5d9e0").stroke().strokeColor("#000");
    doc.y = y + rowH + 2;
  });

  // Totals
  ensure(130);
  doc.moveDown(0.5);
  const t = q.totals;
  const rows: [string, string, boolean?][] = [["Subtotal", money(t.subtotal)], ["Tax / GST", money(t.totalTax)]];
  if (t.totalDiscount) rows.push(["Discount", `-${money(t.totalDiscount)}`]);
  if (t.additionalCharges) rows.push(["Additional Charges", money(t.additionalCharges)]);
  if (t.roundOff) rows.push(["Round Off", `${t.roundOff < 0 ? "-" : ""}${money(Math.abs(t.roundOff))}`]);
  rows.push(["Grand Total", money(t.grandTotal), true]);
  if (t.amountReceived) { rows.push(["Amount Received", money(t.amountReceived)]); rows.push(["Balance", money(t.balanceAmount)]); }
  const tx = MARGIN + W - 220;
  for (const [label, value, bold] of rows) {
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
    doc.text(label, tx, y, { width: 100, lineBreak: false });
    doc.text(value, tx + 100, y, { width: 120, align: "right" });
  }
  doc.x = MARGIN;
  doc.moveDown(0.8);

  // Bank + QR
  const b = q.bankDetails;
  const bankLines = [["Account Holder", b.accountHolder], ["Bank", b.bankName], ["A/C", b.accountNumber], ["IFSC", b.ifscCode], ["UPI", b.upiId]].filter(([, v]) => v);
  if (bankLines.length) {
    ensure(20 + bankLines.length * 12 + (qr ? 80 : 0));
    doc.font("Helvetica-Bold").fontSize(10).text("Bank Details", MARGIN, doc.y);
    doc.font("Helvetica").fontSize(9);
    for (const [k, v] of bankLines) doc.text(`${k}: ${str(v)}`, MARGIN);
    if (qr) { try { doc.image(qr, MARGIN + W - 80, doc.y - bankLines.length * 12 - 10, { fit: [70, 70] }); } catch { /* skip */ } }
    doc.moveDown(0.6);
  }

  // Terms / notes
  const termLines = q.terms.split("\n").map((l) => l.trim()).filter(Boolean);
  if (termLines.length) {
    ensure(30);
    doc.font("Helvetica-Bold").fontSize(10).text("Terms & Conditions", MARGIN, doc.y);
    doc.font("Helvetica").fontSize(9);
    for (const l of termLines) { ensure(14); doc.text(`• ${l}`, MARGIN, doc.y, { width: W }); }
    doc.moveDown(0.5);
  }
  if (q.notes.trim()) {
    ensure(30);
    doc.font("Helvetica-Bold").fontSize(10).text("Notes", MARGIN, doc.y);
    doc.font("Helvetica").fontSize(9).text(q.notes, MARGIN, doc.y, { width: W });
    doc.moveDown(0.5);
  }
  ensure(60);
  doc.font("Helvetica").fontSize(9).text(`For ${settings?.companyName || ""}`, MARGIN, doc.y + 10, { width: W, align: "right" });
  doc.moveDown(2).text("Authorized Signature", MARGIN, doc.y, { width: W, align: "right" });

  doc.end();
  return done;
}

/** Authorise (owner or admin) then render. Returns the file name + bytes. */
export async function quotationPdf(actor: Actor, id: string) {
  const q = await getQuotation(actor, id); // 403 for non-owners
  if (!isAdmin(actor) && q.userId !== actor.id) throw forbidden("Access denied");
  const body = await renderQuotationPdf(q);
  const safe = quotationNumber(q.invoiceDetails).replace(/[^A-Za-z0-9._-]+/g, "_") || "quotation";
  return { name: `Quotation_${safe}.pdf`, body };
}
