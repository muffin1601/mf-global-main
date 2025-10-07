import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Placeholders for customization ---
const COMPANY_LOGO_BASE64 = 'data:image/webp;base64,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'; 
const PAYMENT_QR_BASE64 = 'data:image/webp;base64,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';   
const PRIMARY_COLOR = [26, 35, 126]; // Dark Blue/Purple
const SECONDARY_COLOR = [245, 245, 245]; // Light Gray

const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

const numberToWords = (num) => {
    return `${num.toLocaleString('en-IN')} Rupees Only`;
};

export const generateQuotationPDF = (quotationList, grandTotal, customerName, customerAddress, notes) => {
    const doc = new jsPDF();
    const marginX = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 14;

    // --- HEADER SECTION ---
    const logoSize = 28;
    doc.addImage(COMPANY_LOGO_BASE64, 'PNG', marginX, currentY, logoSize, logoSize);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("QUOTATION", pageWidth / 2, currentY + 12, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Company Info (Right)
    const rightX = pageWidth - marginX;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("MF GLOBAL SERVICES", rightX, currentY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text("F-90/1, Okhla Industrial Area Phase 1, Delhi, 110025", rightX, currentY + 4, { align: 'right' });
    doc.text("mfglobalservices18@gmail.com | GSTIN: 07ABJFM2334H1ZC", rightX, currentY + 8, { align: 'right' });
    doc.text("UDYAM NO: DL-08-0024532", rightX, currentY + 12, { align: 'right' });

    currentY += 35;

    // --- QUOTATION INFO BOX ---
    const quotationNo = `QUO-${Date.now().toString().slice(-6)}`;
    const quotationDate = new Date().toLocaleDateString('en-IN');
    const expiryDate = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-IN');

    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(pageWidth - 85, currentY, 71, 15, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text("Quotation No.", pageWidth - 83, currentY + 3);
    doc.text(quotationNo, pageWidth - 16, currentY + 3, { align: 'right' });
    doc.text("Quotation Date", pageWidth - 83, currentY + 8);
    doc.text(quotationDate, pageWidth - 16, currentY + 8, { align: 'right' });
    doc.text("Expiry Date", pageWidth - 83, currentY + 13);
    doc.text(expiryDate, pageWidth - 16, currentY + 13, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    currentY += 20;

    // --- BILL TO / SHIP TO ---
    autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        tableWidth: pageWidth - 2*marginX,
        body: [
            [
                { content: `Bill To:\n${customerName}\n${customerAddress}\nPlace of Supply: UP`, styles: { fontStyle: 'bold', cellPadding: 3, fontSize: 9 } },
                { content: `Ship To:\n${customerName}\n${customerAddress}\nPlace of Supply: UP`, styles: { fontStyle: 'bold', cellPadding: 3, fontSize: 9 } }
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: SECONDARY_COLOR, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { minCellHeight: 30, valign: 'top' }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // --- ITEMS TABLE ---
    const tableColumns = ["No", "Item Description", "Qty", "Rate", "Tax", "Total"];
    const tableRows = quotationList.map((item, i) => [
        i+1,
        item.p_name || "",
        item.quantity || "",
        formatCurrency(item.p_price?.single_price || 0),
        item.tax || "0%",
        formatCurrency(item.p_price?.single_price * item.quantity || 0)
    ]);

    autoTable(doc, {
        startY: currentY,
        head: [tableColumns],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        margin: { left: marginX, right: marginX },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 80 },
            2: { cellWidth: 15 },
            3: { cellWidth: 25 },
            4: { cellWidth: 15 },
            5: { cellWidth: 25 }
        }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // --- TOTAL & AMOUNT IN WORDS ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Grand Total: " + formatCurrency(grandTotal), pageWidth - marginX, currentY, { align: 'right' });
    currentY += 6;
    doc.setFont('helvetica', 'italic');
    doc.text("Amount in Words: " + numberToWords(grandTotal), marginX, currentY);

    currentY += 12;

    // --- NOTES ---
    if(notes){
        doc.setFont('helvetica', 'bold');
        doc.text("Notes:", marginX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(notes, marginX, currentY + 4, { maxWidth: pageWidth - 2*marginX });
        currentY += 15;
    }

    // --- FOOTER (QR, Contact) ---
    const qrSize = 30;
    doc.addImage(PAYMENT_QR_BASE64, 'PNG', marginX, doc.internal.pageSize.getHeight() - qrSize - 20, qrSize, qrSize);
    doc.setFontSize(8);
    doc.text("Scan QR for Payment", marginX + qrSize + 2, doc.internal.pageSize.getHeight() - qrSize/2 - 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("MF GLOBAL SERVICES", pageWidth - marginX, doc.internal.pageSize.getHeight() - 20, { align: 'right' });

    // --- DOWNLOAD PDF ---
    doc.save(`Quotation_${quotationNo}.pdf`);
};
