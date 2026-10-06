'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// The calendar (react-day-picker) only renders while the popover is open, so it
// is loaded on demand. Hovering or focusing the trigger starts the download, so
// it is normally ready by the time the popover opens.
const loadCalendar = () => import('@/components/ui/calendar')
const Calendar = dynamic(() => loadCalendar().then((m) => m.Calendar), {
  ssr: false,
  // Same footprint as a month grid (p-3, 7 x 2rem columns, caption + 6 weeks).
  loading: () => <div className="h-[19rem] w-[15.5rem]" aria-busy="true" />,
})

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          onPointerEnter={loadCalendar}
          onFocus={loadCalendar}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" style={{ pointerEvents: 'auto' }}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
          disabled={(date) => date.getDay() !== 0}
        />
      </PopoverContent>
    </Popover>
  )
}
