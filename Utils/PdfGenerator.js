
import PDFDocument from 'pdfkit';
import getStream from 'get-stream';

export const generateReceiptPDF = async (member, receipt) => {
  const doc = new PDFDocument();
  let buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  doc.fontSize(16).text(`Receipt - ${receipt.ReceiptNumber}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Date: ${new Date(receipt.CreatedAt).toLocaleDateString()}`);
  doc.text(`Member Name: ${member.MemberName}`);
  doc.text(`Email: ${member.Email}`);
  doc.moveDown();

  doc.text(`Amount: ₹${receipt.Amount}`);
  doc.text(`Payment Mode: ${receipt.PaymentMode}`);
  doc.text(`Remarks: ${receipt.Remarks || "N/A"}`);

  doc.end();
  return await getStream.buffer(doc); // Returns Buffer
};
export default generateReceiptPDF;
