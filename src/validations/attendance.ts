import { z } from "zod";

export const correctAttendanceSchema = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).optional(),
  clockInAt: z.string().datetime().optional(),
  clockOutAt: z.string().datetime().optional(),
  breakMinutes: z.number().int().min(0).optional(),
  reason: z.string().trim().min(5, "Explain why this record is being corrected"),
});

export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;
