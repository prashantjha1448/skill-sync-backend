const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Transporter create karein (Email server connection)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  // 2. Email ke options define karein
  const mailOptions = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html: options.html // Aap chahein toh khoobsurat HTML emails bhi bhej sakte hain
  };

  // 3. Email bhej dein
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;