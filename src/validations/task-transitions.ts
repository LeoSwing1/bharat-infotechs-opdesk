import { z } from "zod";

export const taskTransitionSchema = z.object({
  action: z.enum(["START", "SUBMIT", "APPROVE", "REJECT", "REOPEN"]),
  comment: z.string().trim().max(2000).optional(),
});

export type TaskTransitionInput = z.infer<typeof taskTransitionSchema>;
