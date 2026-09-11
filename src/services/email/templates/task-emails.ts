import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { sendEmail } from "@/services/email/email.service";
import { opdeskEmailTemplate } from "@/services/email/templates/base-template";

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const body = await req.json().catch(() => ({}));

  const to =
    typeof body.to === "string" && body.to.includes("@")
      ? body.to
      : session.email;

  const html = opdeskEmailTemplate({
    title: "OPDesk email integration test",
    message: `
      <p>Hello ${session.name},</p>

      <p>
        This is a test email from your OPDesk installation.
      </p>

      <p>
        If you received this message, the OPDesk email integration
        is working correctly.
      </p>
    `,
  });

  const result = await sendEmail({
    to,
    subject: "OPDesk — Email Integration Test",
    html,
    type: "INTEGRATION_TEST",
    organizationId: session.organizationId,
  });

  return NextResponse.json(result);
}