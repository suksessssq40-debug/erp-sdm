
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyProfile } from '../types';

export const generateFinancePDF = (
  title: string,
  period: string,
  companyProfile: CompanyProfile,
  data: string[][],
  columns: string[],
  summary?: { label: string; value: string }[]
) => {
  const doc = new jsPDF();

  // --- 1. HEADER (KOP SURAT) ---
  let yPos = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Logo
  if (companyProfile.logoUrl) {
    const imgProps = doc.getImageProperties(companyProfile.logoUrl);
    const imgWidth = 25;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    // Position Logic
    let xLogo = 15;
    if (companyProfile.logoPosition === 'right') xLogo = pageWidth - imgWidth - 15;
    // 'left' or undefined falls back to 15
    // Note: 'top' typically implies center-top or strictly top-left with text below.
    // For this implementation, we treat 'top' as 'left' or handle simplified.
    if (companyProfile.logoPosition === 'top') xLogo = (pageWidth - imgWidth) / 2;
    
    try {
        doc.addImage(companyProfile.logoUrl, 'JPEG', xLogo, yPos, imgWidth, imgHeight);
    } catch (e) {
        console.warn("Could not add logo", e);
    }
  }

  // Company Info
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const textX = companyProfile.logoPosition === 'left' ? 50 : (pageWidth / 2);
  const align = companyProfile.logoPosition === 'left' ? 'left' : 'center';
  
  doc.text(companyProfile.name || 'YOUR COMPANY NAME', textX, yPos + 8, { align });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  
  // Address wrapping
  const splitAddress = doc.splitTextToSize(companyProfile.address || '', 120);
  doc.text(splitAddress, textX, yPos + 14, { align });
  
  if (companyProfile.phone) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.text(companyProfile.phone, textX, yPos + 14 + (splitAddress.length * 4), { align });
  }

  // Divider Line
  yPos += 35;
  doc.setDrawColor(200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  
  // --- 2. REPORT TITLE ---
  yPos += 15;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(period, pageWidth / 2, yPos, { align: 'center' });

  // --- 3. SUMMARY SECTION (If Any) ---
  if (summary) {
    yPos += 15;
    let xSum = 15;
    summary.forEach(item => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(item.label, xSum, yPos);
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(item.value, xSum, yPos + 5);
        xSum += 50;
    });
    yPos += 10;
  } else {
    yPos += 10;
  }

  // --- 4. TABLE ---
  autoTable(doc, {
    startY: yPos,
    head: [columns],
    body: data as never[],
    theme: 'grid',
    headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
    },
    styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: 50
    },
    alternateRowStyles: {
        fillColor: [248, 250, 252] // Slate 50
    },
    columnStyles: {
        0: { cellWidth: 25 }, // Date
        1: { cellWidth: 35 }, // Ref/Account
        2: { cellWidth: 'auto' }, // Desc
        // Adjust last columns (Debit/Credit/Balance)
        // We assume last 3 are numbers
    },
    didParseCell: function(data) {
        // Align numbers to right
        if (data.section === 'body' && (data.column.index >= columns.length - 3)) {
            data.cell.styles.halign = 'right';
        }
    }
  });

  // --- 5. FOOTER (Signature) ---
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  
  // Check if page break needed
  if (finalY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      // Reset Y if new page
  }
  
  const signY = finalY > doc.internal.pageSize.getHeight() - 40 ? 40 : finalY;

  doc.setFontSize(9);
  doc.setTextColor(0);
  
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  
  // Right side signature (Finance)
  doc.text(`Dicetak pada: ${dateStr}`, pageWidth - 15, signY, { align: 'right' });
  doc.text("Dibuat Oleh,", pageWidth - 40, signY + 10, { align: 'center' });
  doc.text("( Finance )", pageWidth - 40, signY + 35, { align: 'center' });

  // Left side signature (Approved)
  doc.text("Disetujui Oleh,", 40, signY + 10, { align: 'center' });
  doc.text("( Owner / Manager )", 40, signY + 35, { align: 'center' });

  doc.save(`${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};
