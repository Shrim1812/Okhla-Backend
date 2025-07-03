// app.js - Modified PDF generation routeimport express from "express";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { poolPromise } from "./db.js";
import MemberRouter from "./Router/MemberForm.js";
import receiptRoutes, { printer } from './controller/receipt.js';
import path from "path"; // Import path module
import { fileURLToPath } from "url"; // Import fileURLToPath

import fs from "fs"; // Import path module

const app = express();

// Resolve __filename and __dirname for the current ES Module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your logo image
// Assuming your logo is in a 'public' or 'images' folder at the root of your project
// Adjust this path based on where your 'oppa-logo.png' is actually located.
//const LOGO_PATH = path.join(__dirname,'images', 'oppalogo.png'); // Example path

// Middleware and other configurations remain the same
app.use('/receipt', receiptRoutes);
app.use(bodyParser.json());
const corsOptions = {
    origin: 'https://www.oppa.co.in',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
};
app.use(cors(corsOptions));
app.use("/Ohkla", MemberRouter);

// PDF generation route
app.get("/Ohkla/report/receipt", async (req, res) => {
    try {
        // Move LOGO_PATH definition inside the route handler
        const LOGO_PATH = path.join(__dirname,'images', 'oppalogo.png'); 
        // It's good practice to add a check if the logo file actually exists
        if (!fs.existsSync(LOGO_PATH)) { // You'll need to import 'fs' here as well
            console.error(`Error: Logo file not found at ${LOGO_PATH}`);
            return res.status(500).send("Logo file missing. Cannot generate PDF.");
        }
        const { receiptNo } = req.query;
        if (!receiptNo) {
            return res.status(400).send("Missing receiptNo in query parameters.");
        }

      const pool = await poolPromise;

// First: Try from YearlyPaymentSummary
let result = await pool.request()
    .input("receiptNo", receiptNo)
    .query(`
        SELECT
          yps.ReceiptNumber,
          yps.ReceiptDate,
          m.CompanyName,
          m.MemberName,
          yps.AmountPaid AS ReceivedAmount,
          yps.ChequeNumber,
          yps.ChequeReceiveOn,
          yps.PaymentType,
          yps.BankName,
          'yearly' AS Source
        FROM
          YearlyPaymentSummary yps
        JOIN
          Members m ON yps.MembershipID = m.MembershipID
        WHERE
          yps.ReceiptNumber = @receiptNo
    `);

// If not found, try from OtherPayments
if (result.recordset.length === 0) {
    result = await pool.request()
        .input("receiptNo", receiptNo)
        .query(`
            SELECT
              op.ReceiptNumber,
              op.CreatedAt AS ReceiptDate,
              m.CompanyName,
              m.MemberName,
              op.Amount AS ReceivedAmount,
              op.ChequeNumber,
              op.ChequeReceiveOn,
              op.PaymentMode AS PaymentType,
              NULL AS BankName,
              'other' AS Source
            FROM
              OtherPayments op
            JOIN
              Members m ON op.MembershipID = m.MembershipID
            WHERE
              op.PaymentCategory IN ('Other', 'Registration')
              AND op.ReceiptNumber = @receiptNo
        `);
}

if (result.recordset.length === 0) {
    return res.status(404).send("Receipt not found in either table.");
}

const data = result.recordset[0];
        if (result.recordset.length === 0) {
            return res.status(404).send("Receipt not found for the provided receipt number.");
        }

        const data = result.recordset[0];

        // Helper function to convert number to words (simple example, you might need a more robust library)
        const amountToWords = (amount) => {
            const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
            const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
            const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

            const numToWords = (num) => {
                if (num < 10) return units[num];
                if (num >= 10 && num < 20) return teens[num - 10];
                if (num >= 20 && num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + units[num % 10] : '');
                return '';
            };

            if (amount === 0) return 'zero';

            let words = [];
            let num = Math.floor(amount); // Handle integer part
            let decimal = Math.round((amount - num) * 100); // Get decimal part

            if (num >= 10000000) { // Crores
                words.push(numToWords(Math.floor(num / 10000000)) + ' crore');
                num %= 10000000;
            }
            if (num >= 100000) { // Lakhs
                words.push(numToWords(Math.floor(num / 100000)) + ' lakh');
                num %= 100000;
            }
            if (num >= 1000) { // Thousands
                words.push(numToWords(Math.floor(num / 1000)) + ' thousand');
                num %= 1000;
            }
            if (num >= 100) { // Hundreds
                words.push(numToWords(Math.floor(num / 100)) + ' hundred');
                num %= 100;
            }
            if (num > 0) {
                if (words.length > 0) words.push('and');
                words.push(numToWords(num));
            }

            let result = words.join(' ').trim();

            if (decimal > 0) {
                if (result) result += ' and ';
                result += numToWords(decimal) + ' paise';
            }
            return result.charAt(0).toUpperCase() + result.slice(1) + ' only.';
        };


    const docDefinition = {
    content: [
        {
            image: LOGO_PATH,
            width: 150,
            alignment: 'LEFT',
            margin: [0, 0, 0, 10]
        },
        {
            stack: [
                { text: 'OKHLA PRINTERS & PROVIDERS ASSOCIATION', style: 'associationName' }
            ],
            alignment: 'left',
            margin: [0, 0, 0, 5]
        },
        {
            text: '67, DSIDC Sheds, Okhla Industrial Area',
            alignment: 'left',
            fontSize: 8,
            margin: [0, 0, 0, 2]
        },
        {
            text: 'Phase I, New Delhi 110 020',
            alignment: 'left',
            fontSize: 8,
            margin: [0, 0, 0, 2]
        },
        {
            columns: [
                {
                    width: '*',
                    text: 'Section 8 Registered Company Under Companies Act, 2013',
                    fontSize: 8,
                    alignment: 'right'
                },
                {
                    width: '*',
                    text: 'CIN: U93090DL2018NPL341412',
                    fontSize: 8,
                    alignment: 'right'
                }
            ],
            margin: [0, 0, 0, 2]
        },
        {
            columns: [
                {
                    width: '*',
                    text: 'PAN: AACCO8151H',
                    fontSize: 8,
                    alignment: 'right'
                },
                {
                    width: '*',
                    text: '12A & 80G Exempted under Income Tax Act, 1961',
                    fontSize: 8,
                    alignment: 'right'
                }
            ],
            margin: [0, 0, 0, 2]
        },
        {
            text: 'Vide URN:AACCO8151HE2024',
            fontSize: 8,
            alignment: 'right',
            margin: [0, 0, 0, 20]
        },
        {
            text: 'RECEIPT VOUCHER',
            alignment: 'center',
            style: 'receiptVoucherHeader',
            margin: [0, 0, 0, 20]
        },
        {
            columns: [
                {
                    width: 'auto',
                    text: 'No.: ',
                    fontSize: 10,
                    bold: true
                },
                {
                    width: '*',
                    text: `${data.ReceiptNumber}`,
                    fontSize: 10
                },
                {
                    width: '*',
                    text: `Date: ${new Date(data.ReceiptDate).toLocaleDateString("en-IN")}`,
                    fontSize: 10,
                    alignment: 'right'
                }
            ],
            margin: [0, 0, 0, 10]
        },
        {
            text: [
                'Received with thanks from M/s ',
                { text: `${data.CompanyName || data.MemberName}`, bold: true },
                ' the sum of rupees ',
                { text: `${amountToWords(data.ReceivedAmount)}`, bold: true },
                ' By Mode: ',
                { text: `${data.PaymentType}`, bold: true }
            ],
            fontSize: 10,
            lineHeight: 1.5,
            margin: [0, 0, 0, 10]
        },

        // 🔽 Cheque block: conditionally added
        ...(data.PaymentType === 'Cheque'
            ? [{
                text: [
                    'By Cheque No. ',
                    { text: `${data.ChequeNumber || '-'}`, bold: true },
                    ' Date ',
                    { text: `${data.ChequeReceiveOn ? new Date(data.ChequeReceiveOn).toLocaleDateString("en-IN") : "-"}`, bold: true },
                    ' drawn on ',
                    { text: `${data.BankName || '-'}`, bold: true },
                    ' on account of Okhla Printers & Providers Association.'
                ],
                fontSize: 10,
                lineHeight: 1.5,
                margin: [0, 0, 0, 10]
            }]
            : []),

        {
            text: `₹ ${data.ReceivedAmount.toFixed(2)}`,
            alignment: 'left',
            fontSize: 12,
            bold: true,
            margin: [0, 0, 0, 50]
        },
        {
            text: 'For Okhla Printers & Providers Association',
            alignment: 'right',
            fontSize: 10,
            margin: [0, 0, 0, 50]
        },
        {
            text: 'Authorised Signatory',
            alignment: 'right',
            fontSize: 10,
            bold: true
        }
    ],
    styles: {
        associationName: {
            fontSize: 10,
            bold: false,
            color: '#000000',
            margin: [0, 5, 0, 0]
        },
        receiptVoucherHeader: {
            fontSize: 14,
            bold: true,
            decoration: 'underline'
        }
    },
    defaultStyle: {
        font: 'Roboto'
    }
};


        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=Receipt_${data.ReceiptNumber}.pdf`);

        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error("PDF generation error in /Ohkla/report/receipt:", err);
        res.status(500).send("Failed to generate PDF due to an internal server error.");
    }
});

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
