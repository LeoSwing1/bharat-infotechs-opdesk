import { z } from "zod";

export const createDailyUpdateSchema = z.object({
  workedOn: z.string().trim().min(3, "Describe what you worked on"),
  completed: z.string().trim().max(4000).optional().nullable(),
  nextWork: z.string().trim().max(4000).optional().nullable(),
  blockers: z.string().trim().max(2000).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
});

export type CreateDailyUpdateInput = z.infer<typeof createDailyUpdateSchema>;
