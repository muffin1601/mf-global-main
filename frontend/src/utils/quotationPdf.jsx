import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Custom Helper Functions ---

/**
 * Formats a raw date string (YYYY-MM-DDTHH:MM:SS.000Z) to DD-MM-YYYY.
 */
const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString.split('T')[0]);
        // Use 'en-GB' for DD/MM/YYYY format, then replace slashes with hyphens
        return date.toLocaleDateString('en-GB').replace(/\//g, '-');
    } catch (e) {
        return dateString;
    }
};

/**
 * Formats a number to currency string (e.g., 12,345.67).
 */
const formatCurrency = (number) => {
    const num = typeof number === 'number' ? number : parseFloat(number) || 0;
    
    return num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

// --- Main PDF Generation Function (Revised for Aesthetic Match) ---

export const generateQuotationPDF = (quotation, logoDataUrl, qrCodeDataUrl) => {
    const {
        party = {},
        items = [],
        invoiceDetails = {},
        terms = [],
        bankDetails = {},
        summary = {},
    } = quotation || {};

    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    let y = 40;
    const bodyTextColor = [50, 50, 50];

    doc.setTextColor(...bodyTextColor);
    doc.setFont("helvetica", "normal");

    // --- 1. Header: Company Info & Quotation Title (Tighter Alignment) ---

    // Company Name (Left Side)
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("MF GLOBAL SERVICES", margin, y + 15);
    y += 25;

    // Company Contact and Registration Details
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const companyDetails = [
        // `GSTIN: ${invoiceDetails.gstin || "07ABJFM2334H1ZC"} | PAN: ${invoiceDetails.pan || "ABJFM2334H"} | UDYAM: ${invoiceDetails.udyam || "DL-08-0024532"}`,
        `📞 ${invoiceDetails.phone || "1147563596"} | ✉ ${invoiceDetails.email || "mfglobalservices18@gmail.com"} | 🌐 ${invoiceDetails.website || "www.mfglobalservices.com"}`,
        `Corporate Office: ${invoiceDetails.officeAddress || "F-901, Okhla Industrial Area Phase 1, New Delhi, 110025"}`,
    ];

    let detailY = y;
    companyDetails.forEach(line => {
        doc.text(line, margin, detailY);
        detailY += 9; // Tighter vertical spacing for details
    });
    
    // Logo (Right Side - if used)
    const logoWidth = 80;
    const logoHeight = 50;
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", pageWidth - margin - logoWidth, 40, logoWidth, logoHeight);
    }
    
    y = detailY + 15;

    // --- 2. Quotation Info Table (Standard Grid/Box Look) ---
    const quotationData = [
        ['Quotation No.', 'Quotation Date', 'Payment Due'],
        [`${invoiceDetails.prefix || ""}${invoiceDetails.number || ""}`, formatDate(invoiceDetails.date), formatDate(invoiceDetails.validityDate)],
    ];
    
    autoTable(doc, {
        startY: y,
        head: [quotationData[0]],
        body: [quotationData[1]],
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 3, textColor: bodyTextColor },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
        bodyStyles: { halign: "center" },
        columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 150 }, 2: { cellWidth: 150 } },
        margin: { left: pageWidth - margin - 450 }, // Position on the right
        tableLineColor: 180,
        tableLineWidth: 0.5,
    });

    y = doc.lastAutoTable.finalY + 10;

    // --- 3. Bill To / Ship To (CRITICAL FIXES for Address Visibility) ---
    
    // Convert address lines array back to a single string for better autoTable wrapping
    const formatAddressLines = (lines) => {
        if (!Array.isArray(lines)) return '—';
        return lines.join('\n');
    };

    const billToLines = [
        `**${party.company || party.name || "—"}**`,
        formatAddressLines(party.billToAddress),
        `Place of Supply: ${invoiceDetails.placeOfSupply || "—"}`
    ].join('\n');

    const shipToLines = [
        `**${party.company || party.name || "—"}**`,
        formatAddressLines(party.selectedShippingAddress?.lines || []),
    ].join('\n');

    autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["BILL TO", "SHIP TO"]],
        body: [[billToLines, shipToLines]],
        styles: { 
            fontSize: 10, 
            textColor: bodyTextColor, 
            cellW: 'wrap', 
            lineWidth: 0.5,
            cellPadding: 8, // Tighter padding to match the image
        },
        headStyles: { 
            fillColor: [230, 230, 230], 
            textColor: [0, 0, 0], 
            fontStyle: "bold", 
            halign: "center" 
        },
        columnStyles: { 0: { cellWidth: (pageWidth - 2 * margin) / 2 }, 1: { cellWidth: (pageWidth - 2 * margin) / 2 } },
        bodyStyles: { 
            valign: "top", 
            minCellHeight: 45, // Set minimum height, but allow wrapping to ensure all address lines show
            // The key is that `party.billToAddress` and `party.selectedShippingAddress.lines` must be correct arrays/strings.
        },
        useHtml: true
    });

    y = doc.lastAutoTable.finalY; // Keep items table immediately below Bill To/Ship To

    // --- 4. Items Table (Final Adjustment) ---
    
    let calculatedSubtotal = 0;
    let calculatedTax = 0;

    const itemData = items.map((item, idx) => {
        const price = item.price ?? 0;
        const qty = item.qty ?? 0;
        const taxRate = (item.tax ?? 0) / 100;
        
        const taxableAmount = qty * price;
        const taxAmount = taxableAmount * taxRate;
        const total = taxableAmount + taxAmount;

        calculatedSubtotal += taxableAmount;
        calculatedTax += taxAmount;
        
        // Ensure item details are included in the cell content
        const itemDescription = item.name + (item.details?.length ? `\n${item.details.join("\n")}` : "");

        return [
            idx + 1,
            itemDescription,
            qty.toFixed(0),
            formatCurrency(price),
            formatCurrency(taxableAmount),
            formatCurrency(total)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [["No", "Item Description", "Qty", "Rate (₹)", "Taxable Amt (₹)", "Total (₹)"]],
        body: itemData,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5, textColor: bodyTextColor },
        headStyles: { 
            fillColor: [31, 73, 125], 
            textColor: 255, 
            fontStyle: "bold",
            lineWidth: 0.5 
        },
        columnStyles: {
            0: { halign: "center", cellWidth: 30 },
            1: { cellWidth: 200 }, 
            2: { halign: "center", cellWidth: 50 },
            3: { halign: "right", cellWidth: 70 },
            4: { halign: "right", cellWidth: 85 },
            5: { halign: "right", cellWidth: 85, fontStyle: "bold" }
        },
        bodyStyles: { valign: "top" }
    });

    y = doc.lastAutoTable.finalY; // Start new section right after item table

    // --- 5. Summary, Terms & Bank Details (Side-by-Side Arrangement) ---
    
    // Set a baseline for the total summary box on the right
    const summaryXStart = pageWidth - margin - 200; // Start of the summary box
    const summaryValueX = pageWidth - margin;     // Right edge of the page

    // --- Right Side: Totals Summary ---
    
    const finalSubtotal = summary.subtotal ?? calculatedSubtotal;
    const finalTax = summary.tax ?? calculatedTax;
    const finalTotal = summary.total ?? (finalSubtotal + finalTax);

    let summaryY = y + 10;
    
    // Subtotal
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Taxable Subtotal:`, summaryXStart, summaryY);
    doc.text(`₹${formatCurrency(finalSubtotal)}`, summaryValueX, summaryY, { align: "right" });
    summaryY += 12;

    // Tax
    doc.text(`IGST @18%:`, summaryXStart, summaryY);
    doc.text(`₹${formatCurrency(finalTax)}`, summaryValueX, summaryY, { align: "right" });
    summaryY += 15;

    // Total Amount (in bold box - matching the image style)
    doc.setFillColor(230, 230, 230);
    doc.rect(summaryXStart - 5, summaryY - 3, 205, 15, "F"); // Background box for total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL AMOUNT (₹):`, summaryXStart, summaryY);
    doc.text(`₹${formatCurrency(finalTotal)}`, summaryValueX, summaryY, { align: "right" });
    summaryY += 25;


    // --- Left Side: Terms, Bank, and QR Code ---
    
    let termsY = y + 10; // Start terms at the same Y as subtotal
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions:", margin, termsY);
    termsY += 12;
    doc.setFont("helvetica", "normal");
    
    const termsArray = Array.isArray(terms) ? terms : [terms].filter(Boolean);
    termsArray.forEach(line => {
        doc.setFontSize(8); 
        const lines = doc.splitTextToSize(line, (pageWidth / 2) - margin - 20); 
        doc.text(lines, margin, termsY);
        termsY += (lines.length * 9); 
    });
    
    // Total Amount in Words (Below Terms)
    termsY += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount (in words):`, margin, termsY);
    doc.setFont("helvetica", "normal");
    doc.text(summary.amountInWords || "—", margin, termsY + 12);
    termsY += 30; // Terms Y is now below amount in words

    // --- Bank Details (Tightly placed) ---
    const bankY = termsY; 
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Bank Details:", margin, bankY);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Bank: ${bankDetails.bankName || "—"}`, margin, bankY + 15);
    doc.text(`A/C No: ${bankDetails.accountNumber || "—"}`, margin, bankY + 30);
    doc.text(`IFSC: ${bankDetails.ifscCode || "—"}`, margin, bankY + 45);
    doc.text(`UPI: ${bankDetails.upiId || "—"}`, margin + 150, bankY + 30); // UPI next to A/C No.

    // --- Signature (Bottom Right) ---
    let signatureY = Math.max(summaryY + 10, bankY + 60); // Place signature below totals or bank details, whichever is lower

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`For ${invoiceDetails.companyName || "MF GLOBAL SERVICES"}`, summaryValueX, signatureY, { align: "right" });
    
    // Signature Line
    doc.line(summaryValueX - 150, signatureY + 40, summaryValueX, signatureY + 40); 
    doc.setFontSize(9);
    doc.text("Authorized Signature", summaryValueX, signatureY + 50, { align: "right" });

    // --- QR Code (Bottom Left) ---
    if (qrCodeDataUrl) {
        // Place QR code below the bank details
        doc.addImage(qrCodeDataUrl, "PNG", margin, bankY + 60, 50, 50);
    }

    // --- Save PDF ---
    doc.save(`Quotation_${invoiceDetails.prefix || ""}${invoiceDetails.number || ""}.pdf`);
};