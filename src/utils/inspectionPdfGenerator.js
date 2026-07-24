import { jsPDF } from 'jspdf';

export async function generateBeautifulInspectionPDF(booking, inspectionData, listingTitle = 'Property', returnDoc = false) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Color Palette
  const PRIMARY_COLOR = [30, 41, 59]; // Slate 800
  const SECONDARY_COLOR = [71, 85, 105]; // Slate 600
  const ACCENT_COLOR = [14, 165, 233]; // Sky 500
  const BG_LIGHT = [248, 250, 252]; // Slate 50
  const BORDER_COLOR = [226, 232, 240]; // Slate 200
  const NAVY_DARK = [15, 23, 42]; // Dark Navy

  // 1. Header & Title Block (Dark Navy Background, White Text)
  doc.setFillColor(...NAVY_DARK);
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('PV Verified Inspection', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Booking Ref: ${booking?.id || 'N/A'}`, 15, 30);
  doc.text(`Inspection Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 15, 36);

  // Decorative border accent line
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(15, 41, 180, 1.5, 'F');

  let yPos = 55;

  // Helper: Draw Section Title
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

  // Section 2: Property & Lease Details
  drawSectionHeader('PROPERTY & LEASE DETAILS');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...PRIMARY_COLOR);

  // Box details
  doc.setFillColor(...BG_LIGHT);
  doc.setDrawColor(...BORDER_COLOR);
  doc.rect(15, yPos - 5, 180, 22, 'FD');

  doc.text(`Property Name: ${listingTitle}`, 20, yPos + 1);
  doc.text(`Move-in Date: ${booking?.move_in_date || 'N/A'}`, 20, yPos + 7);
  doc.text(`Lease Term: ${booking?.lease_duration_months || 12} Months`, 20, yPos + 13);
  yPos += 25;

  // Section 3: Inventory & Fixture Condition
  drawSectionHeader('INVENTORY & CONDITION RECORD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...SECONDARY_COLOR);

  const inventoryText = inspectionData?.inventory || 'No inventory entered.';
  const splitInventory = doc.splitTextToSize(inventoryText, 170);
  doc.text(splitInventory, 20, yPos);
  yPos += (splitInventory.length * 5) + 10;

  // Section: Photos
  if (inspectionData?.photos && inspectionData.photos.length > 0) {
    if (yPos > 210) { doc.addPage(); yPos = 20; }
    drawSectionHeader('PROPERTY PHOTOS');
    
    let photoX = 15;
    const photoWidth = 40;
    const photoHeight = 30;

    for (const photoUrl of inspectionData.photos) {
      if (photoX + photoWidth > 195) {
        photoX = 15;
        yPos += photoHeight + 5;
        if (yPos > 240) { doc.addPage(); yPos = 20; }
      }
      try {
        doc.addImage(photoUrl, 'JPEG', photoX, yPos, photoWidth, photoHeight);
      } catch (err) {
        doc.setDrawColor(...BORDER_COLOR);
        doc.rect(photoX, yPos, photoWidth, photoHeight);
        doc.setFontSize(7);
        doc.text('Photo Link', photoX + 5, yPos + 15);
      }
      photoX += photoWidth + 5;
    }
    yPos += photoHeight + 10;
  }

  // Section 4: Meter Readings & Utilities
  if (yPos > 220) { doc.addPage(); yPos = 20; }
  drawSectionHeader('UTILITY METER READINGS');
  
  // Table-style readings
  const readings = [
    { label: 'Electricity Meter', value: `${inspectionData?.meterReadings?.electricity || '—'} kWh` },
    { label: 'Water Meter', value: `${inspectionData?.meterReadings?.water || '—'} m³` },
    { label: 'Gas Level/Meter', value: `${inspectionData?.meterReadings?.gas || '—'}` },
    { label: 'Other/Internet ONT', value: `${inspectionData?.meterReadings?.other || '—'}` },
  ];

  doc.setFont('helvetica', 'bold');
  doc.text('Utility Type', 20, yPos);
  doc.text('Reading Value', 120, yPos);
  doc.line(15, yPos + 2, 195, yPos + 2);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  readings.forEach((r) => {
    doc.text(r.label, 20, yPos);
    doc.text(r.value, 120, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);
    yPos += 8;
  });
  yPos += 8;

  // Section 5: Keys & Deposit Confirmed
  if (yPos > 240) { doc.addPage(); yPos = 20; }
  drawSectionHeader('CONFIRMATIONS & HANDOVER');
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Keys / Access Cards Issued: ${inspectionData?.keysIssued || '—'}`, 20, yPos);
  yPos += 7;
  doc.text(`Security Deposit Registered: ${inspectionData?.depositRecorded ? 'YES (Confirmed)' : 'NO (Pending)'}`, 20, yPos);
  yPos += 15;

  // Section 6: Signatures (Stacked Cards Layout)
  if (yPos > 180) { doc.addPage(); yPos = 20; }
  drawSectionHeader('INSPECTION SIGNATURES');

  const cardWidth = 180;
  const cardHeight = 35;
  const startX = 15;

  const signaturesList = [
    {
      role: 'LANDLORD',
      name: booking?.owner_name || 'Landlord / Owner',
      signature: inspectionData?.ownerSignature,
      date: inspectionData?.ownerSignatureDate,
    },
    {
      role: 'TENANT',
      name: booking?.renter_name || 'Renter / Tenant',
      signature: inspectionData?.tenantSignature,
      date: inspectionData?.tenantSignatureDate,
    },
    {
      role: 'AGENT',
      name: booking?.agent_name || 'Agent',
      signature: inspectionData?.agentSignature,
      date: inspectionData?.agentSignatureDate,
    },
  ];

  signaturesList.forEach((sig) => {
    if (yPos > 240) { doc.addPage(); yPos = 20; }

    // Card background
    doc.setFillColor(...BG_LIGHT);
    doc.rect(startX, yPos, cardWidth, cardHeight, 'F');

    // Title / Role
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(sig.role, startX + 5, yPos + 7);

    // Details text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SECONDARY_COLOR);
    doc.text(`Name:  ${sig.name}`, startX + 5, yPos + 18);
    
    const formattedDate = sig.date 
      ? formatInspectionDate(sig.date)
      : 'N/A';
    doc.text(`Date:    ${formattedDate}`, startX + 5, yPos + 26);

    // Signature image / text block right-aligned inside card
    const sigX = startX + cardWidth - 55;
    const sigY = yPos + 5;
    const sigW = 50;
    const sigH = cardHeight - 10;

    if (sig.signature) {
      try {
        doc.addImage(sig.signature, 'JPEG', sigX, sigY, sigW, sigH);
      } catch (e) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.text('Signed digitally', sigX + 15, sigY + 13);
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(156, 163, 175);
      doc.text('Pending signature', sigX + 15, sigY + 13);
    }

    yPos += cardHeight + 6;
  });

  if (returnDoc) {
    return doc;
  }
  doc.save(`Inspection_Report_${booking?.id || 'export'}.pdf`);
}

function formatInspectionDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
  } catch (err) {
    return 'N/A';
  }
}
