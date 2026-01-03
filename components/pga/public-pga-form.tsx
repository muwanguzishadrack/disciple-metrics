'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import {
  usePublicFobs,
  usePublicLocations,
  usePublicPgaSubmission,
} from '@/hooks/use-public-pga'
import {
  publicPgaFormSchema,
  type PublicPgaFormData,
} from '@/lib/validations/pga'
import { PinDialog } from './pin-dialog'

interface PublicPgaFormProps {
  onSuccess?: () => void
  onReset?: () => void
}

export function PublicPgaForm({ onSuccess, onReset }: PublicPgaFormProps) {
  const { toast } = useToast()
  const { data: fobs = [], isLoading: fobsLoading } = usePublicFobs()
  const { data: locations = [], isLoading: locationsLoading } = usePublicLocations()
  const submitMutation = usePublicPgaSubmission()
  const [submitted, setSubmitted] = useState(false)
  const [selectedFobId, setSelectedFobId] = useState('')

  // PIN dialog state
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pendingFormData, setPendingFormData] = useState<PublicPgaFormData | null>(null)

  const form = useForm<PublicPgaFormData>({
    resolver: zodResolver(publicPgaFormSchema),
    defaultValues: {
      date: '',
      locationId: '',
      sv1: 0,
      sv2: 0,
      yxp: 0,
      kids: 0,
      local: 0,
      hc1: 0,
      hc2: 0,
    },
  })

  const fobOptions = useMemo(() => {
    return fobs.map((fob) => ({ value: fob.id, label: fob.name }))
  }, [fobs])

  const locationOptions = useMemo(() => {
    const filtered = selectedFobId
      ? locations.filter((loc) => loc.fob_id === selectedFobId)
      : locations
    return filtered.map((loc) => ({ value: loc.id, label: loc.name }))
  }, [locations, selectedFobId])

  // Calculate total
  const watchedValues = form.watch(['sv1', 'sv2', 'yxp', 'kids', 'local', 'hc1', 'hc2'])
  const total = useMemo(() => {
    return watchedValues.reduce((sum, val) => sum + (Number(val) || 0), 0)
  }, [watchedValues])

  // Called when form is valid - opens PIN dialog
  function onFormSubmit(data: PublicPgaFormData) {
    setPendingFormData(data)
    setPinError(null)
    setShowPinDialog(true)
  }

  // Called when PIN is confirmed
  async function onPinConfirm(pin: string) {
    if (!pendingFormData) return

    try {
      await submitMutation.mutateAsync({
        ...pendingFormData,
        accessCode: pin,
      })
      setShowPinDialog(false)
      setSubmitted(true)
      toast({
        title: 'Success!',
        description: 'PGA entry submitted successfully.',
      })
      form.reset()
      setSelectedFobId('')
      setPendingFormData(null)
      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed'
      if (message === 'Invalid access code') {
        setPinError('Invalid access code. Please try again.')
      } else {
        setShowPinDialog(false)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: message,
        })
      }
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 text-center"
      >
        <CheckCircle className="h-16 w-16 text-[#008cff] mb-4" />
        <h3 className="text-xl font-semibold mb-2">Submission Successful!</h3>
        <p className="text-muted-foreground mb-6">
          Your PGA entry has been recorded.
        </p>
        <Button onClick={() => {
          setSubmitted(false)
          onReset?.()
        }}>Submit Another Entry</Button>
      </motion.div>
    )
  }

  const isLoading = fobsLoading || locationsLoading

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Date Field */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* FOB and Location */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <Label>FOB</Label>
              <Combobox
                options={fobOptions}
                value={selectedFobId}
                onValueChange={(val) => {
                  setSelectedFobId(val)
                  form.setValue('locationId', '') // Reset location when FOB changes
                }}
                placeholder={isLoading ? 'Loading...' : 'Select FOB...'}
                searchPlaceholder="Search FOB..."
              />
            </div>

            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Combobox
                    options={locationOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={isLoading ? 'Loading...' : 'Select location...'}
                    searchPlaceholder="Search location..."
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Attendance Numbers - Row 1 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <FormField
              control={form.control}
              name="sv1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>1st Service (1SV)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sv2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>2nd Service (2SV)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Attendance Numbers - Row 2 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 gap-4"
          >
            <FormField
              control={form.control}
              name="yxp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YXP</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kids</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Attendance Numbers - Row 3 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 gap-4"
          >
            <FormField
              control={form.control}
              name="local"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hc1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hosting Center 1 (HC1)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Attendance Numbers - Row 4 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="grid grid-cols-2 gap-4"
          >
            <FormField
              control={form.control}
              name="hc2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hosting Center 2 (HC2)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-medium">
                {total}
              </div>
            </div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              Submit PGA Report
            </Button>
          </motion.div>
        </form>
      </Form>

      {/* PIN Dialog */}
      <PinDialog
        open={showPinDialog}
        onOpenChange={(open) => {
          setShowPinDialog(open)
          if (!open) {
            setPinError(null)
          }
        }}
        onConfirm={onPinConfirm}
        isLoading={submitMutation.isPending}
        error={pinError}
      />
    </>
  )
}
