import { describe, it, expect } from 'vitest'
import {
  PGA_METRIC_KEYS,
  PGA_METRIC_MAX,
  NO_ACTIVITY_REQUIRED_MESSAGE,
  allPgaInputsZero,
  describePgaSaveError,
  emptyPgaMetricInputs,
  pgaMetricFieldSchema,
  pgaMetricInputsFrom,
  sumPgaInputs,
  validatePgaMetrics,
  PGA_TOTAL_KEYS,
  type PgaMetricInputs,
} from '@/lib/validations/pga'

function inputs(overrides: Partial<PgaMetricInputs> = {}): PgaMetricInputs {
  return { ...emptyPgaMetricInputs(), ...overrides }
}

describe('pgaMetricFieldSchema', () => {
  it('turns blank into 0', () => {
    expect(pgaMetricFieldSchema.parse('')).toBe(0)
    expect(pgaMetricFieldSchema.parse('   ')).toBe(0)
  })

  it('parses whole numbers', () => {
    expect(pgaMetricFieldSchema.parse('42')).toBe(42)
    expect(pgaMetricFieldSchema.parse(' 7 ')).toBe(7)
    expect(pgaMetricFieldSchema.parse(String(PGA_METRIC_MAX))).toBe(PGA_METRIC_MAX)
  })

  it('rejects negatives, decimals, junk and values above the ceiling', () => {
    expect(pgaMetricFieldSchema.safeParse('-1').error?.issues[0].message).toBe(
      'Must be 0 or greater'
    )
    expect(pgaMetricFieldSchema.safeParse('1.5').error?.issues[0].message).toBe(
      'Enter a whole number'
    )
    expect(pgaMetricFieldSchema.safeParse('1e3').success).toBe(false)
    expect(pgaMetricFieldSchema.safeParse('abc').success).toBe(false)
    expect(pgaMetricFieldSchema.safeParse(String(PGA_METRIC_MAX + 1)).success).toBe(false)
  })
})

describe('validatePgaMetrics', () => {
  it('requires a number or the no-activity confirmation', () => {
    const result = validatePgaMetrics(inputs(), false)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.formError).toBe(NO_ACTIVITY_REQUIRED_MESSAGE)
      expect(result.fieldErrors).toEqual({})
    }
  })

  it('saves all zeros when no activity is confirmed', () => {
    const result = validatePgaMetrics(inputs(), true)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.values(result.values).every((v) => v === 0)).toBe(true)
      expect(Object.keys(result.values).sort()).toEqual([...PGA_METRIC_KEYS].sort())
    }
  })

  it('treats explicit zeros like blanks', () => {
    expect(validatePgaMetrics(inputs({ sv1: '0', kids: '0' }), false).success).toBe(false)
  })

  it('fills blank fields with 0 when any metric is entered', () => {
    const result = validatePgaMetrics(inputs({ sv1: '25', mechanics: '3' }), false)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.values.sv1).toBe(25)
      expect(result.values.mechanics).toBe(3)
      expect(result.values.sv2).toBe(0)
    }
  })

  it('reports per-field errors', () => {
    const result = validatePgaMetrics(inputs({ sv1: '-4', kids: '2.5', yxp: '10' }), false)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.fieldErrors.sv1).toBe('Must be 0 or greater')
      expect(result.fieldErrors.kids).toBe('Enter a whole number')
      expect(result.fieldErrors.yxp).toBeUndefined()
    }
  })

  it('never includes the generated salvations column', () => {
    expect(PGA_METRIC_KEYS).not.toContain('salvations' as never)
  })
})

describe('input helpers', () => {
  it('prefills from an entry, showing null as blank', () => {
    const result = pgaMetricInputsFrom({ sv1: 10, sv2: 0, kids: null })
    expect(result.sv1).toBe('10')
    expect(result.sv2).toBe('0')
    expect(result.kids).toBe('')
    expect(result.mca).toBe('')
  })

  it('sums leniently for live totals', () => {
    expect(sumPgaInputs(inputs({ sv1: '10', sv2: '5', yxp: 'x', kids: '-3' }), PGA_TOTAL_KEYS)).toBe(15)
  })

  it('detects an all-zero form', () => {
    expect(allPgaInputsZero(inputs())).toBe(true)
    expect(allPgaInputsZero(inputs({ hc2: '0' }))).toBe(true)
    expect(allPgaInputsZero(inputs({ hc2: '1' }))).toBe(false)
  })
})

describe('describePgaSaveError', () => {
  it('maps unique violations to the duplicate message', () => {
    expect(describePgaSaveError({ code: '23505', message: 'dup' }, 'x')).toEqual({
      title: 'Duplicate Entry',
      description: 'A PGA entry for this location already exists on this date',
    })
  })

  it('maps check violations to the range message', () => {
    expect(describePgaSaveError({ code: '23514' }, 'x').description).toBe(
      'One of the values is outside the allowed range'
    )
  })

  it('maps the lock trigger exception', () => {
    expect(
      describePgaSaveError(
        { code: 'P0001', message: 'PGA_ENTRY_LOCKED: report 2026-01-04 is locked' },
        'x'
      ).description
    ).toBe('This report is locked. Ask an admin to make changes.')
  })

  it('does not treat other P0001 errors as a lock', () => {
    expect(describePgaSaveError({ code: 'P0001', message: 'something else' }, 'Failed')).toEqual({
      title: 'Error',
      description: 'Failed',
    })
  })

  it('falls back for unknown errors', () => {
    expect(describePgaSaveError(new Error('boom'), 'Failed to record PGA entry').description).toBe(
      'Failed to record PGA entry'
    )
    expect(describePgaSaveError(undefined, 'Failed').description).toBe('Failed')
  })
})
