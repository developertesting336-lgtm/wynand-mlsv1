import { jsPDF } from 'jspdf';

export async function generateBeautifulMoveOutPDF(booking, reportData, listingTitle = 'Property', returnDoc = false) {
  const doc = new jsPDF('p', 'mm', 'a4');

  const PRIMARY_COLOR = [30, 41, 59];
  const SECONDARY_COLOR = [71, 85, 105];
  const ACCENT_COLOR = [14, 165, 233];
  const BG_LIGHT = [248, 250, 252];
  const BORDER_COLOR = [226, 232, 240];
  const NAVY_DARK = [15, 23, 42];

  doc.setFillColor(...NAVY_DARK);
  doc.rect(0, 0, 210, 45, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('PV Verified Move-out Report', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Booking Ref: ${booking?.id || 'N/A'}`, 15, 30);
  doc.text(`Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 15, 36);

  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(15, 41, 180, 1.5, 'F');

  let yPos = 55;

  const drawSectionHeader = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(title, 15, yPos);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.5);
    doc.line(15, yPos + 2, 195, yPos + 2);
    yPos += 10;
  };

  drawSectionHeader('PROPERTY & MOVE-OUT DETAILS');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...PRIMARY_COLOR);

  doc.setFillColor(...BG_LIGHT);
  doc.setDrawColor(...BORDER_COLOR);
  doc.rect(15, yPos - 5, 180, 26, 'FD');
  doc.text(`Property Name: ${listingTitle}`, 20, yPos + 1);
  doc.text(`Move-in Date: ${booking?.move_in_date || 'N/A'}`, 20, yPos + 7);
  doc.text(`Move-out Date: ${booking?.move_out_date || 'N/A'}`, 20, yPos + 13);
  doc.text(`Lease Status: ${booking?.status || 'N/A'}`, 20, yPos + 19);
  yPos += 30;

  const writeSectionText = (header, text) => {
    if (!text) return;
    if (yPos > 250) { doc.addPage(); yPos = 20; }

    drawSectionHeader(header);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SECONDARY_COLOR);

    const wrapped = doc.splitTextToSize(text, 180);
    doc.text(wrapped, 20, yPos);
    yPos += wrapped.length * 5 + 10;
  };

  writeSectionText('1. Move-out Summary', reportData.moveOutSummary || 'No summary provided.');
  writeSectionText('2. Inspection Findings', reportData.inspectionFindings || 'No inspection findings provided.');
  writeSectionText('3. Damage Report', reportData.damageReport || 'No damage details provided.');
  writeSectionText('4. Final Invoice', reportData.finalInvoice || 'No final invoice details provided.');

  if (yPos > 250) { doc.addPage(); yPos = 20; }
  drawSectionHeader('5. Deposit & Refund');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(`Security Deposit Paid: $${(reportData.depositAmount ?? 0).toLocaleString()}`, 20, yPos);
  doc.text(`Damage Deduction: $${(reportData.damageDeduction ?? 0).toLocaleString()}`, 20, yPos + 6);
  doc.text(`Refund Due: $${(reportData.refundAmount ?? 0).toLocaleString()}`, 20, yPos + 12);
  yPos += 24;

  if (yPos > 250) { doc.addPage(); yPos = 20; }
  drawSectionHeader('6. Lease Closure');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(reportData.closeLease ? 'Lease marked as completed/terminated.' : 'Lease closure not marked yet.', 20, yPos);
  yPos += 16;

  if (yPos > 240) { doc.addPage(); yPos = 20; }
  drawSectionHeader('7. Signatures');

  const signatureRoles = [
    { label: 'Owner', signature: reportData.ownerSignature, date: reportData.ownerSignatureDate },
    { label: 'Tenant', signature: reportData.tenantSignature, date: reportData.tenantSignatureDate },
    { label: 'Agent', signature: reportData.agentSignature, date: reportData.agentSignatureDate },
  ];

  signatureRoles.forEach((entry, index) => {
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    const cardHeight = 30;
    doc.setFillColor(...BG_LIGHT);
    doc.rect(15, yPos - 5, 180, cardHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(entry.label, 20, yPos + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SECONDARY_COLOR);
    doc.text(`Date: ${entry.date ? new Date(entry.date).toLocaleDateString('en-US') : 'N/A'}`, 20, yPos + 10);
    if (entry.signature) {
      try {
        doc.addImage(entry.signature, 'JPEG', 140, yPos - 2, 50, 24);
      } catch (err) {
        doc.text('Signed', 140, yPos + 10);
      }
    } else {
      doc.text('Pending signature', 140, yPos + 10);
    }
    yPos += cardHeight + 8;
  });

  if (returnDoc) return doc;
  doc.save(`MoveOut_Report_${booking?.id || 'export'}.pdf`);
}
