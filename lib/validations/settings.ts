import { z } from 'zod'
import { PASSWORD_REQUIREMENTS } from '@/lib/constants'

const passwordSchema = z
  .string()
  .min(
    PASSWORD_REQUIREMENTS.minLength,
    `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
  )
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    'Password must contain at least one special character'
  )

export const profileSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  })

export const appearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
})

export const twoFactorSchema = z.object({
  enabled: z.boolean(),
})

export type ProfileFormData = z.infer<typeof profileSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
export type AppearanceFormData = z.infer<typeof appearanceSchema>
export type TwoFactorFormData = z.infer<typeof twoFactorSchema>
