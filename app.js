// app.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { poolPromise } from "./db.js"; // Assuming db.js is at the same level as app.js
import MemberRouter from "./Router/MemberForm.js"; // Adjust path if Router is not directly under app.js
// IMPORTANT: Import the configured 'printer' from receipt.js
// receiptRoutes is imported as default, printer is a named export.
import receiptRoutes, { printer } from './controller/receipt.js';

const app = express();

// If receiptRoutes contains other routes, mount them here.
// For example, if receipt.js handles "/receipt/some-other-endpoint"
app.use('/receipt', receiptRoutes);

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// CORS configuration
const corsOptions = {
  origin: 'https://www.oppa.co.in', // Your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

// Mount the MemberRouter
app.use("/Ohkla", MemberRouter);

// PDF generation route
// This route now uses the 'printer' instance imported from controller/receipt.js
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
          yps.PaymentType
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

    const docDefinition = {
      content: [
        { text: "Receipt", style: "header" },
        { text: `Receipt No: ${data.ReceiptNumber}` },
        { text: `Date: ${new Date(data.ReceiptDate).toLocaleDateString("en-IN")}` },
        { text: `Company: ${data.CompanyName}` },
        { text: `Member: ${data.MemberName}` },
        { text: `Amount Received: ₹${data.ReceivedAmount}` },
        { text: `Payment Type: ${data.PaymentType}` },
        { text: `Cheque No: ${data.ChequeNumber || "-"}` }, // Display "-" if ChequeNumber is null
        { text: `Cheque Receive On: ${data.ChequeReceiveOn ? new Date(data.ChequeReceiveOn).toLocaleDateString("en-IN") : "-"}` }, // Display "-" if ChequeReceiveOn is null
      ],
      styles: {
        header: {
          fontSize: 20,
          // If you uncomment bold, ensure 'Roboto-Medium.ttf' is mapped to 'bold' in receipt.js
          // bold: true,
          margin: [0, 0, 0, 15],
          font: 'Roboto' // Explicitly set Roboto for this style
        },
      },
      // IMPORTANT: Ensure a default font is set for all text in the PDF
      defaultStyle: {
        font: 'Roboto'
      }
    };

    // Create the PDF document using the imported and configured 'printer' instance
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set headers for PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=Receipt_${data.ReceiptNumber}.pdf`);

    // Pipe the PDF document to the response stream
    pdfDoc.pipe(res);
    // End the PDF document generation
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
