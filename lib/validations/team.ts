import { z } from 'zod'

export const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  roleId: z.string().uuid('Please select a role'),
  fobId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
})

export const updateMemberSchema = z.object({
  roleId: z.string().uuid('Please select a role'),
  fobId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
})

export const resendInviteSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
})

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>
export type UpdateMemberFormData = z.infer<typeof updateMemberSchema>
export type ResendInviteFormData = z.infer<typeof resendInviteSchema>
