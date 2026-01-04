'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useUpdateLocation } from '@/hooks/use-locations'
import { useFobs } from '@/hooks/use-pga'
import {
  updateLocationSchema,
  type UpdateLocationFormData,
} from '@/lib/validations/location'
import { useToast } from '@/hooks/use-toast'
import type { LocationWithFob } from '@/types'

interface EditLocationDialogProps {
  location: LocationWithFob | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditLocationDialog({
  location,
  open,
  onOpenChange,
}: EditLocationDialogProps) {
  const { toast } = useToast()
  const { data: fobs } = useFobs()
  const updateLocation = useUpdateLocation()

  const form = useForm<UpdateLocationFormData>({
    resolver: zodResolver(updateLocationSchema),
    defaultValues: {
      name: '',
      fobId: '',
      pastor: '',
      contact: '',
    },
  })

  // Reset form when dialog opens with a location
  useEffect(() => {
    if (location && open) {
      form.reset({
        name: location.name,
        fobId: location.fob_id,
        pastor: location.pastor || '',
        contact: location.contact || '',
      })
    }
  }, [location, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: UpdateLocationFormData) => {
    if (!location) return

    try {
      await updateLocation.mutateAsync({
        id: location.id,
        name: data.name,
        fobId: data.fobId,
        pastor: data.pastor || null,
        contact: data.contact || null,
      })
      toast({
        title: 'Location updated',
        description: 'The location has been updated successfully.',
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update location',
        variant: 'destructive',
      })
    }
  }

  // Build FOB options for combobox
  const fobOptions =
    fobs?.map((fob) => ({
      value: fob.id,
      label: fob.name,
    })) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit PGA</DialogTitle>
          <DialogDescription>
            Update the details for {location?.name}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter location name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fobId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FOB</FormLabel>
                  <FormControl>
                    <Combobox
                      options={fobOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select a FOB"
                      searchPlaceholder="Search FOBs..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pastor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pastor (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter pastor name"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter contact information"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateLocation.isPending}>
                {updateLocation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
