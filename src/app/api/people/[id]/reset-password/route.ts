import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sendEmail } from "@/services/email/email.service";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resetting someone else's password is a high-trust action — Super Admin
  // only, unlike the self-service change-password flow anyone can use on
  // their own account.
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const { id } = await params;
  const [person] = await db.select().from(users).where(and(eq(users.id, id), eq(users.organizationId, session.organizationId)));
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newPassword = Math.random().toString(36).slice(2, 10) + "Aa1!";
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));

  const emailResult = await sendEmail({
    to: person.email,
    subject: "Your OPDesk password has been reset",
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px;">
        <h2>Password reset</h2>
        <p>A Super Admin has reset your OPDesk password. Your new temporary password is:</p>
        <p style="font-family: monospace; font-weight: bold; font-size: 16px;">${newPassword}</p>
        <p style="color: #667085; font-size: 13px;">
          Please sign in and change this under Settings → Security as soon as possible.
          If you didn't expect this, contact your administrator.
        </p>
      </div>
    `.trim(),
    type: "PASSWORD_RESET",
    organizationId: session.organizationId,
  }).catch(err => {
    console.error("Password reset email failed for", person.email, err);
    return { ok: false };
  });

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "PASSWORD_RESET_BY_ADMIN",
    entityType: "user", entityId: id, metadata: { targetEmail: person.email },
  });

  return NextResponse.json({
    // Only returned once — same rule as account creation.
    temporaryPassword: newPassword,
    emailSent: emailResult.ok,
  });
}
