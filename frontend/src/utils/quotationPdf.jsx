import html2pdf from "html2pdf.js";
import "./quotation-pdf.css";
import logoDataUrl from "/assets/crm/logo.webp";

export const generateQuotationPDF = async (quotation) => {
  if (!quotation) return;

  let {
    party = {},
    items = [],
    invoiceDetails = {},
    terms = [],
    bankDetails = {},
    summary = {},
  } = quotation;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (typeof terms === "string") {
    terms = terms.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
  }
  if (!Array.isArray(terms)) terms = [];
  if (!Array.isArray(items)) items = [];

  const container = document.createElement("div");
  container.id = "pdf-preview-container";
  container.style.cssText = `
    position: relative;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    color: #000;
    font-family: 'Outfit', sans-serif;
    overflow: visible;
    padding: 25px;
  `;

  container.innerHTML = `
    <div class="mfq-container">
      <header class="mfq-header">
        <div class="mfq-header-left">
          <h1 class="mfq-company-name">MF GLOBAL SERVICES</h1>
          <p class="mfq-contact-line">
            📞 ${invoiceDetails?.phone || "1147563596"} &nbsp;|&nbsp;
            ✉ ${invoiceDetails?.email || "mfglobalservices18@gmail.com"} &nbsp;|&nbsp;
            🌐 ${invoiceDetails?.website || "www.mfglobalservices.com"}
          </p>
          <p class="mfq-company-address">
            ${invoiceDetails?.officeAddress ||
              "F-901, Okhla Industrial Area Phase 1, New Delhi, 110025"}
          </p>
        </div>
        <div class="mfq-header-right">
          ${logoDataUrl ? `<img src="${logoDataUrl}" class="mfq-company-logo" />` : ""}
        </div>
      </header>

      <section class="mfq-info-section">
        <table class="mfq-info-table" cellspacing="0" cellpadding="6">
          <thead style="background:#e11d48; color:#fff;">
            <tr><th>Quotation No.</th><th>Date</th><th>Valid Till</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoiceDetails?.prefix || ""}${invoiceDetails?.number || ""}</td>
              <td>${formatDate(invoiceDetails?.date)}</td>
              <td>${formatDate(invoiceDetails?.validityDate)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="mfq-party-section">
        <div class="mfq-party-card">
          <h3>BILL TO</h3>
          <p><strong>${party?.company || party?.name || ""}</strong></p>
          <p>${
            Array.isArray(party?.billToAddress)
              ? party.billToAddress.join(", ")
              : party?.billToAddress || ""
          }</p>
        </div>

        <div class="mfq-party-card">
          <h3>SHIP TO</h3>
          <p>${
            party?.selectedShippingAddress?.lines?.length
              ? (
                  Array.isArray(party.selectedShippingAddress.lines)
                    ? party.selectedShippingAddress.lines.join(", ")
                    : party.selectedShippingAddress.lines
                )
              : (
                  Array.isArray(party?.billToAddress)
                    ? party.billToAddress.join(", ")
                    : party?.billToAddress || "Same as Bill To"
                )
          }</p>
        </div>
      </section>

      <section class="mfq-items-section">
        <table class="mfq-items-table" cellspacing="0" cellpadding="6">
          <thead>
            <tr style="background:#f8f8f8; border-bottom:2px solid #e11d48;">
              <th>No</th>
              <th>Item Description</th>
              <th>Qty</th>
              <th>Rate (₹)</th>
              <th>Taxable Amt (₹)</th>
              <th>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length
                ? items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.name || ""}</td>
                      <td>${item.qty || 0}</td>
                      <td>${item.price || 0}</td>
                      <td>${((item.qty || 0) * (item.price || 0)).toFixed(2)}</td>
                      <td>${((item.qty || 0) * (item.price || 0) * 1.18).toFixed(2)}</td>
                    </tr>
                  `).join("")
                : `<tr><td colspan="6" style="text-align:center;">No items found</td></tr>`
            }
          </tbody>
        </table>
      </section>

      <section class="mfq-summary-section">
        <div class="mfq-summary-left">
          <h4>Terms & Conditions</h4>
          <ul>
            ${
              terms.length
                ? terms.map(t => `<li>${t}</li>`).join("")
                : `<li>No terms specified</li>`
            }
          </ul>
        </div>
        <div class="mfq-summary-right">
          <table>
            <tr><td>Subtotal:</td><td>₹${summary?.subtotal || 0}</td></tr>
            <tr><td>Tax:</td><td>₹${summary?.tax || 0}</td></tr>
            <tr><td><b>Total:</b></td><td><b>₹${summary?.total || 0}</b></td></tr>
          </table>
        </div>
      </section>

      <footer class="mfq-footer">
        <div>
          <h4>Bank Details</h4>
          <p><b>Bank:</b> ${bankDetails?.bankName || ""}</p>
          <p><b>A/C No:</b> ${bankDetails?.accountNumber || ""}</p>
          <p><b>IFSC:</b> ${bankDetails?.ifscCode || ""}</p>
        </div>
        <div>
          <p>For ${invoiceDetails?.companyName || "MF GLOBAL SERVICES"}</p>
          <div class="mfq-sign-line"></div>
          <p>Authorized Signature</p>
        </div>
      </footer>
    </div>
  `;

  document.body.appendChild(container);

  const imgs = container.querySelectorAll("img");
  await Promise.all([...imgs].map(
    img => new Promise(res => {
      if (img.complete) res();
      else img.onload = img.onerror = res;
    })
  ));

  await new Promise(res => setTimeout(res, 700));

  const options = {
    margin: [10, 10],
    filename: `Quotation_${invoiceDetails?.prefix || ""}${invoiceDetails?.number || ""}.pdf`,
    image: { type: "jpeg", quality: 1 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#fff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  try {
    await html2pdf().set(options).from(container).save();
  } catch (err) {
    console.error("PDF generation failed:", err);
  } finally {
    container.remove();
  }
};
