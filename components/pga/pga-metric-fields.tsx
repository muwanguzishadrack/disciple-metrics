'use client'

import { Fragment } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  PGA_METRICS,
  PGA_METRIC_MAX,
  PGA_SALVATION_KEYS,
  PGA_TOTAL_KEYS,
  allPgaInputsZero,
  sumPgaInputs,
  type PgaMetricInputs,
  type PgaMetricKey,
} from '@/lib/validations/pga'

// DOM id suffix per metric -- kept identical to the ids the inline dialogs used.
const ID_SUFFIX: Record<PgaMetricKey, string> = {
  sv1: 'sv1',
  sv2: 'sv2',
  yxp: 'yxp',
  kids: 'kids',
  local: 'local',
  hc1: 'hc1',
  hc2: 'hc2',
  salvationsLivestreamEnc: 'salvations-livestream-enc',
  salvationsLivestreamYxp: 'salvations-livestream-yxp',
  salvationsInhouse: 'salvations-inhouse',
  salvationsMc: 'salvations-mc',
  salvationsOther: 'salvations-other',
  mechanicsGet: 'mechanics-get',
  mechanicsWorship: 'mechanics-worship',
  mechanics: 'mechanics-overall',
  baptisms: 'baptisms',
  mca: 'mca',
  mechanicsTraining: 'mechanics-training',
}

type Cell = PgaMetricKey | 'total' | 'salvationsTotal'

const SECTIONS: { title: string; cells: Cell[] }[] = [
  { title: 'Garage', cells: ['sv1', 'sv2', 'yxp', 'kids', 'local', 'hc1', 'hc2', 'total'] },
  {
    title: 'Salvations',
    cells: [
      'salvationsLivestreamEnc',
      'salvationsLivestreamYxp',
      'salvationsInhouse',
      'salvationsMc',
      'salvationsOther',
      'salvationsTotal',
    ],
  },
  { title: 'Mechanics', cells: ['mechanicsGet', 'mechanicsWorship', 'mechanics'] },
  { title: 'Others', cells: ['baptisms', 'mca', 'mechanicsTraining'] },
]

interface PgaMetricFieldsProps {
  /** 'pga' for the create dialog, 'edit' for the edit dialog */
  idPrefix: string
  inputs: PgaMetricInputs
  onInputChange: (key: PgaMetricKey, value: string) => void
  fieldErrors: Partial<Record<PgaMetricKey, string>>
  noActivity: boolean
  onNoActivityChange: (checked: boolean) => void
  /** Form-level error (e.g. "enter at least one number") */
  formError: string | null
}

/**
 * The metric inputs shared by the Record PGA (create) and Edit PGA dialogs.
 * Blank fields are shown empty and saved as 0; an all-zero form needs the
 * explicit "No activity this week" tick.
 */
export function PgaMetricFields({
  idPrefix,
  inputs,
  onInputChange,
  fieldErrors,
  noActivity,
  onNoActivityChange,
  formError,
}: PgaMetricFieldsProps) {
  const total = sumPgaInputs(inputs, PGA_TOTAL_KEYS)
  const salvationsTotal = sumPgaInputs(inputs, PGA_SALVATION_KEYS)
  const allZero = allPgaInputsZero(inputs)

  const renderCell = (cell: Cell) => {
    if (cell === 'total' || cell === 'salvationsTotal') {
      return (
        <div key={cell} className="grid gap-2">
          <Label>{cell === 'total' ? 'Total' : 'Total Salvations'}</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-base md:text-sm font-medium">
            {cell === 'total' ? total : salvationsTotal}
          </div>
        </div>
      )
    }

    const id = `${idPrefix}-${ID_SUFFIX[cell]}`
    const error = fieldErrors[cell]
    return (
      <div key={cell} className="grid gap-2 content-start">
        <Label htmlFor={id}>{PGA_METRICS[cell].label}</Label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min="0"
          max={PGA_METRIC_MAX}
          step="1"
          placeholder="0"
          value={inputs[cell]}
          onChange={(e) => onInputChange(cell, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        />
        {error && (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      {SECTIONS.map((section) => (
        <div key={section.title} className="border-t pt-4">
          <p className="text-sm font-medium mb-3">{section.title}</p>
          <div className="grid grid-cols-2 gap-4">
            {section.cells.map((cell) => (
              <Fragment key={cell}>{renderCell(cell)}</Fragment>
            ))}
          </div>
        </div>
      ))}

      {allZero && (
        <div className="border-t pt-4 grid gap-2">
          <label
            htmlFor={`${idPrefix}-no-activity`}
            className="flex items-start gap-2 text-sm cursor-pointer"
          >
            <input
              id={`${idPrefix}-no-activity`}
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={noActivity}
              onChange={(e) => onNoActivityChange(e.target.checked)}
            />
            <span>
              <span className="font-medium">No activity this week</span>
              <span className="block text-muted-foreground">
                Save this entry with every value as 0.
              </span>
            </span>
          </label>
        </div>
      )}

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
    </>
  )
}
