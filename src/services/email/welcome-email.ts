import { sendEmail } from "./email.service";

type WelcomeEmailInput = {
  organizationId: string;
  name: string;
  email: string;
  employeeCode: string;
  temporaryPassword: string;
  designation?: string | null;
};

/**
 * Sent once, right after a person is created with an auto-generated
 * password — this is the only automated way credentials reach a new
 * employee, since the admin's UI only shows the temporary password one
 * time. If email isn't configured, sendEmail() logs it instead of
 * throwing, so account creation is never blocked by this.
 */
export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
    : "/login";

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">Welcome to OPDesk, ${escapeHtml(input.name)}</h2>
      <p style="color: #667085; margin-top: 0;">Bharat Infotechs — Workforce Operations</p>
      ${input.designation ? `<p>You've been added as <strong>${escapeHtml(input.designation)}</strong>.</p>` : ""}
      <p>Here are your login credentials — sign in with either your email or your employee ID:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #667085;">Email</td><td style="padding: 8px 0; font-family: monospace;">${escapeHtml(input.email)}</td></tr>
        <tr><td style="padding: 8px 0; color: #667085;">Employee ID</td><td style="padding: 8px 0; font-family: monospace;">${escapeHtml(input.employeeCode)}</td></tr>
        <tr><td style="padding: 8px 0; color: #667085;">Temporary password</td><td style="padding: 8px 0; font-family: monospace; font-weight: bold;">${escapeHtml(input.temporaryPassword)}</td></tr>
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #111827; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none;">
          Sign in to OPDesk
        </a>
      </p>
      <p style="color: #667085; font-size: 13px;">
        For security, please sign in and change this password under Settings → Security as soon as possible.
      </p>
    </div>
  `.trim();

  return sendEmail({
    to: input.email,
    subject: "Welcome to OPDesk — your login details",
    html,
    type: "WELCOME",
    organizationId: input.organizationId,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
