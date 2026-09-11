import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import crypto from "crypto";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    console.log("Connecting to Neon...");

    await pool.query("SELECT 1");

    console.log("Database connected.");

    const email = "superadmin@bharatinfortechs.com";
    const name = "Bharat Infotechs Super Admin";

    // Generate a secure password locally.
    const password =
      "BI@" + crypto.randomBytes(12).toString("base64url");

    const passwordHash = await bcrypt.hash(password, 12);

    // Find organization.
    let orgResult = await pool.query(
      `SELECT id
       FROM organizations
       WHERE slug = 'bharat-infotechs'
       LIMIT 1`
    );

    let organizationId: string;

    if (orgResult.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO organizations (name, slug)
         VALUES ($1, $2)
         RETURNING id`,
        ["Bharat Infotechs", "bharat-infotechs"]
      );

      organizationId = result.rows[0].id;

      console.log("Created Bharat Infotechs organization.");
    } else {
      organizationId = orgResult.rows[0].id;

      console.log("Bharat Infotechs organization already exists.");
    }

    // Check if admin already exists.
    const existing = await pool.query(
      `SELECT id, email, role
       FROM users
       WHERE organization_id = $1
         AND email = $2
       LIMIT 1`,
      [organizationId, email]
    );

    if (existing.rows.length > 0) {
      console.log("");
      console.log("SUPER ADMIN ALREADY EXISTS");
      console.log("Email:", existing.rows[0].email);
      console.log("Role:", existing.rows[0].role);
      console.log("ID:", existing.rows[0].id);
      return;
    }

    // Create Super Admin.
    const result = await pool.query(
      `INSERT INTO users
       (organization_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role`,
      [
        organizationId,
        name,
        email,
        passwordHash,
        "SUPER_ADMIN",
      ]
    );

    console.log("");
    console.log("========================================");
    console.log("       OPDesk SUPER ADMIN CREATED");
    console.log("========================================");
    console.log("");
    console.log("Organization: Bharat Infotechs");
    console.log("Name:", name);
    console.log("Email:", result.rows[0].email);
    console.log("Password:", password);
    console.log("Role:", result.rows[0].role);
    console.log("User ID:", result.rows[0].id);
    console.log("");
    console.log("SAVE THIS PASSWORD SECURELY.");
    console.log("You will need it for the first login.");
    console.log("");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("");
  console.error("SUPER ADMIN CREATION FAILED:");
  console.error(error);
  process.exit(1);
});