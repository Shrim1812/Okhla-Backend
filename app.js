import express from 'express';
import puppeteer from 'puppeteer-core';
import cors from 'cors';
import bodyParser from 'body-parser';
import Member from './Router/MemberForm.js';
import fs from 'fs';
import path from 'path';
import chromium from 'chrome-aws-lambda';
import otpRouter from './Router/MemberForm.js'; 
import { sql, poolPromise } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extends: true }));
app.use("/otpRouter", otpRouter);

app.use("/Ohkla", Member);
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.originalUrl}`);
    next();
});

// async function getReceiptData(receiptNo) {
//   const pool = await poolPromise;

//   const query = `
//     SELECT 
//       yps.ReceiptNumber,
//       CONVERT(varchar, yps.ReceiptDate, 23) AS ReceiptDate,
//       m.CompanyName,
//       yps.AmountPaid AS ReceivedAmount,
//       yps.PaymentType,
//       yps.PaymentYear,
//       m.MemberName,
//       op.Remark, -- Join from OtherPayments
//       CASE 
//         WHEN yps.PaymentType = 'Cheque' THEN CONCAT('Cheque - ', yps.ChequeNumber)
//         ELSE yps.PaymentType
//       END AS DisplayPaymentType
//     FROM YearlyPaymentSummary yps
//     JOIN Members m ON yps.MembershipID = m.MembershipID
//     LEFT JOIN OtherPayments op ON yps.ReceiptNumber = op.ReceiptNumber -- Add LEFT JOIN
//     WHERE yps.ReceiptNumber = @ReceiptNo
//   `;

//   const result = await pool
//     .request()
//     .input('ReceiptNo', sql.VarChar, receiptNo)
//     .query(query);

//   return result.recordset.length > 0 ? result.recordset[0] : null;
// }




async function getReceiptData(receiptNo) {
  const pool = await poolPromise;

  // First: Try to find in YearlyPaymentSummary
  const yearlyQuery = `
    SELECT 
      yps.ReceiptNumber,
      CONVERT(varchar, yps.ReceiptDate, 23) AS ReceiptDate,
      m.CompanyName,
      yps.AmountPaid AS ReceivedAmount,
      yps.PaymentType,
      yps.PaymentYear,
       yps.ChequeNumber,
       yps.ChequeReceiveOn,
      m.MemberName,
      NULL AS Remark,
      CASE 
        WHEN yps.PaymentType = 'Cheque' THEN CONCAT('Cheque - ', yps.ChequeNumber)
        ELSE yps.PaymentType
      END AS DisplayPaymentType,
      'yearly' AS Source
    FROM YearlyPaymentSummary yps
    JOIN Members m ON yps.MembershipID = m.MembershipID
    WHERE yps.ReceiptNumber = @ReceiptNo
  `;

  const yearlyResult = await pool
    .request()
    .input('ReceiptNo', sql.VarChar, receiptNo)
    .query(yearlyQuery);

  if (yearlyResult.recordset.length > 0) {
    return yearlyResult.recordset[0];
  }

  // If not found: Try from OtherPayments table
  const otherQuery = `
   SELECT  
    op.ReceiptNumber,
    CONVERT(varchar, op.CreatedAt, 23) AS ReceiptDate,
    m.CompanyName,
    m.MemberName,
    op.PaymentMode AS DisplayPaymentType,
    op.Amount AS ReceivedAmount,
    op.PaymentCategory AS PaymentType,
    op.ChequeNumber,
    op.ChequeReceiveOn,
    NULL AS PaymentYear,
    op.Remark,
    'other' AS Source
  FROM 
    OtherPayments op
  JOIN 
    Members m ON op.MembershipID = m.MembershipID
  WHERE 
    op.PaymentCategory IN ('Other', 'Registration')
    AND op.ReceiptNumber = @ReceiptNo
  `;

  const otherResult = await pool
    .request()
    .input('ReceiptNo', sql.VarChar, receiptNo)
    .query(otherQuery);

  return otherResult.recordset.length > 0 ? otherResult.recordset[0] : null;
}

app.get('/Ohkla/report/receipt', async (req, res) => {
  const receiptNo = req.query.receiptNo;
  if (!receiptNo) {
    return res.status(400).send('receiptNo param is required');
  }

  try {
    const data = await getReceiptData(receiptNo);
    if (!data) return res.status(404).send('Receipt not found');
    

    // Logic to decide dynamic fields
 const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }); // Output: 26 Jun 2025
};



    const paymentType = (data.PaymentType || '').toLowerCase();
    const isCheque = paymentType === 'cheque';
    console.log("PaymentType:", data.PaymentType);
console.log("ChequeNumber:", data.ChequeNumber);
console.log("ChequeReceiveOn:", data.ChequeReceiveOn);

    
    const isOtherOrReg = paymentType === 'registration' || paymentType === 'other';

    const paymentYearHtml = !isOtherOrReg && data.PaymentYear
      ? `<p><strong>For Year:</strong> ${data.PaymentYear}</p>` : '';

    const remarkHtml = isOtherOrReg && data.Remark
      ? `<p><strong>Remark:</strong> ${data.Remark}</p>` : '';
      
const chequeNumberHtml = data.ChequeNumber
  ? `<p><strong>Cheque Number:</strong> ${data.ChequeNumber}</p>` : '';

const chequeReceiveOnHtml = data.ChequeReceiveOn
  ? `<p><strong>Cheque Received On:</strong> ${formatDate(data.ChequeReceiveOn)}</p>` : '';


          
    // Inject static and dynamic values
    let html = fs.readFileSync(path.join('templatest/receiptTemplate.html'), 'utf8');
    html = html
      .replace('{{ReceiptNumber}}', data.ReceiptNumber || '')
      .replace('{{CompanyName}}', data.CompanyName || '')
      .replace('{{MemberName}}', data.MemberName || '')
      .replace('{{ReceiptDate}}', data.ReceiptDate || '')
      .replace('{{ReceivedAmount}}', data.ReceivedAmount || '')
      .replace('{{PaymentType}}', data.PaymentType || '')
      .replace('{{PaymentYearSection}}', paymentYearHtml)
      .replace('{{RemarkSection}}', remarkHtml)
  html = html.replace('{{ChequeNumberSection}}', chequeNumberHtml);
html = html.replace('{{ChequeReceiveOnSection}}', chequeReceiveOnHtml);


const browser = await puppeteer.launch({
  args: chrome.args,
  executablePath: await chrome.executablePath || '/usr/bin/chromium-browser',
  headless: true
});
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Receipt_${receiptNo}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error while generating receipt');
  }
});



app.listen(5000, () => {
  console.log("🚀 Server started on http://localhost:5000");
});
