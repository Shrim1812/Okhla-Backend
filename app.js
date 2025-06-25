// app.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import PdfPrinter from "pdfmake";
import { poolPromise } from "./db.js";
import MemberRouter from "./Router/MemberForm.js"; // ✅ Login route

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Fonts for PDF
const fonts = {
  Roboto: {
    normal: path.join(__dirname, "Fonts", "Roboto-Regular.ttf"),
    bold: path.join(__dirname, "Fonts", "Roboto-Medium.ttf"),
    italics: path.join(__dirname, "Fonts", "Roboto-Italic.ttf"),
    bolditalics: path.join(__dirname, "Fonts", "Roboto-MediumItalic.ttf"),
  },
};
const printer = new PdfPrinter(fonts);

// ✅ Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: [
    "https://www.oppa.co.in",
    "http://localhost:3000"
  ],
  credentials: true
}));

// ✅ Login route
app.use("/Ohkla", MemberRouter);

// ✅ PDF route
app.get("/Ohkla/report/receipt", async (req, res) => {
  try {
    const { receiptNo } = req.query;
    if (!receiptNo) return res.status(400).send("Missing receiptNo in query");

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
          yps.PaymentType
        FROM 
          YearlyPaymentSummary yps
        JOIN 
          Members m ON yps.MembershipID = m.MembershipID
        WHERE 
          yps.ReceiptNumber = @receiptNo
      `);

    if (result.recordset.length === 0) {
      return res.status(404).send("Receipt not found");
    }

    const data = result.recordset[0];

    const docDefinition = {
      content: [
        { text: "Receipt", style: "header" },
        { text: `Receipt No: ${data.ReceiptNumber}` },
        { text: `Date: ${new Date(data.ReceiptDate).toLocaleDateString("en-IN")}` },
        { text: `Company: ${data.CompanyName}` },
        { text: `Member: ${data.MemberName}` },
        { text: `Amount Received: ₹${data.ReceivedAmount}` },
        { text: `Payment Type: ${data.PaymentType}` },
        { text: `Cheque No: ${data.ChequeNumber || "-"}` },
        { text: `Cheque Receive On: ${data.ChequeReceiveOn ? new Date(data.ChequeReceiveOn).toLocaleDateString("en-IN") : "-"}` },
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          margin: [0, 0, 0, 15],
        },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Receipt_${data.ReceiptNumber}.pdf`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).send("Failed to generate PDF");
  }
});

// ✅ Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
