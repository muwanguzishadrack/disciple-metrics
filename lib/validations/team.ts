import * as z from 'zod'

export const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  roleId: z.guid('Please select a role'),
  fobId: z.guid().optional().nullable(),
  locationId: z.guid().optional().nullable(),
})

export const updateMemberSchema = z.object({
  roleId: z.guid('Please select a role'),
  fobId: z.guid().optional().nullable(),
  locationId: z.guid().optional().nullable(),
})

export const resendInviteSchema = z.object({
  invitationId: z.guid('Invalid invitation ID'),
})

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>
export type UpdateMemberFormData = z.infer<typeof updateMemberSchema>
export type ResendInviteFormData = z.infer<typeof resendInviteSchema>
