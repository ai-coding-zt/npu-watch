import { z } from 'zod';

const authFields = {
  authType: z.enum(['password', 'key']),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional()
};

const serverFields = {
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().optional().default(22),
  username: z.string().min(1),
  ...authFields
};

export const createServerSchema = z.object(serverFields).refine(
  data => data.authType === 'password' ? !!data.password : !!data.privateKey,
  { message: 'Password required for password auth, privateKey required for key auth' }
);

export const updateServerSchema = z.object({
  name: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().positive().optional(),
  username: z.string().min(1).optional(),
  ...authFields
});
