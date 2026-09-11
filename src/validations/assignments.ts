import { z } from "zod";

export const createAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
});

export const updateAssignmentSchema = createAssignmentSchema.partial().omit({ projectId: true }).extend({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"]).optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
