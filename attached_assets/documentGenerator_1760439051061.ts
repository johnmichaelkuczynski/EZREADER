import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export class DocumentGeneratorService {
  
  async generatePDF(content: string, filename: string): Promise<Buffer> {
    const doc = new jsPDF();
    
    // Configure PDF settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 6;
    const maxWidth = pageWidth - 2 * margin;
    
    // Split content into lines that fit the page width
    const lines = doc.splitTextToSize(content, maxWidth);
    
    let currentY = margin;
    let currentPage = 1;
    
    // Add content to PDF, handling page breaks
    for (let i = 0; i < lines.length; i++) {
      // Check if we need a new page
      if (currentY + lineHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        currentPage++;
      }
      
      doc.text(lines[i], margin, currentY);
      currentY += lineHeight;
    }
    
    // Return PDF as buffer
    return Buffer.from(doc.output('arraybuffer'));
  }
  
  async generateDOCX(content: string, filename: string): Promise<Buffer> {
    // Split content into paragraphs
    const paragraphs = content.split('\n\n').map(paragraph => 
      new Paragraph({
        children: [
          new TextRun({
            text: paragraph.trim(),
            size: 24, // 12pt font (size is in half-points)
          }),
        ],
        spacing: {
          after: 200, // Spacing after paragraph
        },
      })
    );
    
    // Create Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });
    
    // Generate buffer
    return await Packer.toBuffer(doc);
  }
  
  generateTXT(content: string): Buffer {
    return Buffer.from(content, 'utf-8');
  }
}

export const documentGeneratorService = new DocumentGeneratorService();