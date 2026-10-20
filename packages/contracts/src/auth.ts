import { z } from "zod";

const nameSchema = z.string().trim().min(1, "Enter your name.").max(80);
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const registerSchema = loginSchema.extend({
  firstName: nameSchema,
  lastName: nameSchema,
  password: z
    .string()
    .min(12, "Use at least 12 characters for your password.")
    .max(128, "Use no more than 128 characters."),
});

export const authUserSchema = z.object({
  id: z.string().min(1),
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
});

export const authSessionSchema = z
  .object({
    user: authUserSchema,
    session: z.object({ expiresAt: z.coerce.date() }),
  })
  .nullable();

export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
