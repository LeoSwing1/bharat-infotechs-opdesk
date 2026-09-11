import { z } from "zod";

export const updateRolePermissionSchema = z.object({
  role: z.enum(["HR_MANAGER", "MANAGER", "TEAM_LEAD", "EMPLOYEE", "INTERN_EMPLOYEE"]),
  permissionKey: z.string().min(1),
  granted: z.boolean(),
});

export type UpdateRolePermissionInput = z.infer<typeof updateRolePermissionSchema>;
