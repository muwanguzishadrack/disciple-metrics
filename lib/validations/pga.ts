import * as z from 'zod'

// ---------------------------------------------------------------------------
// Shared PGA metric definitions
//
// One list drives the create dialog (dashboard), the edit dialog (report
// detail), validation, and the outlier check, so a metric added here shows up
// everywhere at once. `salvations` is deliberately absent: it is a GENERATED
// column summed from the five category inputs and must never be written.
// ---------------------------------------------------------------------------

export const PGA_METRIC_KEYS = [
  'sv1',
  'sv2',
  'yxp',
  'kids',
  'local',
  'hc1',
  'hc2',
  'salvationsLivestreamEnc',
  'salvationsLivestreamYxp',
  'salvationsInhouse',
  'salvationsMc',
  'salvationsOther',
  'mechanicsGet',
  'mechanicsWorship',
  'mechanics',
  'baptisms',
  'mca',
  'mechanicsTraining',
] as const

export type PgaMetricKey = (typeof PGA_METRIC_KEYS)[number]

/** Numeric metric values, as sent to the database. */
export type PgaMetricValues = Record<PgaMetricKey, number>

/** Raw input strings, as held by the form ('' = left blank). */
export type PgaMetricInputs = Record<PgaMetricKey, string>

export interface PgaMetricDefinition {
  key: PgaMetricKey
  /** pga_entries column */
  column: string
  /** Form label */
  label: string
}

export const PGA_METRICS: Record<PgaMetricKey, PgaMetricDefinition> = {
  sv1: { key: 'sv1', column: 'sv1', label: '1st Service' },
  sv2: { key: 'sv2', column: 'sv2', label: '2nd Service' },
  yxp: { key: 'yxp', column: 'yxp', label: 'YXP' },
  kids: { key: 'kids', column: 'kids', label: 'Kids' },
  local: { key: 'local', column: 'local', label: 'Local' },
  hc1: { key: 'hc1', column: 'hc1', label: 'Hosting Center 1' },
  hc2: { key: 'hc2', column: 'hc2', label: 'Hosting Center 2' },
  salvationsLivestreamEnc: {
    key: 'salvationsLivestreamEnc',
    column: 'salvations_livestream_enc',
    label: 'Livestream Preacher (Enc)',
  },
  salvationsLivestreamYxp: {
    key: 'salvationsLivestreamYxp',
    column: 'salvations_livestream_yxp',
    label: 'Livestream Preacher (YXP)',
  },
  salvationsInhouse: {
    key: 'salvationsInhouse',
    column: 'salvations_inhouse',
    label: 'In-house Preacher (ALL)',
  },
  salvationsMc: { key: 'salvationsMc', column: 'salvations_mc', label: 'Salvs in MCs' },
  salvationsOther: {
    key: 'salvationsOther',
    column: 'salvations_other',
    label: 'Salvs in Other Events',
  },
  // GET and WT are named call-outs; `mechanics` is the overall figure, entered
  // directly rather than derived from them. Nothing sums these together.
  mechanicsGet: { key: 'mechanicsGet', column: 'mechanics_get', label: 'GET' },
  mechanicsWorship: { key: 'mechanicsWorship', column: 'mechanics_worship', label: 'WT' },
  mechanics: { key: 'mechanics', column: 'mechanics', label: 'Overall Mechanics' },
  baptisms: { key: 'baptisms', column: 'baptisms', label: 'Baptisms' },
  mca: { key: 'mca', column: 'mca', label: 'MCA' },
  // Standalone Others metric
  mechanicsTraining: {
    key: 'mechanicsTraining',
    column: 'mechanics_training',
    label: 'Mechanics Training',
  },
}

/** Metrics that add up to the PGA "Total". */
export const PGA_TOTAL_KEYS = ['sv1', 'sv2', 'yxp', 'kids', 'local', 'hc1', 'hc2'] as const

/** Category inputs that add up to Salvations (the DB generates the sum). */
export const PGA_SALVATION_KEYS = [
  'salvationsLivestreamEnc',
  'salvationsLivestreamYxp',
  'salvationsInhouse',
  'salvationsMc',
  'salvationsOther',
] as const

/**
 * UI ceiling per metric. Deliberately generous -- it only stops typos like an
 * extra row of zeros; the database carries its own (data-derived) bounds and
 * its 23514 error is mapped to a friendly message below.
 */
export const PGA_METRIC_MAX = 100_000

// A single metric field: blank means 0, otherwise a whole number in range.
export const pgaMetricFieldSchema = z
  .string()
  .transform((raw) => raw.trim())
  .superRefine((value, ctx) => {
    if (value === '') return
    if (/^-/.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'Must be 0 or greater' })
      return
    }
    if (!/^\d+$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a whole number' })
      return
    }
    if (Number(value) > PGA_METRIC_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: `Must be ${PGA_METRIC_MAX.toLocaleString('en')} or less`,
      })
    }
  })
  .transform((value) => (value === '' ? 0 : Number(value)))

export const NO_ACTIVITY_REQUIRED_MESSAGE =
  'Enter at least one number, or tick "No activity this week" to save all zeros.'

const metricShape = Object.fromEntries(
  PGA_METRIC_KEYS.map((key) => [key, pgaMetricFieldSchema])
) as Record<PgaMetricKey, typeof pgaMetricFieldSchema>

/**
 * Metrics form schema shared by create and edit. Blank fields save as 0, but a
 * form that is entirely zero must be confirmed via `noActivity` so an empty
 * submit can't silently record a week of zeros.
 */
export const pgaMetricsFormSchema = z
  .object({ ...metricShape, noActivity: z.boolean().default(false) })
  .superRefine((data, ctx) => {
    const anyNonZero = PGA_METRIC_KEYS.some((key) => (data[key] as number) > 0)
    if (!anyNonZero && !data.noActivity) {
      ctx.addIssue({
        code: 'custom',
        path: ['noActivity'],
        message: NO_ACTIVITY_REQUIRED_MESSAGE,
      })
    }
  })

export type PgaMetricsFormInput = z.input<typeof pgaMetricsFormSchema>

export type PgaMetricsValidation =
  | { success: true; values: PgaMetricValues }
  | {
      success: false
      fieldErrors: Partial<Record<PgaMetricKey, string>>
      formError: string | null
    }

/** Validate the raw form strings. */
export function validatePgaMetrics(
  inputs: PgaMetricInputs,
  noActivity: boolean
): PgaMetricsValidation {
  const result = pgaMetricsFormSchema.safeParse({ ...inputs, noActivity })
  if (result.success) {
    const values = {} as PgaMetricValues
    for (const key of PGA_METRIC_KEYS) values[key] = result.data[key] as number
    return { success: true, values }
  }

  const fieldErrors: Partial<Record<PgaMetricKey, string>> = {}
  let formError: string | null = null
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field === 'noActivity') {
      formError = issue.message
    } else if (typeof field === 'string' && !(field in fieldErrors)) {
      fieldErrors[field as PgaMetricKey] = issue.message
    }
  }
  return { success: false, fieldErrors, formError }
}

/** Empty inputs for a new entry: every field blank. */
export function emptyPgaMetricInputs(): PgaMetricInputs {
  return Object.fromEntries(PGA_METRIC_KEYS.map((key) => [key, ''])) as PgaMetricInputs
}

/** Inputs pre-filled from an existing entry (null/undefined shown as blank). */
export function pgaMetricInputsFrom(
  values: Partial<Record<PgaMetricKey, number | null | undefined>>
): PgaMetricInputs {
  return Object.fromEntries(
    PGA_METRIC_KEYS.map((key) => {
      const value = values[key]
      return [key, value === null || value === undefined ? '' : String(value)]
    })
  ) as PgaMetricInputs
}

/** Lenient numeric read of one input, for live totals (invalid -> 0). */
export function pgaInputNumber(raw: string): number {
  const trimmed = raw.trim()
  return /^\d+$/.test(trimmed) ? Number(trimmed) : 0
}

export function sumPgaInputs(inputs: PgaMetricInputs, keys: readonly PgaMetricKey[]): number {
  return keys.reduce((acc, key) => acc + pgaInputNumber(inputs[key]), 0)
}

/** True when every input is blank or zero. */
export function allPgaInputsZero(inputs: PgaMetricInputs): boolean {
  return PGA_METRIC_KEYS.every((key) => pgaInputNumber(inputs[key]) === 0)
}

// ---------------------------------------------------------------------------
// Save-error mapping
// ---------------------------------------------------------------------------

export const PGA_LOCKED_ERROR_PREFIX = 'PGA_ENTRY_LOCKED:'

export interface PgaErrorMessage {
  title: string
  description: string
}

/** Map a Supabase/Postgres error from a pga_entries write to a friendly toast. */
export function describePgaSaveError(error: unknown, fallback: string): PgaErrorMessage {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }

  if (code === '23505') {
    return {
      title: 'Duplicate Entry',
      description: 'A PGA entry for this location already exists on this date',
    }
  }
  if (code === '23514') {
    return {
      title: 'Value out of range',
      description: 'One of the values is outside the allowed range',
    }
  }
  if (
    typeof message === 'string' &&
    message.startsWith(PGA_LOCKED_ERROR_PREFIX) &&
    (code === undefined || code === 'P0001')
  ) {
    return {
      title: 'Report locked',
      description: 'This report is locked. Ask an admin to make changes.',
    }
  }
  return { title: 'Error', description: fallback }
}

// ---------------------------------------------------------------------------
// Legacy public-form schemas (not currently wired to any route), now built on
// the shared metric field so their rules can't drift from the app's.
// ---------------------------------------------------------------------------

const legacyMetricShape = Object.fromEntries(
  PGA_METRIC_KEYS.map((key) => [
    key,
    z.coerce
      .number()
      .int('Enter a whole number')
      .min(0, 'Must be 0 or greater')
      .max(PGA_METRIC_MAX, `Must be ${PGA_METRIC_MAX.toLocaleString('en')} or less`)
      .default(0),
  ])
) as Record<PgaMetricKey, z.ZodDefault<z.ZodNumber>>

export const publicPgaFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  locationId: z.string().uuid('Please select a valid location'),
  ...legacyMetricShape,
})

// Schema for API submission (includes accessCode from PIN dialog)
export const publicPgaSubmissionSchema = publicPgaFormSchema.extend({
  accessCode: z.string().min(1, 'Access code is required'),
})

export type PublicPgaFormData = z.infer<typeof publicPgaFormSchema>
export type PublicPgaSubmissionData = z.infer<typeof publicPgaSubmissionSchema>
