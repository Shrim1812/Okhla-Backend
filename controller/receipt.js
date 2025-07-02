import express from "express";
import fs from "fs"; // Keep for debugging
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import PdfPrinter from "pdfmake";
import { poolPromise } from "../db.js";

// Resolve __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- START DEBUGGING LOGS (keep for verification) ---
console.log('DEBUG: Current __filename:', __filename);
console.log('DEBUG: Current __dirname:', __dirname);

// CORRECTED fontsPath calculation:
// From /opt/render/project/src/controller/, go up one ('..') to /opt/render/project/src/,
// then go into 'Fonts' folder
const fontsPath = path.join(__dirname, '..', 'Fonts');

console.log('DEBUG: Calculated fontsPath (after correction):', fontsPath);

try {
    const isFontsPathDirectory = fs.existsSync(fontsPath) && fs.lstatSync(fontsPath).isDirectory();
    console.log(`DEBUG: Is '${fontsPath}' a directory?`, isFontsPathDirectory);

    if (isFontsPathDirectory) {
        const filesInFontsDir = fs.readdirSync(fontsPath);
        console.log('DEBUG: Files found in fonts directory:', filesInFontsDir);

        const requiredFonts = ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf'];
        requiredFonts.forEach(fontFile => {
            const fontFilePath = path.join(fontsPath, fontFile);
            const exists = fs.existsSync(fontFilePath);
            console.log(`DEBUG: Font file '${fontFile}' exists at '${fontFilePath}'?`, exists);
            if (!exists) {
                console.error(`DEBUG: !!! CRITICAL: ${fontFile} NOT FOUND at expected path!`);
            } else {
                console.log(`DEBUG: 👍 ${fontFile} found!`);
            }
        });
    } else {
        console.error('DEBUG: !!! CRITICAL: Fonts directory DOES NOT EXIST or is not a directory at:', fontsPath);
    }
} catch (err) {
    console.error('DEBUG: !!! CRITICAL: Error accessing fonts directory (during corrected path check):', err.message);
}
// --- END DEBUGGING LOGS ---


const fonts = {
  Roboto: {
    normal: path.join(fontsPath, 'Roboto-Regular.ttf'),
    bold: path.join(fontsPath, 'Roboto-Medium.ttf'),
    italics: path.join(fontsPath, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsPath, 'Roboto-MediumItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);
const router = express.Router();

router.post("/generate-receipt", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        yps.ReceiptNumber,
        yps.ReceiptDate,
        m.CompanyName,
        m.MemberName,
        yps.AmountPaid AS ReceivedAmount,
        yps.ChequeNumber,
        yps.PaymentYear,
        yps.PaymentType
      FROM 
        YearlyPaymentSummary yps
      JOIN 
        Members m ON yps.MembershipID = m.MembershipID
      ORDER BY yps.ReceiptDate DESC
    `);

    const data = result.recordset;

    // Build table body
    const tableBody = [
      [
        "Receipt No.",
        "Date",
        "Company",
        "Member",
        "Received ₹",
        "Cheque No",
        "Year",
        "Type",
      ],
    ];

    data.forEach((row) => {
      tableBody.push([
        row.ReceiptNumber || "-",
        row.ReceiptDate ? new Date(row.ReceiptDate).toLocaleDateString("en-IN") : "-",
        row.CompanyName || "-",
        row.MemberName || "-",
        row.ReceivedAmount ?? "-",
        row.ChequeNumber || "-",
        row.PaymentYear ?? "-",
        row.PaymentType || "-",
      ]);
    });

    // PDF layout with no custom font
    const docDefinition = {
      content: [
        { text: "Yearly Payment Summary Report", style: "header" },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "*", "*", "auto", "auto", "auto", "auto"],
            body: tableBody,
          },
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10],
        },
      },
      pageOrientation: "landscape",
      defaultStyle: { // Optional: Set a default font if you want everything to be Roboto
        font: 'Roboto'
      }
    };

    // Generate PDF and stream it
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=payment-report.pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).send("Error generating PDF report");
  }
});

export default router;
