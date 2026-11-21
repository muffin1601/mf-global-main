import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { BUCKETS, storage } from "@/lib/storage";
import { detectFileType } from "@/lib/files/signature";
import { prisma } from "@/lib/prisma/client";
import { isAdmin, type Actor } from "@/server/actor";
import { forbidden } from "@/server/errors";
import { objectPathOf } from "@/server/catalog/images";
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
    if (!image) return null;
    const clean = /^[a-z]+:\/\//i.test(image) ? objectPathOf(image) : image.replace(/^\/+/, "").replace(/^uploads\/products\//, "");
    if (!clean || clean.includes("..")) return null;
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
  // The bundled payment QR encodes this UPI payee. Only print it for a matching quote.
  const qr = str(q.bankDetails.upiId).trim().toLowerCase() === "0790176a0253328.bqr@kotak" ? await loadQr() : null;
  const logo = await readFile(path.join(process.cwd(), "public/assets/quotation-logo.png"));
  const number = quotationNumber(q.invoiceDetails);
  const company = settings?.companyName || "MF Global Services";
  const ink = "#202B38", muted = "#526373", red = "#A72C37", line = "#D4DCE2";
  const doc = new PDFDocument({ size: "A4", margins: { top: 38, left: MARGIN, right: MARGIN, bottom: 54 },
    info: { Title: `Quotation ${number}`, Author: company } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const W = doc.page.width - 2 * MARGIN;
  const right = MARGIN + W;
  const bottom = doc.page.height - 54;
  const font = (size: number, bold = false, color = ink) =>
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
  const rule = (y: number) => doc.moveTo(MARGIN, y).lineTo(right, y).lineWidth(0.6).strokeColor(line).stroke();
  const ensure = (height: number) => { if (doc.y + height > bottom) doc.addPage(); };
  let page = 0;
  function stationery() {
    page++;
    doc.rect(0, 0, doc.page.width, 4).fill(red);
    const y = doc.page.height - 37;
    doc.page.margins.bottom = 0;
    rule(y);
    font(8, false, muted).text(`Quotation  /  ${number}`, MARGIN, y + 10, { width: W - 64, lineBreak: false });
    doc.text(`Page ${page}`, right - 60, y + 10, { width: 60, align: "right", lineBreak: false });
    doc.page.margins.bottom = 54;
    doc.x = MARGIN;
    doc.y = 38;
  }
  stationery();
  doc.on("pageAdded", stationery);

  doc.image(logo, MARGIN, 32, { fit: [46, 46] });
  font(16, true).text(company, MARGIN + 56, 38, { width: W - 210 });
  font(8, false, muted);
  if (settings?.address) doc.text(settings.address, { width: W - 210 });
  const ids = [settings?.gst && `GSTIN  ${settings.gst}`, settings?.pan && `PAN  ${settings.pan}`].filter(Boolean);
  if (ids.length) doc.text(ids.join("    "), { width: W - 210 });
  const brandEnd = Math.max(80, doc.y);
  font(23, true).text("Quotation", right - 150, 35, { width: 150, align: "right" });
  font(10, true, red).text(number, right - 150, doc.y + 3, { width: 150, align: "right" });
  doc.y = Math.max(brandEnd, doc.y) + 12;
  rule(doc.y);
  const info = [["Issued", fmtDate(q.invoiceDetails.date || q.createdAt)], ["Valid until", fmtDate(q.invoiceDetails.validityDate)],
    ["PO number", str(q.invoiceDetails.poNo)], ["Place of supply", str(q.invoiceDetails.placeOfSupply)]].filter(([, v]) => v);
  const metaY = doc.y + 12;
  let metaEnd = metaY;
  info.forEach(([label, value], index) => {
    const width = W / info.length;
    const x = MARGIN + index * width;
    font(8, true, muted).text(label!.toUpperCase(), x, metaY, { width: width - 10 });
    font(10).text(value!, x, doc.y + 3, { width: width - 10 });
    metaEnd = Math.max(metaEnd, doc.y);
  });
  doc.y = metaEnd + 16;
  const party = q.party;
  const ship = (party.selectedShippingAddress ?? {}) as Record<string, unknown>;
  const billing = [party.company, party.name !== party.company && party.name, party.billToAddress, party.state,
    party.phone && `Phone  ${party.phone}`, party.pan && `PAN  ${party.pan}`].filter(Boolean).join("\n");
  const shipping = [ship.name, ship.address || party.billToAddress, ship.state || party.state].filter(Boolean).join("\n");
  const parties = [["BILL TO", billing], ["SHIP TO", shipping || "Same as billing address"]] as const;
  const half = W / 2 - 8;
  const partyY = doc.y;
  const boxH = Math.max(...parties.map(([, v]) => font(9).heightOfString(v, { width: half - 22 }))) + 40;
  if (boxH < bottom - partyY - 36) {
    parties.forEach(([label, value], i) => {
      const x = MARGIN + i * (half + 16);
      doc.rect(x, partyY, half, boxH).fill("#F2F5F7");
      font(8, true, muted).text(label, x + 11, partyY + 10);
      font(9).text(value, x + 11, partyY + 25, { width: half - 22 });
    });
    doc.y = partyY + boxH + 18;
  } else {
    for (const [label, value] of parties) {
      ensure(34);
      font(9, true, muted).text(label, MARGIN, doc.y);
      font(9).text(value, MARGIN, doc.y + 4, { width: W });
      doc.y += 12;
    }
  }

  const cols = [W - 310, 32, 65, 76, 60, 77];
  const headings = ["Item / description", "Qty", "Rate", "Taxable", "GST", "Total (INR)"];
  function tableHeader() {
    const y = doc.y;
    doc.rect(MARGIN, y, W, 23).fill(ink);
    let x = MARGIN;
    cols.forEach((w, i) => {
      font(8, true, "#FFFFFF").text(headings[i]!, x + 5, y + 7, { width: w - 10, align: i ? "right" : "left" });
      x += w;
    });
    doc.y = y + 23;
  }
  ensure(55);
  tableHeader();
  q.items.forEach((item, index) => {
    const li = calculateLineItem(item);
    const image = images[index];
    const imageWidth = image ? 32 : 0;
    const detail = [item.hsn && `HSN ${item.hsn}`, li.discountPct && `Discount ${li.discountPct}%`].filter(Boolean).join("   /   ");
    const nameWidth = cols[0]! - imageWidth - 10;
    const name = `${index + 1}.  ${item.name.replace(/\s+/g, " ")}`;
    const nameH = font(9, true).heightOfString(name, { width: nameWidth });
    const detailH = detail ? font(8).heightOfString(detail, { width: nameWidth }) + 3 : 0;
    const values = [String(li.qty), li.price.toFixed(2), li.taxableValue.toFixed(2), `${li.taxAmount.toFixed(2)}\n${li.taxRate}%`, li.total.toFixed(2)];
    const rowH = Math.max(20, image ? 28 : 0, nameH + detailH,
      ...values.map((v, i) => font(8, i === 4).heightOfString(v, { width: cols[i + 1]! - 10 }))) + 12;
    if (doc.y + rowH > bottom) { doc.addPage(); tableHeader(); }
    const y = doc.y;
    if (image) { try { doc.image(image, MARGIN + 4, y + 5, { fit: [26, 26] }); } catch { /* Damaged optional photo. */ } }
    const nameX = MARGIN + imageWidth + 5;
    font(9, true).text(name, nameX, y + 6, { width: nameWidth });
    if (detail) font(8, false, muted).text(detail, nameX, doc.y + 3, { width: nameWidth });
    let x = MARGIN + cols[0]!;
    values.forEach((value, i) => {
      const width = cols[i + 1]!;
      font(8, i === 4).text(value, x + 5, y + 6, { width: width - 10, align: "right" });
      x += width;
    });
    doc.y = y + rowH;
    if (item.description && item.description !== item.name) {
      font(8.5, false, muted).text(item.description, MARGIN + 6, doc.y, { width: W - 12 });
      doc.y += 6;
    }
    rule(doc.y);
  });

  const t = q.totals;
  const totals = [["Taxable subtotal", money(t.subtotal)], ["GST", money(t.totalTax)]];
  if (t.totalDiscount) totals.push(["Quotation discount", `-${money(t.totalDiscount)}`]);
  if (t.additionalCharges) totals.push(["Additional charges", money(t.additionalCharges)]);
  if (t.roundOff) totals.push(["Round off", money(t.roundOff)]);
  totals.push(["Grand total", money(t.grandTotal)]);
  if (t.amountReceived) totals.push(["Amount received", money(t.amountReceived)], ["Balance", money(t.balanceAmount)]);
  const bank = q.bankDetails;
  const bankLines = [["Account holder", bank.accountHolder], ["Bank", bank.bankName], ["Account number", bank.accountNumber],
    ["IFSC", bank.ifscCode], ["UPI", bank.upiId]].filter(([,v]) => v).map(([k,v]) => `${k}  ${v}`);
  const bankText = bankLines.join("\n");
  const bankWidth = W - 245;
  const bankH = bankText ? 17 + font(9).heightOfString(bankText, { width: bankWidth, lineGap: 2 }) + (qr ? 68 : 0) : 0;
  ensure(22 + Math.max(bankH, totals.length * 18 + 9));
  const start = doc.y + 14;
  let totalsY = start;
  for (const [label, value] of totals) {
    const highlight = label === "Grand total";
    const height = highlight ? 27 : 18;
    if (highlight) doc.rect(right - 225, totalsY, 225, height).fill(ink);
    font(highlight ? 11 : 9, highlight, highlight ? "#FFFFFF" : ink);
    doc.text(label!, right - 218, totalsY + (highlight ? 7 : 3), { width: 98 });
    doc.text(value!, right - 125, totalsY + (highlight ? 7 : 3), { width: 118, align: "right" });
    totalsY += height;
  }
  let bankEnd = start;
  if (bankText) {
    font(8, true, muted).text("PAYMENT DETAILS", MARGIN, start);
    font(9).text(bankText, MARGIN, doc.y + 6, { width: bankWidth, lineGap: 2 });
    bankEnd = doc.y;
    if (qr) { doc.image(qr, MARGIN, bankEnd + 5, { fit: [62, 62] }); bankEnd += 67; }
  }
  doc.y = Math.max(bankEnd, totalsY) + 12;
  for (const [title, content] of [["Terms & conditions", q.terms], ["Notes", q.notes]]) {
    if (!content?.trim()) continue;
    ensure(37);
    font(10, true).text(title!, MARGIN, doc.y);
    font(9, false, muted).text(content.trim(), MARGIN, doc.y + 4, { width: W, lineGap: 1 });
    doc.y += 10;
  }
  ensure(54);
  font(9, true).text(`For ${company}`, MARGIN, doc.y + 2, { width: W, align: "right" });
  const signY = doc.y + 21;
  doc.moveTo(right - 132, signY).lineTo(right, signY).strokeColor(line).stroke();
  font(8, false, muted).text("Authorized signature", right - 132, signY + 4, { width: 132, align: "right" });
  doc.end();
  return done;
}

/** Authorise (owner or admin) then render. Returns the file name + bytes. */
export async function quotationPdf(actor: Actor, id: string) {
  const q = await getQuotation(actor, id);
  if (!isAdmin(actor) && q.userId !== actor.id) throw forbidden("Access denied");
  const body = await renderQuotationPdf(q);
  const safe = quotationNumber(q.invoiceDetails).replace(/[^A-Za-z0-9._-]+/g, "_") || "quotation";
  return { name: `Quotation_${safe}.pdf`, body };
}
