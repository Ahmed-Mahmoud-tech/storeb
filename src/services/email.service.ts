import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private fromEmail: string = '';

  constructor() {
    this.initializeResend();
  }

  private initializeResend() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.DEFAULT_FROM_EMAIL || 'contact@layq.store';

    if (!apiKey) {
      this.logger.warn(
        '⚠️ RESEND_API_KEY is not configured, email sending will be mocked'
      );
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.logger.log('✅ Resend email service initialized successfully');
      this.logger.log(`📧 Sending from: Layq <${this.fromEmail}>`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Resend service');
      this.logger.error(error);
    }
  }

  async sendVerificationEmail(
    email: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${process.env.CLIENT_BASE_URL}/verify-email?token=${verificationToken}`;

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: `Layq <${this.fromEmail}>`,
          to: email,
          subject: 'Verify your email address',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Email Verification</h2>
              <p>Hello,</p>
              <p>Thank you for registering! Please click the button below to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #007bff; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              <p>If you didn't create an account, please ignore this email.</p>
              <p>Best regards,<br>Your Store Team</p>
            </div>
          `,
        });

        this.logger.log(`📧 Sending REAL verification email to: ${email}`);
        this.logger.log(
          `✅ REAL verification email sent successfully to ${email}`
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to send real email to ${email}, falling back to mock:`
        );
        this.logger.error(
          `❌ Resend Error Details:`,
          error instanceof Error ? error.message : error
        );
        this.sendMockVerificationEmail(email, verificationUrl);
      }
    } else {
      // Send mock email
      this.sendMockVerificationEmail(email, verificationUrl);
    }
  }

  private sendMockVerificationEmail(email: string, verificationUrl: string) {
    this.logger.log(`📧 MOCK EMAIL SENT`);
    this.logger.log(`From: Layq <${this.fromEmail}>`);
    this.logger.log(`To: ${email}`);
    this.logger.log(`Subject: Verify your email address`);
    this.logger.log(`Verification URL: ${verificationUrl}`);
    this.logger.log(
      `✅ Mock verification email "sent" successfully to ${email}`
    );
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${process.env.CLIENT_BASE_URL}/reset-password?token=${resetToken}`;

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: `Layq <${this.fromEmail}>`,
          to: email,
          subject: 'Reset your password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Reset</h2>
              <p>Hello,</p>
              <p>You requested a password reset. Please click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>This link will expire in 1 hour.</p>
              <p>Best regards,<br>Your Store Team</p>
            </div>
          `,
        });

        this.logger.log(`📧 Sending REAL password reset email to: ${email}`);
        this.logger.log(
          `✅ REAL password reset email sent successfully to ${email}`
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to send real email to ${email}, falling back to mock:`
        );
        this.logger.error(
          `❌ Resend Error Details:`,
          error instanceof Error ? error.message : error
        );
        this.sendMockPasswordResetEmail(email, resetUrl);
      }
    } else {
      // Send mock email
      this.sendMockPasswordResetEmail(email, resetUrl);
    }
  }

  private sendMockPasswordResetEmail(email: string, resetUrl: string) {
    this.logger.log(`📧 MOCK PASSWORD RESET EMAIL SENT`);
    this.logger.log(`From: Layq <${this.fromEmail}>`);
    this.logger.log(`To: ${email}`);
    this.logger.log(`Subject: Reset your password`);
    this.logger.log(`Reset URL: ${resetUrl}`);
    this.logger.log(
      `✅ Mock password reset email "sent" successfully to ${email}`
    );
  }
}
