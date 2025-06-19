import { poolPromise, sql } from "../db.js";
import sendMail from "../Utils/SendMail.js";
import bcrypt from "bcryptjs";
export const sendOTP = async (req, res) => {
    const { email } = req.body;
    console.log(email);
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    console.log(otp);
    try {
        const pool = await poolPromise;
        // Check if email exists
        const result = await pool.request()
            .input("Email", sql.NVarChar, email)
            .query("SELECT * FROM Users1 WHERE Email = @Email");
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Email not found" });
        }
        // Save OTP in OTP_Verification table
        await pool.request()
            .input("Email", sql.NVarChar, email)
            .input("OTP", sql.NVarChar, otp)
            .input("Expiry", sql.DateTime, expiry)
            .query(`
                INSERT INTO OTP_Verification (Email, OTP, Expiry)
                VALUES (@Email, @OTP, @Expiry)
            `);
        // :outbox_tray: Send OTP via email
        const message = `Dear User,\n\nYour OTP for password reset is: ${otp}\nThis OTP is valid for 10 minutes.\n\nThanks,\nIndus Team`;
        await sendMail(email, "Samarpan - Password Reset OTP", message);
        res.json({ success: true, message: "OTP sent to your email." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};
export const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ success: false, message: "New password does not meet criteria" });
    }
    try {
        const pool = await poolPromise;
        // Check if OTP was verified
        const otpCheck = await pool.request()
            .input("Email", sql.NVarChar, email)
            .query("SELECT * FROM OTP_Verification WHERE Email = @Email AND Verified = 1");
        if (otpCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: "OTP not verified" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password
        await pool.request()
            .input("Email", sql.NVarChar, email)
            .input("Password", sql.NVarChar, hashedPassword)
            .query(`
                UPDATE Users1 SET Password = @Password WHERE Email = @Email
            `);
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
export const verifyOTP = async (req, res) => {
    const { email, otp } = req.body; // :white_check_mark: Now includes email
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("Email", sql.NVarChar, email)
            .input("OTP", sql.NVarChar, otp)
            .query(`
                SELECT * FROM OTP_Verification
                WHERE Email = @Email AND OTP = @OTP AND Verified = 0
            `);
        if (result.recordset.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }
        const record = result.recordset[0];
        const now = new Date();
        if (now > record.Expiry) {
            return res.status(400).json({ success: false, message: "OTP has expired" });
        }
        // :white_check_mark: Mark OTP as verified
        await pool.request()
            .input("Email", sql.NVarChar, email)
            .input("OTP", sql.NVarChar, otp)
            .query(`
                UPDATE OTP_Verification SET Verified = 1
                WHERE OTP = @OTP AND Email = @Email
            `);
        res.json({ success: true, message: "OTP verified successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
