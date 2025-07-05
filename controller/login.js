import PdfPrinter from "pdfmake/src/printer.js";
import express from "express";
 import { sql, poolPromise } from "../db.js"; // ✅ Correctly import from your db file

 const router = express.Router();
 export const signup = async (req, res) => {
  const { username, password, email, contactNumber } = req.body;

  try {
    const pool = await poolPromise;

    // Check if email already exists
    const checkUser = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM Users WHERE email = @email");

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    // Insert new user
    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, password)
      .input("email", sql.VarChar, email)
      .input("contactNumber", sql.VarChar, contactNumber)
      .query(
        "INSERT INTO Users (username, password, email, contactNumber) VALUES (@username, @password, @email, @contactNumber)"
      );

    res.status(201).json({ success: true, message: "User registered successfully" });

  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, password)
      .query("SELECT * FROM Users WHERE email = @email AND password = @password");

    if (result.recordset.length > 0) {
      const user = result.recordset[0]; // ✅ fetch user data
      res.json({ 
        success: true, 
        message: "Login successful", 
        username: user.username // ✅ send username to frontend
      });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

