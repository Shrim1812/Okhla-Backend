
import { poolPromise, sql } from '../db.js';

export const getCompany = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT MembershipID, CompanyName FROM Members');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
};


export const getMemberById = async (req, res) => {
    const id = req.params.id;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('MembershipID', sql.Int, id)
            .query(`
                SELECT MembershipID, MemberName, CompanyName, ContactNumber, Email, MemberSince,Category 
                FROM Members 
                WHERE MembershipID = @MembershipID
            `);
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
};


export const addPayment = async (req, res) => {
    const {
        MembershipID,
        PaymentYear,
        AmountPaid,
        DueAmount,
        TotalAmount,
        ReceiptNumber,

        ChequeNumber,
        ChequeReceiveOn,
        BankName,
        PaymentType // ✅ Make sure this is included in the destructuring
    } = req.body;

    try {
        const pool = await poolPromise;

        const query = `
            INSERT INTO YearlyPaymentSummary (
                MembershipID,
                PaymentYear,
                TotalAmount,
                AmountPaid,
                DueAmount,
                ReceiptNumber,
               
                ChequeNumber,
                ChequeReceiveOn,
                BankName,
                PaymentType
            )
            VALUES (
                @MembershipID,
                @PaymentYear,
                @TotalAmount,
                @AmountPaid,
                @DueAmount,
                @ReceiptNumber,
                @ChequeNumber,
                @ChequeReceiveOn,
                @BankName,
                @PaymentType
            )
        `;

        await pool.request()
            .input('MembershipID', sql.Int, MembershipID)
            .input('PaymentYear', sql.VarChar, PaymentYear)
            .input('TotalAmount', sql.Decimal(10, 2), TotalAmount)
            .input('AmountPaid', sql.Decimal(10, 2), AmountPaid)
            .input('DueAmount', sql.Decimal(10, 2), DueAmount)
            .input('ReceiptNumber', sql.VarChar(100), ReceiptNumber)
            // .input('ReceiptDate', sql.Date, ReceiptDate)
            .input('ChequeNumber', sql.VarChar(100), ChequeNumber)
            .input('ChequeReceiveOn', sql.Date, ChequeReceiveOn)
            .input('BankName', sql.VarChar(100), BankName)
            .input('PaymentType', sql.VarChar(50), PaymentType)
            .query(query);

        res.status(200).json({ message: "✅ Payment saved successfully." });

    } catch (err) {
        console.error("❌ Payment insert failed:", err.message);
        res.status(500).json({ error: "Failed to save payment." });
    }
};

export const getReceipts = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
    yps.ReceiptNumber,
    yps.ReceiptDate,
    m.CompanyName,
    yps.ChequeReceiveOn AS DateOfReceiving,
    yps.AmountPaid AS ReceivedAmount,
    yps.TotalAmount,
    yps.DueAmount,
    yps.ChequeNumber,
    yps.BankName,
    yps.PaymentYear,
    yps.PaymentType
FROM 
    YearlyPaymentSummary yps
JOIN 
    Members m ON yps.MembershipID = m.MembershipID
ORDER BY yps.ReceiptDate DESC

        `);

        res.status(200).json(result.recordset);

    } catch (err) {
        console.error("Error fetching receipts:", err.message);
        res.status(500).json({ error: "Failed to fetch receipts" });
    }
};

export const getSummaryByCompanyYear = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                m.CompanyName,
                yps.PaymentYear,
                SUM(yps.TotalAmount) AS TotalAmount,
                SUM(yps.DueAmount) AS DueAmount
            FROM 
                YearlyPaymentSummary yps
            JOIN 
                Members m ON yps.MembershipID = m.MembershipID
            GROUP BY 
                m.CompanyName, yps.PaymentYear
            ORDER BY 
                m.CompanyName, yps.PaymentYear
        `);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching summary:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};




export const addYear = async (req, res) => {
    const { yearRange, payments, registrations } = req.body;

    const {
        Printer,
        Provider,
        MachineDealer,
        Publisher,
        PaperSupplier // ✅ New field from payments
    } = payments;

    const {
        Printer: PrinterRegistration,
        Provider: ProviderRegistration,
        MachineDealer: MachineDealerRegistration,
        Publisher: PublisherRegistration,
        PaperSupplier: PaperSupplierRegistration // ✅ New field from registrations
    } = registrations;
     try {
        const pool = await poolPromise;

        console.log('Received:', yearRange, payments, registrations);

        await pool.request()
            .input('YearRange', sql.VarChar(20), yearRange)
            .input('PrinterPayment', sql.Decimal(10, 2), Printer)
            .input('ProviderPayment', sql.Decimal(10, 2), Provider)
            .input('MachineDealerPayment', sql.Decimal(10, 2), MachineDealer)
            .input('PublisherPayment', sql.Decimal(10, 2), Publisher)
            .input('PaperSupplierPayment', sql.Decimal(10, 2), PaperSupplier) // ✅ Added
            .input('PrinterRegistration', sql.Decimal(10, 2), PrinterRegistration)
            .input('ProviderRegistration', sql.Decimal(10, 2), ProviderRegistration)
            .input('MachineDealerRegistration', sql.Decimal(10, 2), MachineDealerRegistration)
            .input('PublisherRegistration', sql.Decimal(10, 2), PublisherRegistration)
            .input('PaperSupplierRegistration', sql.Decimal(10, 2), PaperSupplierRegistration) // ✅ Added
            .query(`
                INSERT INTO TotalPayments (
                    YearRange,
                    PrinterPayment,
                    ProviderPayment,
                    MachineDealerPayment,
                    PublisherPayment,
                    PaperSupplier, -- ✅ Added
                    PrinterRegistration,
                    ProviderRegistration,
                    MachineDealerRegistration,
                    PublisherRegistration,
                    PaperSupplierRegistration -- ✅ Added
                )
                VALUES (
                    @YearRange,
                    @PrinterPayment,
                    @ProviderPayment,
                    @MachineDealerPayment,
                    @PublisherPayment,
                    @@PaperSupplier, -- ✅ Added
                    @PrinterRegistration,
                    @ProviderRegistration,
                    @MachineDealerRegistration,
                    @PublisherRegistration,
                    @PaperSupplierRegistration -- ✅ Added
                )
            `);

        res.status(200).json({ message: '✅ Yearly payments and registrations saved successfully with Paper Supplier!' });
    } catch (error) {
        console.error('❌ Error adding payments & registrations:', error.stack || error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};



export const getYear = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT YearRange FROM (
                SELECT DISTINCT YearRange
                FROM TotalPayments
            ) AS YearData
            ORDER BY CAST(LEFT(YearRange, 4) AS INT) ASC
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('❌ Error fetching payment years:', error.stack || error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

export const getMemberAndPaymentById = async (req, res) => {
    const memberId = req.params.id;
    const paymentYear = req.params.year;
    console.log(memberId);
    console.log(paymentYear);

    try {
        const pool = await poolPromise;

        // Step 1: Get Member Info
        const memberResult = await pool.request()
            .input('MembershipID', sql.Int, memberId)
            .query(`SELECT * FROM Members WHERE MembershipID = @MembershipID`);

        console.log(memberResult);
        const member = memberResult.recordset[0];

        if (!member) {
            return res.status(404).json({ error: '❌ Member not found' });
        }

        const memberType = member.Category?.trim(); // fix spaces

        // Debug log
        console.log("🔍 MemberType:", memberType);

        // Step 2: Get Payment Summary from YearlyPaymentSummary
        const summaryResult = await pool.request()
            .input('MembershipID', sql.Int, memberId)
            .input('PaymentYear', sql.VarChar, paymentYear)
            .query(`
                SELECT 
                    TotalAmount,
                    AmountPaid,
                    (TotalAmount - AmountPaid) AS DueAmount,
                    ReceiptDate 
                FROM YearlyPaymentSummary 
                WHERE MembershipID = @MembershipID 
                AND PaymentYear = @PaymentYear 
                AND ReceiptDate = (
                    SELECT MAX(ReceiptDate)
                    FROM YearlyPaymentSummary
                    WHERE MembershipID = @MembershipID
                    AND PaymentYear = @PaymentYear
                )
                ORDER BY ReceiptDate DESC
            `);

        let summary = summaryResult.recordset[0];

        // Step 3: If TotalAmount is missing, fetch from TotalPayments
        if (!summary || summary.TotalAmount == null) {
            // Decide column based on MemberType
            let paymentColumn = '';
            switch (memberType) {
                case 'Printer':
                    paymentColumn = 'PrinterPayment';
                    break;
                case 'Provider':
                    paymentColumn = 'ProviderPayment';
                    break;
                case 'MachineDealer':
                    paymentColumn = 'MachineDealerPayment';
                    break;
                case 'Publisher':
                    paymentColumn = 'PublisherPayment';
                    break;
               case 'PaperSupplier':
                     paymentColumn = 'PaperSupplierPayment ';
                     break;

                default:
                    return res.status(400).json({ error: '❌ Unknown Member Type: ' + memberType });
            }

            const totalAmountResult = await pool.request()
                .input('MembershipID', sql.Int, memberId)
                .input('YearRange', sql.VarChar, paymentYear)
                .query(`
                    SELECT ${paymentColumn} AS TotalAmount 
                    FROM TotalPayments
                    WHERE YearRange = @YearRange
                `);

            const totalAmountRow = totalAmountResult.recordset[0];

            if (!summary) {
                summary = {
                    TotalAmount: totalAmountRow?.TotalAmount || null,
                    AmountPaid: 0,
                    DueAmount: totalAmountRow?.TotalAmount || 0,
                    ReceiptDate: null
                };
            } else {
                summary.TotalAmount = totalAmountRow?.TotalAmount || null;
                summary.DueAmount = summary.TotalAmount != null && summary.AmountPaid != null
                    ? summary.TotalAmount - summary.AmountPaid
                    : null;
            }
        }

        // Step 4: Send Final Response
        res.status(200).json({
            ...member,
            TotalAmount: summary?.TotalAmount || null,
            AmountPaid: summary?.AmountPaid || 0,
            DueAmount: summary?.DueAmount || 0
        });

    } catch (error) {
        console.error("❌ Error in getMemberAndPaymentById:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



export const getAllOtherPayments = async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT * FROM OtherPayments ORDER BY MembershipID ASC
        `);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("❌ Error fetching OtherPayments:", error.stack || error);
        res.status(500).json({ error: "Failed to fetch OtherPayments" });
    }
};


export const getYearlySummary = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT
                MembershipID,
                PaymentYear,
                SUM(TotalAmount) AS TotalAmountSum,
                SUM(AmountPaid) AS TotalAmountPaid,
                SUM(DueAmount) AS TotalDueAmount
            FROM
                YearlyPaymentSummary
            GROUP BY
                MembershipID, PaymentYear
            ORDER BY
                MembershipID, PaymentYear
        `);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Error fetching yearly summary:", err.message);
        res.status(500).json({ error: "Failed to fetch yearly summary" });
    }
};



export const getRegistrationFee = async (req, res) => {
    const memberId = parseInt(req.params.id);

    if (isNaN(memberId)) {
        return res.status(400).json({ error: "Invalid MembershipID" });
    }

    try {
        const pool = await poolPromise;

        // ⿡ Step 1: “Members” table se us member ki Category nikaalo
        const memberResult = await pool.request()
            .input('MembershipID', sql.Int, memberId)
            .query(`
        SELECT Category
        FROM Members
        WHERE MembershipID = @MembershipID
      `);

        if (!memberResult.recordset[0]) {
            return res.status(404).json({ error: "Member not found" });
        }
        const category = memberResult.recordset[0].Category?.trim();
        if (!category) {
            return res.status(400).json({ error: "Member has no category assigned" });
        }

        // ⿢ Step 2: Category ke hisaab se “TotalPayments” me se column decide karo
        let regFeeColumn = "";
        switch (category) {
            case 'Printer':
                regFeeColumn = 'PrinterRegistration';
                break;
            case 'Provider':
                regFeeColumn = 'ProviderRegistration';
                break;
            case 'Machine Dealer':
            case 'MachineDealer':
            case 'MachineDealers': // agar aapki Category me space/hyphen variation ho
                regFeeColumn = 'MachineDealerRegistration';
                break;
            case 'Publisher':
                regFeeColumn = 'PublisherRegistration';
                break;
            case 'PaperSupplier':
            regFeeColumn = 'PaperSupplierRegistration';
                break;

            default:
                return res.status(400).json({ error: `Unknown category: ${category}` });
        }
            console.log("🔍 Category:", category);
             console.log("🧾 Column selected:", regFeeColumn);
            
      
        const feeResult = await pool.request()
            .query(`
        SELECT TOP 1 
          ${regFeeColumn} AS RegistrationFee,YearRange
        FROM TotalPayments
        WHERE ${regFeeColumn} IS NOT NULL
        ORDER BY 
          CAST(LEFT(YearRange, 4) AS INT) DESC
      `);
    //    console.log(yearRange);
        const feeRow = feeResult.recordset[0];
        if (!feeRow || feeRow.RegistrationFee == null) {
            return res.status(404).json({ error: "Registration fee not found for this category" });
        }

        // ⿤ Step 4: Final JSON response bhejo
        return res.status(200).json({
            success: true,
            registrationFee: feeRow.RegistrationFee
        });

    } catch (err) {
        console.error("Error in getRegistrationFee:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};



export const getMemberAndPaymentSummaryById = async (req, res) => {
    const { id, year } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('MembershipID', sql.Int, id)
            .input('PaymentYear', sql.VarChar, year)
            .query(`
                SELECT m.MembershipID, m.MemberName, m.CompanyName, m.Category, 
                       p.TotalAmount, p.AmountPaid, p.DueAmount
                FROM Members m
                LEFT JOIN YearlyPaymentSummary p
                ON m.MembershipID = p.MembershipID 
                   AND LTRIM(RTRIM(p.PaymentYear)) = LTRIM(RTRIM(@PaymentYear))
                WHERE m.MembershipID = @MembershipID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "No data found." });
        }

        const row = result.recordset[0];
        res.json({ success: true, ...row });

    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
}
};





export const ExtraDetail = async (req, res) => {
    try {
        const {
            MembershipID,
            CompanyName,
            PaymentYear,
            ReceiptNumber,
            ChequeNumber,
            ChequeReceiveOn,
            BankName,
            PaymentMode,
            PaymentCategory,
            Remark,
            Amount: CustomAmount // ⭐ Custom amount from frontend
        } = req.body;

        const pool = await poolPromise;

        // 🔍 Step 1: Get Member's Category
        const memberResult = await pool.request()
            .input('MembershipID', sql.Int, MembershipID)
            .query(`
                SELECT Category FROM Members WHERE MembershipID = @MembershipID
            `);

        if (!memberResult.recordset[0]) {
            return res.status(404).json({ error: "❌ Member not found" });
        }

        const category = memberResult.recordset[0].Category?.trim();
        if (!category) {
            return res.status(400).json({ error: "❌ Member has no category assigned" });
        }

        let Amount;

        if (PaymentCategory === 'Registration') {
            // 🧠 Step 2: Determine Column Name from Category
            let regFeeColumn = "";
            switch (category) {
                case 'Printer': regFeeColumn = 'PrinterRegistration'; break;
                case 'Provider': regFeeColumn = 'ProviderRegistration'; break;
                case 'Machine Dealer':
                case 'MachineDealer':
                case 'MachineDealers':
                    regFeeColumn = 'MachineDealerRegistration'; break;
                case 'Publisher': regFeeColumn = 'PublisherRegistration'; break;
                case 'PaperSupplier':
                 regFeeColumn = 'PaperSupplierRegistration';
                  break;

                default:
                    return res.status(400).json({ error: `❌ Unknown category: ${category}` });
            }

            // 🧾 Step 3: Get Fee from TotalPayments table
            const feeResult = await pool.request()
                .query(`
                    SELECT TOP 1 ${regFeeColumn} AS RegistrationFee
                    FROM TotalPayments
                    WHERE ${regFeeColumn} IS NOT NULL
                    ORDER BY CAST(LEFT(YearRange, 4) AS INT) DESC
                `);

            const feeRow = feeResult.recordset[0];
            if (!feeRow || feeRow.RegistrationFee == null) {
                return res.status(404).json({ error: "❌ Registration fee not found for this category" });
            }

            Amount = feeRow.RegistrationFee; // ✅ Use from DB
        } else {
            // ✅ For 'Other', use custom amount from frontend
            Amount = parseFloat(CustomAmount);
            if (isNaN(Amount) || Amount <= 0) {
                return res.status(400).json({ error: "❌ Invalid amount provided for Other payment" });
            }
        }

        // 📝 Step 4: Insert into OtherPayments
        await pool.request()
            .input('MembershipID', sql.Int, MembershipID)
            .input('CompanyName', sql.VarChar(100), CompanyName)
            .input('PaymentYear', sql.VarChar(20), PaymentYear)
            .input('Amount', sql.Decimal(18, 2), Amount)
            .input('ReceiptNumber', sql.VarChar(50), ReceiptNumber || null)
            .input('ChequeNumber', sql.VarChar(50), ChequeNumber || null)
            .input('ChequeReceiveOn', sql.Date, ChequeReceiveOn ? new Date(ChequeReceiveOn) : null)
            .input('BankName', sql.VarChar(100), BankName || null)
            .input('PaymentMode', sql.VarChar(50), PaymentMode)
            .input('PaymentCategory', sql.VarChar(50), PaymentCategory)
            .input('Remark', sql.VarChar(250), Remark || null)
            .query(`
                INSERT INTO OtherPayments 
                (MembershipID, CompanyName, PaymentYear, Amount, ReceiptNumber, ChequeNumber, ChequeReceiveOn, BankName, PaymentMode, PaymentCategory, Remark)
                VALUES 
                (@MembershipID, @CompanyName, @PaymentYear, @Amount, @ReceiptNumber, @ChequeNumber, @ChequeReceiveOn, @BankName, @PaymentMode, @PaymentCategory, @Remark)
            `);

        res.status(200).json({
            message: "✅ Other Payment saved successfully",
            amountUsed: Amount
        });

    } catch (error) {
        console.error("❌ Error in ExtraDetail:", error.stack || error);
        res.status(500).json({ error: "❌ Something went wrong while saving Other Payment" });
    }
};
