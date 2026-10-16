import html2pdf from "html2pdf.js";
import "./quotation.css";
import logoDataUrl from "/assets/crm/logo.webp";
import qrCodeDataUrl from "/QR.png";
import { toProductImageDataUrl } from "./productImage";

export const generateQuotationPDF = async (quotation) => {
  if (!quotation) return;

  let {
    party = {},
    items = [],
    invoiceDetails = {},
    terms = [],
    bankDetails = {},
    summary = {},
    totals = {},
  } = quotation;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  if (typeof terms === "string") {
    terms = terms.split("\n").map(t => t.trim()).filter(Boolean);
  }

  if (!Array.isArray(items)) items = [];

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  let subtotal = 0, totalGst = 0, grandTotal = 0;

  const processedItems = items.map((it) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const gstPercent = Number(it.tax || 0);

    const discountPercent = Math.min(100, Math.max(0, Number(it.discount || 0)));
    const taxable = qty * price * (1 - discountPercent / 100);
    const gstAmount = taxable * gstPercent / 100;
    const lineTotal = taxable + gstAmount;

    subtotal += taxable;
    totalGst += gstAmount;
    grandTotal += lineTotal;

    return { ...it, qty, price, discountPercent, gstPercent, taxable, gstAmount, lineTotal };
  });

  // Inline the product images as data URIs before rendering. html2canvas skips
  // cross-origin images it cannot read, and a missing/broken one resolves to
  // the placeholder — so the PDF never fails because of an image.
  const imageDataUrls = await Promise.all(
    processedItems.map((it) => toProductImageDataUrl(it.image))
  );

  subtotal = +subtotal.toFixed(2);
  totalGst = +totalGst.toFixed(2);
  grandTotal = +grandTotal.toFixed(2);

  const displaySubtotal = Number.isFinite(Number(totals.subtotal)) ? Number(totals.subtotal) : subtotal;
  const displayTax = Number.isFinite(Number(totals.totalTax)) ? Number(totals.totalTax) : totalGst;
  const displayDiscount = Number(totals.totalDiscount || 0);
  const displayCharges = Number(totals.additionalCharges ?? summary.additionalCharges ?? 0);
  const displayRoundOff = Number(totals.roundOff || 0);
  const displayGrandTotal = Number.isFinite(Number(totals.grandTotal)) ? Number(totals.grandTotal) : grandTotal;


  const wrapper = document.createElement("div");
  wrapper.className = "mfq-pdf-wrapper-safe";

  wrapper.innerHTML = `
    <div class="mfq-pdf">
      <div class="mfq-container">

        <header class="mfq-header">
          <div class="mfq-header-left">
            <h1 class="mfq-company-name">MF GLOBAL SERVICES</h1>
            <p class="mfq-contact-line">
              📞 ${invoiceDetails.phone || "1147563596"} &nbsp;|&nbsp;
              ✉ ${invoiceDetails.email || "mfglobalservices18@gmail.com"} &nbsp;|&nbsp;
              🌐 ${invoiceDetails.website || "www.mfglobalservices.com"}
            </p>
            <p class="mfq-company-address">
              ${invoiceDetails.officeAddress ||
                "F-901, Okhla Industrial Area Phase 1, New Delhi, 110025"}
            </p>
          </div>

          <div class="mfq-header-right">
              <div class="mfq-logo-bg"></div>
              <img src="${logoDataUrl}"
                class="mfq-company-logo"
                crossorigin="anonymous"
                style="width:120px;height:auto;">
          </div>
        </header>

        <section class="mfq-info-section">
          <table class="mfq-info-table">
            <thead>
              <tr><th>Quotation No.</th><th>Date</th><th>Valid Till</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(invoiceDetails.prefix)}${escapeHtml(invoiceDetails.number)}</td>
                <td>${formatDate(invoiceDetails.date)}</td>
                <td>${formatDate(invoiceDetails.validityDate)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="mfq-party-section">
          <div class="mfq-party-card">
            <h3>BILL TO</h3>
            <strong>${escapeHtml(party.company || party.name)}</strong>
            <p>${escapeHtml(party.billToAddress)}</p>
          </div>

          <div class="mfq-party-card">
            <h3>SHIP TO</h3>
            <p>${escapeHtml(party.selectedShippingAddress?.address || party.billToAddress)}</p>
          </div>
        </section>

        <section class="mfq-items-section">
          <table class="mfq-items-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Image</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Taxable</th>
                <th>GST%</th>
                <th>GST Amt</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${processedItems
                .map(
                  (it, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="mfq-item-image-cell">
                    <img class="mfq-item-image" src="${imageDataUrls[i]}" alt="">
                  </td>
                  <td>${escapeHtml(it.name)}</td>
                  <td style="text-align:right">${it.qty}</td>
                  <td style="text-align:right">${it.price.toFixed(2)}</td>
                  <td style="text-align:right">${it.taxable.toFixed(2)}</td>
                  <td style="text-align:right">${it.gstPercent}%</td>
                  <td style="text-align:right">${it.gstAmount.toFixed(2)}</td>
                  <td style="text-align:right">${it.lineTotal.toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </section>

        <section class="mfq-summary-section">
          <div class="mfq-summary-left">
            <h4>Terms & Conditions</h4>
            <ul>
              ${terms.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
            </ul>
          </div>

          <div class="mfq-summary-right">
            <table>
              <tr><td>Subtotal</td><td style="text-align:right">&#8377;${displaySubtotal.toFixed(2)}</td></tr>
              <tr><td>Tax / GST</td><td style="text-align:right">&#8377;${displayTax.toFixed(2)}</td></tr>
              ${displayDiscount ? `<tr><td>Discount</td><td style="text-align:right">-&#8377;${displayDiscount.toFixed(2)}</td></tr>` : ""}
              ${displayCharges ? `<tr><td>Additional Charges</td><td style="text-align:right">&#8377;${displayCharges.toFixed(2)}</td></tr>` : ""}
              ${displayRoundOff ? `<tr><td>Round Off</td><td style="text-align:right">&#8377;${displayRoundOff.toFixed(2)}</td></tr>` : ""}
              <tr class="total-row">
                <td><b>Grand Total</b></td>
                <td style="text-align:right"><b>&#8377;${displayGrandTotal.toFixed(2)}</b></td>
              </tr>
            </table>
          </div>
        </section>

        <footer class="mfq-footer">
  <div class="mfq-bank-block">
    <h4>Bank Details</h4>
    <p><b>Bank:</b> ${escapeHtml(bankDetails.bankName)}</p>
    <p><b>A/C:</b> ${escapeHtml(bankDetails.accountNumber)}</p>
    <p><b>IFSC:</b> ${escapeHtml(bankDetails.ifscCode)}</p>

    <!-- QR Code -->
    <div class="mfq-qr-section">
      <p class="mfq-qr-title">Payment QR Code</p>
      <img
        src="${qrCodeDataUrl}"
        class="mfq-qr-image"
        crossorigin="anonymous"
        alt="UPI Payment QR"
      />
      <p class="mfq-qr-upi">
        UPI ID: ${escapeHtml(bankDetails.upiId || "8750708222-1@okbizaxis")}
      </p>
    </div>
  </div>

  <div>
    <p>For MF GLOBAL SERVICES</p>
    <div class="mfq-sign-line"></div>
    <p>Authorized Signature</p>
  </div>
</footer>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  /* -----------------------------------------------
     FIX 2: Ensure images have real dimensions
     ----------------------------------------------- */
  const imgs = wrapper.querySelectorAll("img");
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((res) => {
          if (img.complete && img.naturalWidth > 0) res();
          img.onload = img.onerror = res;
        })
    )
  );

  /* -----------------------------------------------
     FIX 3: Safe html2canvas settings
     ----------------------------------------------- */
  try {
    await html2pdf()
      .set({
        margin: [10, 10],
        filename: `Quotation_${invoiceDetails.prefix}${invoiceDetails.number}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          imageTimeout: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(wrapper.querySelector(".mfq-pdf"))
      .save();
  } catch (e) {
    console.error("PDF failed: ", e);
  }

  wrapper.remove();
};

export default generateQuotationPDF;
