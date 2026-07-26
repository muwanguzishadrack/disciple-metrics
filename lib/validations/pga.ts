import { z } from 'zod'

// Schema for the form (without accessCode - that comes from PIN dialog)
export const publicPgaFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  locationId: z.string().uuid('Please select a valid location'),
  sv1: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  sv2: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  yxp: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  kids: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  local: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  hc1: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  hc2: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  // Ministry Impact metrics (not included in PGA total)
  // Salvations are captured per source; the DB stores their sum as `salvations`.
  salvationsLivestream: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  salvationsInhouse: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  salvationsMc: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  salvationsOther: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  baptisms: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mca: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  // Mechanics are captured per serving team; the DB stores their sum as `mechanics`.
  mechanicsGet: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mechanicsWorship: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mechanicsMedia: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mechanicsHarvestKids: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mechanicsParkingSecurity: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mechanicsFacilities: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
  mechanicsBusing: z.coerce.number().min(0, 'Must be 0 or greater').default(0),
})

// Schema for API submission (includes accessCode from PIN dialog)
export const publicPgaSubmissionSchema = publicPgaFormSchema.extend({
  accessCode: z.string().min(1, 'Access code is required'),
})

export type PublicPgaFormData = z.infer<typeof publicPgaFormSchema>
export type PublicPgaSubmissionData = z.infer<typeof publicPgaSubmissionSchema>
