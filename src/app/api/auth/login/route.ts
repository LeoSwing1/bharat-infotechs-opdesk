import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, and, or, ilike } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { demoUsers } from "@/lib/demo";

// Accepts either an email address or a permanent employee ID
// (e.g. rahul@internsbharatinfotechs.com or BI-INT-26-00021) — whichever
// the person finds easier to remember and type.
const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please enter your email or employee ID, and password.",
        },
        { status: 400 }
      );
    }

    const { identifier, password } = parsed.data;

    /*
     * ---------------------------------------------------------
     * DEMO MODE
     * ---------------------------------------------------------
     *
     * Demo mode does not require PostgreSQL.
     *
     * All demo accounts use:
     *
     * Password: OPDesk@123
     *
     */

    if (process.env.DEMO_MODE === "true") {
      const normalized = identifier.toLowerCase();
      const demo = demoUsers.find(
        (user) => user.email.toLowerCase() === normalized || user.employeeCode?.toLowerCase() === normalized
      );

      if (!demo) {
        return NextResponse.json(
          {
            error: "Invalid credentials",
          },
          { status: 401 }
        );
      }

      if (password !== "OPDesk@123") {
        return NextResponse.json(
          {
            error: "Invalid credentials",
          },
          { status: 401 }
        );
      }

      const token = await createSession({
        id: demo.id,
        organizationId: demo.organizationId,
        name: demo.name,
        email: demo.email,
        role: demo.role,
      });

      return NextResponse.json({
        ok: true,
        user: demo,
        // Web clients rely on the HttpOnly cookie already set above; mobile
        // clients (Flutter) store this and send it as a Bearer token instead.
        token,
      });
    }

    /*
     * ---------------------------------------------------------
     * PRODUCTION / DATABASE MODE
     * ---------------------------------------------------------
     */

    if (!db) {
      return NextResponse.json(
        {
          error: "Database is not configured.",
        },
        { status: 500 }
      );
    }

    const normalizedIdentifier = identifier.toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.email, normalizedIdentifier),
            ilike(users.employeeCode, normalizedIdentifier)
          ),
          eq(users.status, "ACTIVE")
        )
      )
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          error: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = await createSession(sessionUser);

    return NextResponse.json({
      ok: true,
      user: sessionUser,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        error: "Unable to process login. Please try again.",
      },
      { status: 500 }
    );
  }
}