const nodemailer = require('nodemailer');

// Manually set environment variables for testing
process.env.SMTP_HOST = 'smtp.gmail.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'ahmedmahmoudtech@gmail.com';
process.env.SMTP_PASS = 'zzwbzzhfyfffret';
process.env.DEFAULT_FROM_EMAIL = 'ahmedmahmoudtech@gmail.com';

console.log('Testing Gmail SMTP configuration...');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'CONFIGURED' : 'NOT SET');
console.log('SMTP_PORT:', process.env.SMTP_PORT);

async function testEmailConnection() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.DEFAULT_FROM_EMAIL,
      to: 'ahmed.mahmoud@roaa.tech',
      subject: 'Test Email',
      text: 'This is a test email to verify Gmail SMTP configuration.',
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Error code:', error.code);
    console.log('Error response:', error.response);
  }
}

testEmailConnection();
