// import env from '@/env';
// import nodemailer from 'nodemailer';
//
// // Create a transporter using SMTP credentials
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: env.GMAIL_USER, // Your Gmail address
//     pass: env.GMAIL_APP_PASSWORD, // Your Gmail app password
//   },
// });
//
// /**
//  * Send an email using Gmail SMTP
//  * @param to - Recipient email address
//  * @param subject - Subject of the email
//  * @param text - Plain text content
//  */
// export async function sendEmail(to: string, subject: string, text: string) {
//   const mailOptions = {
//     from: env.GMAIL_USER, // Sender email address
//     to,
//     subject,
//     text,
//   };
//
//   try {
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Email sent:', info.response);
//   } catch (error) {
//     console.error('Error sending email:', error);
//   }
// }
