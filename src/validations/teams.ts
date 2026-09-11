import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, - or _ only"),
  description: z.string().trim().max(500).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  leadUserId: z.string().uuid().optional().nullable(),
  hrUserId: z.string().uuid().optional().nullable(),
});

export const updateTeamSchema = createTeamSchema.partial().extend({
  active: z.boolean().optional(),
});

export const teamMemberSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
