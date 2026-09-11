import "server-only";

import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  type: string;
  organizationId?: string;
};

function isEmailConfigured() {
  return Boolean(
    process.env.EMAIL_HOST &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD
  );
}

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = getTransporter();

  /*
   * OPDesk must continue working even when
   * email has not been configured.
   */
  if (!transporter) {
    console.log(
      `[OPDesk Email] Not configured. Would send "${input.subject}" to ${input.to}`
    );

    return {
      ok: false,
      status: "NOT_CONFIGURED" as const,
    };
  }

  try {
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        "OPDesk <no-reply@example.com>",

      to: input.to,

      subject: input.subject,

      html: input.html,
    });

    console.log(
      `[OPDesk Email] Sent ${input.type} to ${input.to}. Message ID: ${info.messageId}`
    );

    return {
      ok: true,
      status: "SENT" as const,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("[OPDesk Email] Failed:", error);

    return {
      ok: false,
      status: "FAILED" as const,
      error:
        error instanceof Error
          ? error.message
          : "Unknown email error",
    };
  }
}