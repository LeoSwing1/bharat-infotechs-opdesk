import "dotenv/config";
import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";

import { db } from "./index";
import {
  organizations,
  departments,
  users,
  teams,
  teamMembers,
  permissions,
  rolePermissions,
} from "./schema";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../lib/permission-catalog";
import { generateEmployeeCode } from "../services/people/id-generator";

async function seed() {
  if (!db) {
    throw new Error(
      "Set DATABASE_URL and DEMO_MODE=false to seed PostgreSQL."
    );
  }

  // ---------------------------------------------------------
  // ORGANIZATION
  // ---------------------------------------------------------

  const [org] = await db
    .insert(organizations)
    .values({
      name: "Bharat Infotechs",
      slug: "bharat-infotechs",
    })
    .returning();

  // ---------------------------------------------------------
  // DEPARTMENTS
  // ---------------------------------------------------------

  const [tech] = await db
    .insert(departments)
    .values({
      organizationId: org.id,
      name: "Technology",
      description: "Technology and software development",
    })
    .returning();

  const [hr] = await db
    .insert(departments)
    .values({
      organizationId: org.id,
      name: "HR",
      description: "Human resources and workforce operations",
    })
    .returning();

  // ---------------------------------------------------------
  // PERMISSION CATALOG + DEFAULT ROLE GRANTS
  // ---------------------------------------------------------

  await db.insert(permissions).values(
    PERMISSIONS.map(p => ({ key: p.key, label: p.label, category: p.category }))
  ).onConflictDoNothing();

  const roleGrantRows = (Object.entries(DEFAULT_ROLE_PERMISSIONS) as [keyof typeof DEFAULT_ROLE_PERMISSIONS, string[]][])
    .flatMap(([role, keys]) => keys.map(permissionKey => ({
      organizationId: org.id,
      role,
      permissionKey,
      granted: true,
    })));

  await db.insert(rolePermissions).values(roleGrantRows).onConflictDoNothing();

  // ---------------------------------------------------------
  // COMMON PASSWORD
  // ---------------------------------------------------------

  const passwordHash = await bcrypt.hash("OPDesk@123", 12);
  const joiningYear = new Date().getFullYear();

  // ---------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------

  const adminCode = await generateEmployeeCode(org.id, "EMP", joiningYear);
  const [admin] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      departmentId: tech.id,
      name: "OPDesk Admin",
      email: "admin@opdesk.local",
      passwordHash,
      role: "SUPER_ADMIN",
      employeeCode: adminCode,
      employmentType: "EMPLOYEE",
      designation: "Super Administrator",
      joiningDate: new Date().toISOString().slice(0, 10),
    })
    .returning();

  // ---------------------------------------------------------
  // HR MANAGER
  // ---------------------------------------------------------

  const hrCode = await generateEmployeeCode(org.id, "EMP", joiningYear);
  const [hrUser] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      departmentId: hr.id,
      name: "HR Manager",
      email: "hr@opdesk.local",
      passwordHash,
      role: "HR_MANAGER",
      employeeCode: hrCode,
      employmentType: "EMPLOYEE",
      designation: "HR Manager",
      joiningDate: new Date().toISOString().slice(0, 10),
    })
    .returning();

  // ---------------------------------------------------------
  // TEAM LEAD
  // ---------------------------------------------------------

  const leadCode = await generateEmployeeCode(org.id, "EMP", joiningYear);
  const [lead] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      departmentId: tech.id,
      name: "Team Lead",
      email: "lead@opdesk.local",
      passwordHash,
      role: "TEAM_LEAD",
      employeeCode: leadCode,
      employmentType: "EMPLOYEE",
      designation: "Team Lead",
      reportingManagerId: admin.id,
      joiningDate: new Date().toISOString().slice(0, 10),
    })
    .returning();

  // ---------------------------------------------------------
  // INTERN
  // ---------------------------------------------------------

  const internCode = await generateEmployeeCode(org.id, "INT", joiningYear);
  const [intern] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      departmentId: tech.id,
      name: "Demo Intern",
      email: "intern@opdesk.local",
      passwordHash,
      role: "INTERN_EMPLOYEE",
      employeeCode: internCode,
      employmentType: "INTERN",
      designation: "Software Development Intern",
      reportingManagerId: lead.id,
      joiningDate: new Date().toISOString().slice(0, 10),
    })
    .returning();

  // ---------------------------------------------------------
  // TEAM
  // ---------------------------------------------------------

  const [team] = await db
    .insert(teams)
    .values({
      organizationId: org.id,
      departmentId: tech.id,
      name: "Web Development",
      code: "102",
      description: "Website and internal tooling development.",
      leadUserId: lead.id,
      hrUserId: hrUser.id,
    })
    .returning();

  // ---------------------------------------------------------
  // TEAM MEMBERS
  // ---------------------------------------------------------

  await db.insert(teamMembers).values([
    {
      teamId: team.id,
      userId: lead.id,
    },
    {
      teamId: team.id,
      userId: intern.id,
    },
  ]);

  // Keep each member's primary team in sync.
  await db.update(users).set({ teamId: team.id }).where(inArray(users.id, [lead.id, intern.id]));

  console.log("");
  console.log("========================================");
  console.log("        OPDesk Seed Complete");
  console.log("========================================");
  console.log("");

  console.log("Organization:");
  console.log("  Bharat Infotechs");

  console.log("");
  console.log("Permissions:");
  console.log(`  ${PERMISSIONS.length} permissions seeded, default role grants applied`);

  console.log("");
  console.log("Demo Accounts:");
  console.log("");
  console.log("SUPER ADMIN");
  console.log("  admin@opdesk.local");
  console.log("  OPDesk@123");
  console.log(`  Employee ID: ${adminCode}`);

  console.log("");
  console.log("HR MANAGER");
  console.log("  hr@opdesk.local");
  console.log("  OPDesk@123");
  console.log(`  Employee ID: ${hrCode}`);

  console.log("");
  console.log("TEAM LEAD");
  console.log("  lead@opdesk.local");
  console.log("  OPDesk@123");
  console.log(`  Employee ID: ${leadCode}`);

  console.log("");
  console.log("INTERN");
  console.log("  intern@opdesk.local");
  console.log("  OPDesk@123");
  console.log(`  Employee ID: ${internCode}`);

  console.log("");
  console.log("Team:");
  console.log("  Web Development");
  console.log("  Team Code: 102");
  console.log("");
}

seed().catch((error) => {
  console.error("");
  console.error("OPDesk seed failed:");
  console.error(error);
  process.exit(1);
});