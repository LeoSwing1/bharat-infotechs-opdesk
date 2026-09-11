import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  kind: z.enum(["INTERNAL", "CLIENT"]).default("INTERNAL"),
  clientName: z.string().trim().max(160).optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  startDate: z.string().date().optional().nullable(),
  endDate: z.string().date().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "ARCHIVED"]).optional(),
});

export const projectMemberSchema = z.object({ userId: z.string().uuid() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
