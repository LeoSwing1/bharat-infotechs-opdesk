import { z } from "zod";

export const employmentTypes = ["EMPLOYEE", "INTERN", "CONTRACT", "FREELANCER", "TRAINEE"] as const;
export const personRoles = ["HR_MANAGER", "MANAGER", "TEAM_LEAD", "EMPLOYEE", "INTERN_EMPLOYEE"] as const;

export const createPersonSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  // Optional: if omitted, the server generates one following the Bharat
  // Infotechs convention (interns get @internsbharatinfotechs.com, everyone
  // else gets @bharatinfotechs.com). A custom email is always honored if given.
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(personRoles),
  employmentType: z.enum(employmentTypes).default("EMPLOYEE"),
  designation: z.string().trim().max(120).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  shiftId: z.string().uuid().optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  joiningDate: z.string().date().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const updatePersonSchema = createPersonSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
