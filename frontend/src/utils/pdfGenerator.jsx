import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const getBase64FromPublic = async (imagePath) => {
  const response = await fetch(imagePath);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

export const generateQuotationPDF = async (quotationData) => {
  const {
    quotationNumber,
    quotationDate,
    customerName,
    customerAddress,
    deliveryTime = "Within 7 business days",
    paymentTerms = "Advance 50%, Balance on Delivery",
    validityPeriod = "Valid for 30 days",
    notes,
    products,
    grandTotal,
  } = quotationData;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const brandColor = [30, 58, 138];
  const accentColor = [245, 245, 245];

  const companyLogoBase64 = await getBase64FromPublic("/assets/crm/logo.webp");
  const paymentQrBase64 = await getBase64FromPublic("/assets/crm/logo.webp");

  if (companyLogoBase64) doc.addImage(companyLogoBase64, "PNG", 15, 10, 40, 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("QUOTATION", pageWidth / 2, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Quotation No: ${quotationNumber}`, pageWidth - 15, 15, { align: "right" });
  doc.text(`Date: ${quotationDate}`, pageWidth - 15, 22, { align: "right" });

  doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2]);
  doc.setLineWidth(0.8);
  doc.line(15, 35, pageWidth - 15, 35);

  let y = 45;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Customer Details", 15, y);

  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.rect(14, y + 2, pageWidth - 28, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(customerName, 15, y + 8);
  doc.text(customerAddress, 15, y + 14);

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Quotation Details", 15, y);

  doc.setDrawColor(200);
  doc.rect(14, y + 2, pageWidth - 28, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Delivery Time: ${deliveryTime}`, 15, y + 8);
  doc.text(`Payment Terms: ${paymentTerms}`, 15, y + 14);
  doc.text(`Validity Period: ${validityPeriod}`, 15, y + 20);

  y += 35;
  const tableColumn = ["#", "Product", "Quantity", "Unit Price", "Total"];
  const tableRows = products.map((item, index) => {
    const unitPrice = parseFloat(item.p_price?.single_price || 0);
    const quantity = parseInt(item.quantity || 0);
    const total = unitPrice * quantity;
    return [
      index + 1,
      item.p_name || "N/A",
      quantity,
      `₹${unitPrice.toFixed(2)}`,
      `₹${total.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableColumn],
    body: tableRows,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: accentColor },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 80 },
      2: { cellWidth: 20 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Grand Total: ₹${parseFloat(grandTotal || 0).toFixed(2)}`, pageWidth - 15, finalY, {
    align: "right",
  });

  if (notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 15, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(notes, 15, finalY + 16, { maxWidth: pageWidth - 30 });
  }

  if (paymentQrBase64) {
    doc.addImage(paymentQrBase64, "PNG", pageWidth - 50, finalY + 20, 35, 35);
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text("Scan to Pay", pageWidth - 33, finalY + 60, { align: "center" });
  }

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    "Thank you for your business!",
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  doc.save(`Quotation_${quotationNumber}.pdf`);
};