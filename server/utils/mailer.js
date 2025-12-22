import nodemailer from "nodemailer";

export const sendAdminPasswordMail = async ({ to, password, role }) => {
  if (!process.env.SMTP_HOST) {
    console.warn("SMTP not configured. Skipping email.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true", // true=465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subject = "Your Attendance Admin Password Has Been Updated";

  const html = `
    <div style="font-family:Arial,sans-serif; line-height:1.5">
      <h2>Password Updated</h2>
      <p>Hello,</p>
      <p>Your login password for Attendance Admin has been updated by Super Admin.</p>
      <p><b>Role:</b> ${role}</p>
      <p><b>New Password:</b> <span style="font-size:16px">${password}</span></p>
      <p>Please login and change it if required.</p>
      <br/>
      <p>Thanks</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
};
