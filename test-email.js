// CREATE A NEW FILE: backend/test-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');

const testEmail = async () => {
  try {
    console.log('Testing email configuration...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set (hidden)' : 'NOT SET!');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ Email server connection successful!');

    // Send test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Matt-Kenn Test Email',
      html: '<h1>Email configuration is working! 🎉</h1>'
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);

  } catch (error) {
    console.error('❌ Email configuration error:');
    console.error(error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n🔧 SOLUTION: Check your Gmail App Password:');
      console.log('1. Make sure 2FA is enabled on your Gmail account');
      console.log('2. Generate a new App Password (16 characters)');
      console.log('3. Use the App Password, not your regular Gmail password');
    }
  }
};

testEmail();