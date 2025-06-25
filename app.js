// app.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { poolPromise } from "./db.js";
import MemberRouter from "./Router/MemberForm.js"; // ✅ Login route
import receiptRoutes from './controller/receipt.js';
import PdfPrinter from "pdfmake";

const app = express();
app.use('/receipt', receiptRoutes);

// ✅ No custom fonts (pdfmake uses built-in fonts)
const printer = new PdfPrinter({}); // No fonts object

// ✅ Middleware
app.use(bodyParser.json());

const corsOptions = {
  origin: 'https://www.oppa.co.in',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

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
          //bold: true,
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
