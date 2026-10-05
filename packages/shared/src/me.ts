import { z } from 'zod';

import { Role } from './enums.js';

export const meResponseSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.string(), fullName: z.string() }),
  organization: z.object({ id: z.uuid(), title: z.string() }),
  roles: z.array(Role.schema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const publicConfigSchema = z.object({ googleEnabled: z.boolean() });
export type PublicConfig = z.infer<typeof publicConfigSchema>;
