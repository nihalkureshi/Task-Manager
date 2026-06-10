import nodemailer from "nodemailer";

const EMAIL_USER = (process.env.EMAIL_USER || "").trim();
const EMAIL_PASSWORD = (process.env.EMAIL_PASSWORD || "").replace(/\s/g, "");
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || "587");
const APP_NAME = process.env.APP_NAME || "HairDrama Task Manager";

export async function sendEmail(
  toEmail: string,
  subject: string,
  body: string,
  details: Record<string, string> = {}
): Promise<boolean> {
  if (!toEmail) return false;
  if (!EMAIL_USER || !EMAIL_PASSWORD) return false;
  if (SMTP_HOST === "smtp.gmail.com" && EMAIL_PASSWORD.length !== 16) return false;

  const detailRows = Object.entries(details)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;vertical-align:top;">${label}</td>` +
        `<td style="padding:8px 12px;color:#111827;">${value}</td></tr>`
    )
    .join("");

  const htmlBody = `
    <html>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#111827;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                    ${APP_NAME}
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">${subject}</h2>
                    <p style="margin:0 0 20px;color:#4b5563;line-height:1.6;">${body}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                      ${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const plainLines = [body, "", ...Object.entries(details).map(([k, v]) => `${k}: ${v}`)];

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_USER}>`,
      to: toEmail,
      replyTo: EMAIL_USER,
      subject: `[${APP_NAME}] ${subject}`,
      text: plainLines.join("\n"),
      html: htmlBody,
    });
    return true;
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    return false;
  }
}
