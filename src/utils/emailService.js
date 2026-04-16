const { Resend } = require("resend");
const crypto = require("crypto");
const log = require("./logger");
require("dotenv").config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "VendBoost <onboarding@resend.dev>";

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.BASE_URL}/auth/verify/${token}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Verify Your Email</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="color: #374151; font-size: 16px;">Thank you for signing up with VendBoost! Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #10b981; word-break: break-all; font-size: 13px;">${verificationUrl}</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  try {
    if (!process.env.RESEND_API_KEY) {
      log.warn("RESEND API KEY NOT SET - using dev mode");
      log.info(`Verification link: ${verificationUrl}`);
      return false;
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify Your VendBoost Account",
      html: htmlContent,
    });

    log.info(`Verification email sent to ${email} - ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    log.error("Resend error sending verification email:", error.message);
    return false;
  }
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.BASE_URL}/auth/reset-password/${token}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Reset Your Password</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="color: #374151; font-size: 16px;">We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #ef4444; word-break: break-all; font-size: 13px;">${resetUrl}</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  try {
    if (!process.env.RESEND_API_KEY) {
      log.warn("RESEND API KEY NOT SET - using dev mode");
      log.info(`Reset link: ${resetUrl}`);
      return false;
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset Your VendBoost Password",
      html: htmlContent,
    });

    log.info(`Password reset email sent to ${email} - ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    log.error("Resend error sending password reset email:", error.message);
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  generateToken,
};
