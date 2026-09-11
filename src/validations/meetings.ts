import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  meetingLink: z.string().trim().url().optional().nullable(),
  agenda: z.string().trim().max(4000).optional().nullable(),
  participantIds: z.array(z.string().uuid()).default([]),
}).refine(data => new Date(data.endAt) > new Date(data.startAt), {
  message: "End time must be after start time",
  path: ["endAt"],
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  meetingLink: z.string().trim().url().optional().nullable(),
  agenda: z.string().trim().max(4000).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  status: z.enum(["SCHEDULED", "STARTED", "COMPLETED", "CANCELLED"]).optional(),
});

export const meetingParticipantSchema = z.object({ userId: z.string().uuid() });
