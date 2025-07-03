// app.js - Modified PDF generation route
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { poolPromise } from "./db.js";
import MemberRouter from "./Router/MemberForm.js";
import receiptRoutes, { printer } from './controller/receipt.js';
import path from "path"; // Import path module
import { fileURLToPath } from "url"; // Import fileURLToPath

const app = express();

// Resolve __filename and __dirname for the current ES Module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your logo image
// Assuming your logo is in a 'public' or 'images' folder at the root of your project
// Adjust this path based on where your 'oppa-logo.png' is actually located.
const LOGO_PATH = path.join(__dirname,'images', 'oppalogo.png'); // Example path

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
        const { receiptNo } = req.query;
        if (!receiptNo) {
            return res.status(400).send("Missing receiptNo in query parameters.");
        }

        const pool = await poolPromise;
        const result = await pool.request()
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
                  yps.BankName -- Assuming you have a BankName in your table
                FROM
                  YearlyPaymentSummary yps
                JOIN
                  Members m ON yps.MembershipID = m.MembershipID
                WHERE
                  yps.ReceiptNumber = @receiptNo
            `);

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
                    // OPPA Logo
                    [cite_start]image: LOGO_PATH, // [cite: 1]
                    width: 150, // Adjust width as needed
                    alignment: 'center',
                    margin: [0, 0, 0, 10]
                },
                {
                    // OPPA and OKHLA PRINTERS & PROVIDERS ASSOCIATION text
                    stack: [
                        [cite_start]{ text: 'OPPA', style: 'oppaHeader' }, // [cite: 1]
                        [cite_start]{ text: 'OKHLA PRINTERS & PROVIDERS ASSOCIATION', style: 'associationName' } // [cite: 2]
                    ],
                    alignment: 'center',
                    margin: [0, 0, 0, 5]
                },
                {
                    // Address
                    [cite_start]text: '67, DSIDC Sheds, Okhla Industrial Area', // [cite: 3]
                    alignment: 'center',
                    fontSize: 10,
                    margin: [0, 0, 0, 2]
                },
                {
                    [cite_start]text: 'Phase I, New Delhi 110 020', // [cite: 3]
                    alignment: 'center',
                    fontSize: 10,
                    margin: [0, 0, 0, 10]
                },
                {
                    // Company and Registration Details
                    columns: [
                        {
                            width: '*',
                            [cite_start]text: 'Section 8 Registered Company Under Companies Act, 2013', // [cite: 4]
                            fontSize: 8,
                            alignment: 'left'
                        },
                        {
                            width: '*',
                            [cite_start]text: 'CIN: U93090DL2018NPL341412', // [cite: 4]
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
                            [cite_start]text: 'PAN: AACCO8151H', // [cite: 5]
                            fontSize: 8,
                            alignment: 'left'
                        },
                        {
                            width: '*',
                            [cite_start]text: '12A & 80G Exempted under Income Tax Act, 1961', // [cite: 6]
                            fontSize: 8,
                            alignment: 'right'
                        }
                    ],
                    margin: [0, 0, 0, 2]
                },
                {
                    [cite_start]text: 'Vide URN:AACCO8151HE2024', // [cite: 6]
                    fontSize: 8,
                    alignment: 'right',
                    margin: [0, 0, 0, 20]
                },
                {
                    [cite_start]text: 'RECEIPT VOUCHER', // [cite: 7]
                    alignment: 'center',
                    style: 'receiptVoucherHeader',
                    margin: [0, 0, 0, 20]
                },
                {
                    columns: [
                        {
                            width: 'auto',
                            [cite_start]text: 'No.: ', // [cite: 8]
                            fontSize: 10,
                            bold: true
                        },
                        {
                            width: '*',
                            [cite_start]text: `${data.ReceiptNumber}`, // Dynamic Data [cite: 8]
                            fontSize: 10
                        },
                        {
                            width: 'auto',
                            [cite_start]text: 'Date: ', // [cite: 9]
                            fontSize: 10,
                            bold: true
                        },
                        {
                            width: '*',
                            [cite_start]text: `${new Date(data.ReceiptDate).toLocaleDateString("en-IN")}`, // Dynamic Data [cite: 9]
                            fontSize: 10,
                            alignment: 'right'
                        }
                    ],
                    margin: [0, 0, 0, 10]
                },
                {
                    text: [
                        [cite_start]'Received with thanks from M/s ', // [cite: 10]
                        [cite_start]{ text: `${data.CompanyName || data.MemberName}`, bold: true }, // Dynamic Data for M/s [cite: 10]
                        [cite_start]' the sum of rupees ', // [cite: 10]
                        [cite_start]{ text: `${amountToWords(data.ReceivedAmount)}`, bold: true }, // Dynamic Amount in words [cite: 10]
                        [cite_start]' by Cheque No. ', // [cite: 10]
                        { text: `${data.ChequeNumber || [cite_start]'-'}`, bold: true }, // Dynamic Cheque No. [cite: 10]
                        [cite_start]' Date ', // [cite: 10]
                        [cite_start]{ text: `${data.ChequeReceiveOn ? new Date(data.ChequeReceiveOn).toLocaleDateString("en-IN") : "-"}`, bold: true }, // Dynamic Cheque Date [cite: 10]
                        [cite_start]' drawn on ', // [cite: 10]
                        { text: `${data.BankName || [cite_start]'-'}`, bold: true }, // Dynamic Bank Name [cite: 10]
                        ' on account of Okhla Printers & Providers Association.' [cite_start]// [cite: 10]
                    ],
                    fontSize: 10,
                    lineHeight: 1.5,
                    margin: [0, 0, 0, 20]
                },
                {
                    [cite_start]text: `₹ ${data.ReceivedAmount.toFixed(2)}`, // Dynamic Amount [cite: 11]
                    alignment: 'right',
                    fontSize: 12,
                    bold: true,
                    margin: [0, 0, 0, 50]
                },
                {
                    [cite_start]text: 'For Okhla Printers & Providers Association', // [cite: 12]
                    alignment: 'right',
                    fontSize: 10,
                    margin: [0, 0, 0, 50]
                },
                {
                    [cite_start]text: 'Authorised Signatory', // [cite: 13]
                    alignment: 'right',
                    fontSize: 10,
                    bold: true
                }
            ],
            styles: {
                oppaHeader: {
                    fontSize: 36,
                    bold: true,
                    color: '#000000' // Or the color of the OPPA text if you can define it
                },
                associationName: {
                    fontSize: 10,
                    bold: false,
                    color: '#000000',
                    margin: [0, 5, 0, 0]
                },
                receiptVoucherHeader: {
                    fontSize: 16,
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
