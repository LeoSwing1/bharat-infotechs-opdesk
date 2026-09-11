import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export const createShiftSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(1).max(20).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, - or _ only"),
  startTime: z.string().regex(timePattern, "Use HH:MM format"),
  endTime: z.string().regex(timePattern, "Use HH:MM format"),
  gracePeriodMinutes: z.number().int().min(0).max(120).default(15),
});

export const updateShiftSchema = createShiftSchema.partial().extend({
  active: z.boolean().optional(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
