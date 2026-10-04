'use client'

import { useCallback, useState } from 'react'
import {
  emptyPgaMetricInputs,
  pgaInputNumber,
  validatePgaMetrics,
  type PgaMetricInputs,
  type PgaMetricKey,
  type PgaMetricValues,
} from '@/lib/validations/pga'
import { usePgaOutlierCheck, type PgaOutlierCheckResult } from './use-pga-outlier-check'

export interface PendingOutlierConfirmation {
  result: PgaOutlierCheckResult
  onConfirm: () => void
}

/**
 * State + save flow shared by the create and edit PGA dialogs:
 * raw string inputs -> Zod validation -> outlier check -> (confirm) -> save.
 */
export function usePgaEntryForm() {
  const [inputs, setInputs] = useState<PgaMetricInputs>(emptyPgaMetricInputs)
  const [noActivity, setNoActivityState] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PgaMetricKey, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingOutlierConfirmation | null>(null)
  const checkOutliers = usePgaOutlierCheck()

  const setInput = useCallback((key: PgaMetricKey, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (pgaInputNumber(value) > 0) {
      // A real number replaces any "no activity" confirmation
      setNoActivityState(false)
      setFormError(null)
    }
  }, [])

  const setNoActivity = useCallback((checked: boolean) => {
    setNoActivityState(checked)
    if (checked) setFormError(null)
  }, [])

  const reset = useCallback((initial?: PgaMetricInputs, initialNoActivity = false) => {
    setInputs(initial ?? emptyPgaMetricInputs())
    setNoActivityState(initialNoActivity)
    setFieldErrors({})
    setFormError(null)
    setPendingConfirmation(null)
    setIsChecking(false)
  }, [])

  /** Validate; returns numeric values or null (errors are put on the form). */
  const validate = useCallback((): PgaMetricValues | null => {
    const result = validatePgaMetrics(inputs, noActivity)
    if (result.success) {
      setFieldErrors({})
      setFormError(null)
      return result.values
    }
    setFieldErrors(result.fieldErrors)
    setFormError(
      result.formError ??
        (Object.keys(result.fieldErrors).length > 0 ? 'Fix the highlighted values.' : null)
    )
    return null
  }, [inputs, noActivity])

  /**
   * Run the outlier check, then either save straight away or park the save
   * behind the confirm dialog. An explicit "No activity this week" tick is
   * itself the confirmation for an all-zero entry, so that warning is dropped.
   */
  const saveWithOutlierCheck = useCallback(
    async (
      locationId: string,
      reportDate: string,
      values: PgaMetricValues,
      save: () => void | Promise<void>
    ) => {
      setIsChecking(true)
      let result: PgaOutlierCheckResult
      try {
        result = await checkOutliers(locationId, reportDate, values)
      } finally {
        setIsChecking(false)
      }
      const droppedToZero = result.droppedToZero && !noActivity
      const effective = {
        ...result,
        droppedToZero,
        hasWarnings: result.spikes.length > 0 || droppedToZero,
      }
      if (!effective.hasWarnings) {
        await save()
        return
      }
      setPendingConfirmation({
        result: effective,
        onConfirm: () => {
          setPendingConfirmation(null)
          void save()
        },
      })
    },
    [checkOutliers, noActivity]
  )

  const cancelConfirmation = useCallback(() => setPendingConfirmation(null), [])

  return {
    inputs,
    setInput,
    noActivity,
    setNoActivity,
    fieldErrors,
    formError,
    reset,
    validate,
    isChecking,
    saveWithOutlierCheck,
    pendingConfirmation,
    cancelConfirmation,
  }
}
