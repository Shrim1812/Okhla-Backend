
import express from 'express';
import { createNewMember, getAllMembers, updateMember } from '../controller/NewMemberForm.js';
import { getCompany, getMemberById, addPayment, getReceipts, getRegistrationFee, getSummaryByCompanyYear, ExtraDetail, getMemberAndPaymentSummaryById, getAllOtherPayments, getMemberAndPaymentById, addYear, getYear, getYearlySummary } from '../controller/PaymentSummary.js';

//import { ReceipPDF } from '../controller/receipt.js'
import { getAnnualPayments, insertAnnualPayments, addNewYearAndInsertForAllMember, getYearRange, updateAnnualPayment, ReceiptOfPayment, getReceiptOfPayment, YearlyPaymentList } from '../controller/AnnualTable.js';
import { getCompanies, getYears, getDashboardData, getDashboardMultiYearData, getOtherPayments } from '../controller/Deshboard.js';
import { importExcelToDB } from "../helper/ImportExcelToDB.js";



import { loginUser, createUser, getRoleByEmail, getAllUsers, updateUserByAdmin, changePassword, OtherPaymentsD} from '../controller/Admin.js';
import { sendOTP, verifyOTP, resetPassword } from '../controller/OTPSend.js';
import { getMemberEmailByReceiptNumber,sendEmailWithReceipt} from '../controller/EmailController.js'																									

import multer from 'multer';

const router = express.Router();

router.post("/Member", createNewMember);
router.get('/getMember', getAllMembers);
router.put('/updateMember/:id', updateMember);

router.get("/getCompany", getCompany);
router.get("/getMemberById/:id", getMemberById);
router.post("/addPayment", addPayment);
router.get("/getReceipts", getReceipts);


//router.get("/receipt-pdf", ReceipPDF);
router.get("/DuePayment", getSummaryByCompanyYear);
router.get('/getMemberAndPaymentSummaryById/:id/:year', getMemberAndPaymentById);
router.post('/addYear', addYear);
router.get('/getYear', getYear);
router.post('/ExtraDetail', ExtraDetail);
router.get('/getAllOtherPayments', getAllOtherPayments);
router.get('/getYearlySummary', getYearlySummary);
router.get('/getAnnualPayments', getAnnualPayments);
router.post('/insertAnnualPayments', insertAnnualPayments);
router.get('/getYearRange', getYearRange);
router.put('/updateAnnualPayment', updateAnnualPayment);
router.post('/ReceiptOfPayment', ReceiptOfPayment);
router.get('/getReceiptOfPayment', getReceiptOfPayment);
router.get('/getRegistrationFee/:id', getRegistrationFee);
router.get('/YearlyPaymentList', YearlyPaymentList);
router.post('/addNewYearAndInsertForAllMember', addNewYearAndInsertForAllMember);
router.get('/companies', getCompanies);
router.get('/payment-years', getYears);
router.post('/dashboard-data', getDashboardData);
router.post('/dashboard-multiyear', getDashboardMultiYearData);
router.get('/other-payments', getOtherPayments)

router.get('/payment-years', getYears);
router.post('/dashboard-data', getDashboardData);
router.post('/dashboard-multiyear', getDashboardMultiYearData);
router.get('/other-payments', getOtherPayments)

// router.get('/getMemberAndPaymentSummaryById/:id/:year', getMemberAndPaymentSummaryById)
// router.get('/getMemberAndPaymentSummaryById/:id/:year', getMemberAndPaymentSummaryById);
router.post('/login', loginUser);
router.post('/createUser', createUser);
router.post('/send-otp', sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.get("/getRoleByEmail", getRoleByEmail);
router.get("/getAllUsers", getAllUsers);
router.post("/updateUserByAdmin", updateUserByAdmin);
router.post("/changePassword", changePassword);
router.get("/getothersPayment",OtherPaymentsD);
router.get("/get-member-email/:receiptNo", getMemberEmailByReceiptNumber);
router.post("/send", sendEmailWithReceipt);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/upload-members-excel', upload.single('excelFile'), async (req, res) => {
    const result = await importExcelToDB(req.file.path);

    if (result.success) {
        res.status(200).json({ message: result.message });
    } else {
        res.status(500).json({ message: result.message, error: result.error });
    }
});


export default router;
