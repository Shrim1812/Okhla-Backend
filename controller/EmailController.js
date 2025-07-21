// ✅ UPDATED sendEmailWithReceipt: with full receipt layout like browser view

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import PdfPrinter from "pdfmake";
import { poolPromise, sql } from "../db.js";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fontsPath = path.join(__dirname, '..', 'Fonts');
// const LOGO_PATH = path.join(__dirname,'images', 'oppalogo.png'); 

const fonts = {
  Roboto: {
    normal: path.join(fontsPath, 'Roboto-Regular.ttf'),
    bold: path.join(fontsPath, 'Roboto-Medium.ttf'),
    italics: path.join(fontsPath, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsPath, 'Roboto-MediumItalic.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

const logoPath = path.join(__dirname, '..', 'images', 'oppalogo.png');
if (!fs.existsSync(logoPath)) {
  console.error("❌ oppalogo.png not found at", logoPath);
  process.exit(1); // optional
}
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const imageDataUrl = `data:image/png;base64,${logoBase64}`;


export const sendEmailWithReceipt = async (req, res) => {
  try {
    const { receiptId, userId, toEmail } = req.body;

    if (!receiptId || !userId)
      return res.status(400).json({ success: false, message: "Missing receiptId or userId" });
    

    const parsedReceiptId = parseInt(receiptId.toString().match(/\d+/)[0], 10);
    const parsedUserId = parseInt(userId, 10);
    const pool = await poolPromise;

    const receiptResult = await pool
      .request()
      .input("ReceiptID", sql.Int, parsedReceiptId)
      .query("SELECT * FROM Receipts WHERE ReceiptID = @ReceiptID");

    if (!receiptResult.recordset.length)
      return res.status(404).json({ success: false, message: "Receipt not found" });
   

    const receipt = receiptResult.recordset[0];
 console.log("🔍 Full Receipt Data:", receipt);
console.log("🪙 AmountPaid Raw Value:", receipt?.AmountPaid);
    const memberResult = await pool
      .request()
      .input("MembershipID", sql.Int, receipt.MembershipID)
      .query("SELECT * FROM Members WHERE MembershipID = @MembershipID");

    if (!memberResult.recordset.length)
      return res.status(404).json({ success: false, message: "Member not found" });

    const member = memberResult.recordset[0];

    const userResult = await pool
      .request()
      .input("UserID", sql.Int, parsedUserId)
      .query("SELECT * FROM Users WHERE UserID = @UserID");

    if (!userResult.recordset.length)
      return res.status(404).json({ success: false, message: "Sender not found" });

    const { SenderEmail, SenderPassword, EmailType } = userResult.recordset[0];

    const amountToWords = (Amount) => {
      const num = parseFloat(Amount);
      if (isNaN(num)) return 'Invalid amount';

      const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
      const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
      const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

      const numToWords = (num) => {
        if (num < 10) return units[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + units[num % 10] : '');
        return '';
      };

      if (num === 0) return 'zero';
      let words = [], intPart = Math.floor(num), decimal = Math.round((num - intPart) * 100);
      if (intPart >= 10000000) { words.push(numToWords(Math.floor(intPart / 10000000)) + ' crore'); intPart %= 10000000; }
      if (intPart >= 100000) { words.push(numToWords(Math.floor(intPart / 100000)) + ' lakh'); intPart %= 100000; }
      if (intPart >= 1000) { words.push(numToWords(Math.floor(intPart / 1000)) + ' thousand'); intPart %= 1000; }
      if (intPart >= 100) { words.push(numToWords(Math.floor(intPart / 100)) + ' hundred'); intPart %= 100; }
      if (intPart > 0) { if (words.length > 0) words.push('and'); words.push(numToWords(intPart)); }
      let result = words.join(' ').trim();
      if (decimal > 0) result += ' and ' + numToWords(decimal) + ' paise';
      return result.charAt(0).toUpperCase() + result.slice(1) + ' only.';
    };

    const formattedAmount = isNaN(parseFloat(receipt.ReceivedAmount)) ? '0.00' : parseFloat(receipt.ReceivedAmount).toFixed(2);

    const docDefinition = {
      content: [
        {
          columns: [
            {
              width: '50%',
              stack: [
                { image: imageDataUrl, width: 150, alignment: 'left', margin: [0, 0, 0, 5] },
                { text: 'OKHLA PRINTERS & PROVIDERS ASSOCIATION', style: 'associationName' },
                { text: '67, DSIDC Sheds, Okhla Industrial Area', fontSize: 8, alignment: 'left' },
                { text: 'Phase I, New Delhi 110 020', fontSize: 8, alignment: 'left' }
              ]
            },
            {
              width: '50%', alignment: 'right', stack: [
                { text: 'Section 8 Registered Company Under Companies Act, 2013', fontSize: 8 },
                { text: 'CIN : U93090DL2018NPL341412', fontSize: 8 },
                { text: 'PAN : AACCO8151H', fontSize: 8 },
                { text: '12A & 80G Exempted under Income Tax Act, 1961', fontSize: 8 },
                { text: 'Vide URN:AACCO8151HE2024', fontSize: 8 }
              ]
            }
          ],
          margin: [0, 0, 0, 20]
        },
        { text: 'RECEIPT VOUCHER', alignment: 'center', style: 'receiptVoucherHeader', margin: [0, 0, 0, 20] },
        {
          columns: [
            { width: 'auto', text: 'No.: ', fontSize: 10, bold: true },
            { width: '*', text: `${receipt.ReceiptNumber}`, fontSize: 10 },
            { width: '*', text: `Date: ${new Date(receipt.ReceiptDate).toLocaleDateString("en-IN")}`, alignment: 'right', fontSize: 10 }
          ],
          margin: [0, 0, 0, 10]
        },
      {
  text: [
    'Received with thanks from M/s ',
    { text: `${member.CompanyName || member.MemberName}`, bold: true },
    ' the sum of rupees ',
    { text: amountToWords(receipt.ReceivedAmount || 0), bold: true },
    ' via ',
    { text: receipt.PaymentMode || 'N/A', bold: true },
    ' towards ',
    {
      text: receipt.PaymentYear
        ? 'Annual Payment'
        : receipt.PaymentType || 'Payment',
      bold: true
    },
    ' for Okhla Printers & Providers Association.'
  ],
  fontSize: 10,
  lineHeight: 1.5,
  margin: [0, 0, 0, 10]
},
        ...(receipt.PaymentType === 'Cheque' ? [{
          text: [
            'By Cheque No. ', { text: `${receipt.ChequeNumber || '-'}`, bold: true },
            ' Date ', { text: `${receipt.ChequeReceiveOn ? new Date(receipt.ChequeReceiveOn).toLocaleDateString("en-IN") : '-'}`, bold: true },
            ' drawn on ', { text: `${receipt.BankName || '-'}`, bold: true },
            ' on account of Okhla Printers & Providers Association.'
          ],
          fontSize: 10, margin: [0, 0, 0, 10]
        }] : []),
        { text: `₹ ${formattedAmount}`, alignment: 'left', fontSize: 12, bold: true, margin: [0, 0, 0, 50] },
        { text: 'For Okhla Printers & Providers Association', alignment: 'right', fontSize: 10, margin: [0, 0, 0, 50] },
        { text: 'Authorised Signatory', alignment: 'right', fontSize: 10, bold: true }
      ],
      styles: {
        associationName: { fontSize: 10, bold: false, color: '#000000', margin: [0, 5, 0, 0] },
        receiptVoucherHeader: { fontSize: 14, bold: true, decoration: 'underline' }
      },
      defaultStyle: { font: 'Roboto' },
      pageOrientation: 'portrait'
    };

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const pdfPath = path.join(tempDir, `Receipt-${receipt.ReceiptNumber}.pdf`);

    await new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const writeStream = fs.createWriteStream(pdfPath);
      pdfDoc.pipe(writeStream);
      pdfDoc.end();
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    });

    const transporter = nodemailer.createTransport({
      service: EmailType === 'Google' ? 'gmail' : undefined,
      host: EmailType === 'Microsoft' ? 'smtp.office365.com' : undefined,
      port: EmailType === 'Microsoft' ? 587 : undefined,
      secure: false,
      auth: { user: SenderEmail, pass: SenderPassword }
    });

    await transporter.sendMail({
      from: SenderEmail,
      to: toEmail || member.Email,
      subject: `Payment Receipt - ${receipt.ReceiptNumber}`,
      html: `<p>Hello <b>${member.MemberName}</b>,<br>Your payment receipt <b>${receipt.ReceiptNumber}</b> is attached.<br>Thank you.</p>`,
      attachments: [{ filename: `Receipt-${receipt.ReceiptNumber}.pdf`, path: pdfPath }]
    });

    fs.unlinkSync(pdfPath);
    return res.status(200).json({ success: true, message: "Email sent with PDF!" });
  } catch (error) {
    console.error("❌ Email send error:", error);
    return res.status(500).json({ success: false, message: "Failed to send email." });
  }
};


export const getMemberEmailByReceiptNumber = async (req, res) => {
  try {
    const { receiptNo } = req.params;

    const pool = await poolPromise;
    const result = await pool.request()
      .input("ReceiptNumber", sql.VarChar, receiptNo)
      .query(`
        SELECT m.Email 
        FROM Receipts r 
        JOIN Members m ON r.MembershipID = m.MembershipID 
        WHERE r.ReceiptNumber = @ReceiptNumber
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.status(200).json({ email: result.recordset[0].Email });

  } catch (err) {
    console.error("❌ Error fetching email:", err.message);
    res.status(500).json({ error: "Failed to fetch email" });
  }
};

 // module.exports = {
 // sendEmailWithReceipt,
 // getMemberEmailByReceiptNumber,
 // };
