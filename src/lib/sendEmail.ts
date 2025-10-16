import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail", // or your chosen provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface AccountEmailParams {
  to: string;
  name: string;
  studentName: string;
}

export async function sendAccountReadyEmail({
  to,
  name,
  studentName,
}: AccountEmailParams) {
  const mailOptions = {
    from: `"Dance Hive" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Dance Hive account is ready!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #e11d48;">Welcome to Dance Hive, ${name}!</h2>
        <p>We’re excited to have ${studentName} join our classes.</p>
        <p>Your account has been created and is ready to use.</p>
        <p>To log in, use:</p>
        <ul>
          <li><strong>Email:</strong> ${to}</li>
          <li><strong>Password:</strong> dancehive123</li>
        </ul>
        <p>After logging in, you can change your password anytime from your profile settings.</p>
        <p style="margin-top: 20px;">See you on the dance floor! 💃🕺</p>
        <p>— The Dance Hive Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Account ready email sent to ${to}`);
  } catch (error) {
    console.error("❌ Failed to send account ready email:", error);
    throw error;
  }
}
