// controller/receipt.js
import express from "express";
import fs from "fs"; // Required for checking file existence and listing directory contents
import path from "path"; // Required for path manipulation
import { fileURLToPath } from "url"; // Required to get __filename in ES Modules
import PdfPrinter from "pdfmake"; // Import PdfPrinter

// Assuming db.js is located one directory up from 'controller' (e.g., /opt/render/project/src/db.js)
import { poolPromise } from "../db.js";

// Resolve __filename and __dirname for the current ES Module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- START DEBUGGING LOGS ---
// These logs are critical for confirming the font paths on Render startup.
// Please look for these lines in your Render logs after deployment.
console.log('DEBUG: Current __filename (in controller/receipt.js):', __filename);
console.log('DEBUG: Current __dirname (in controller/receipt.js):', __dirname);

// Calculate the path to your Fonts directory.
// From __dirname (/opt/render/project/src/controller), go up one level (..) to /opt/render/project/src/,
// then go into the 'Fonts' directory.
const fontsPath = path.join(__dirname, '..', 'Fonts');

console.log('DEBUG: Calculated fontsPath (in controller/receipt.js):', fontsPath);

try {
    const isFontsPathDirectory = fs.existsSync(fontsPath) && fs.lstatSync(fontsPath).isDirectory();
    console.log(`DEBUG: Is '${fontsPath}' a directory?`, isFontsPathDirectory);

    if (isFontsPathDirectory) {
        const filesInFontsDir = fs.readdirSync(fontsPath);
        console.log('DEBUG: Files found in fonts directory:', filesInFontsDir);

        // List the font files pdfmake expects based on your configuration
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
    console.error('DEBUG: !!! CRITICAL: Error accessing fonts directory in debug block:', err.message);
}
// --- END DEBUGGING LOGS ---


// Configure your fonts. This configuration is used for the SINGLE PdfPrinter instance.
const fonts = {
  Roboto: {
    normal: path.join(fontsPath, 'Roboto-Regular.ttf'),
    bold: path.join(fontsPath, 'Roboto-Medium.ttf'), // Assumes Roboto-Medium.ttf for 'bold' style
    italics: path.join(fontsPath, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsPath, 'Roboto-MediumItalic.ttf') // Assumes Roboto-MediumItalic.ttf for 'bolditalics'
  }
  // Add other fonts here if you use them, e.g.,
  // OpenSans: {
  //   normal: path.join(fontsPath, 'OpenSans-Regular.ttf'),
  //   bold: path.join(fontsPath, 'OpenSans-Bold.ttf'),
  //   italics: path.join(fontsPath, 'OpenSans-Italic.ttf'),
  //   bolditalics: path.join(fontsPath, 'OpenSans-BoldItalic.ttf')
  // }
};

// Create the SINGLE PdfPrinter instance with your font configuration
const printer = new PdfPrinter(fonts);

// Create an Express Router instance. This is the default export if this file contains specific routes.
const router = express.Router();

// You can define other routes specific to 'receipts' here if your application has them.
// Example:
/*
router.post("/process-new-receipt", async (req, res) => {
    try {
        // ... logic for processing a new receipt ...
        // You can use the 'printer' defined above if this route also generates PDFs
        // const newDocDefinition = { content: 'Some new receipt' };
        // const newPdfDoc = printer.createPdfKitDocument(newDocDefinition);
        // ...
        res.status(200).send("New receipt processed.");
    } catch (err) {
        console.error("Error processing new receipt:", err);
        res.status(500).send("Failed to process new receipt.");
    }
});
*/

// Export the router as the default export AND the configured printer as a named export.
// This allows app.js to import both: `import receiptRoutes, { printer } from './controller/receipt.js';`
export { router as default, printer };
