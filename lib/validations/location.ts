import { z } from 'zod'

export const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  fobId: z.string().uuid('Please select a FOB'),
  pastor: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
})

export const updateLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  fobId: z.string().uuid('Please select a FOB'),
  pastor: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
})

export type CreateLocationFormData = z.infer<typeof createLocationSchema>
export type UpdateLocationFormData = z.infer<typeof updateLocationSchema>
