// Import modules
import express from "express";
import cors from "cors";
import PdfPrinter from "pdfmake";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { poolPromise } from "./db.js"; // adjust path if needed
import receiptRoutes from "./controller/receipt.js"; // ✅ Corrected path
import bodyParser from "body-parser";


const app = express();
const allowedOrigins = [
  "https://www.oppa.co.in", // ✅ your production frontend
  "http://localhost:3000"   // optional: local testing
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Font setup for pdfmake
const fonts = {
  Roboto: {
    normal: path.join(__dirname, "..", "Fonts", "Roboto-Regular.ttf"),
    bold: path.join(__dirname, "..", "Fonts", "Roboto-Medium.ttf"),
    italics: path.join(__dirname, "..", "Fonts", "Roboto-Italic.ttf"),
    bolditalics: path.join(__dirname, "..", "Fonts", "Roboto-MediumItalic.ttf"),
  },
};

const printer = new PdfPrinter(fonts);

// GET receipt PDF by receipt number
router.get("/Ohkla/report/receipt", async (req, res) => {
  try {
    const { receiptNo } = req.query;

    if (!receiptNo) {
      return res.status(400).send("Missing receiptNo in query");
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
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

// Middleware
app.use(bodyParser.json());

// Routes
app.use(receiptRoutes);

// ✅ Required by Render.com
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

export default router;
