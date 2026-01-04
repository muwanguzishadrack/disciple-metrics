'use client'

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
import { useCreateLocation } from '@/hooks/use-locations'
import { useFobs } from '@/hooks/use-pga'
import {
  createLocationSchema,
  type CreateLocationFormData,
} from '@/lib/validations/location'
import { useToast } from '@/hooks/use-toast'

interface CreateLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateLocationDialog({
  open,
  onOpenChange,
}: CreateLocationDialogProps) {
  const { toast } = useToast()
  const { data: fobs } = useFobs()
  const createLocation = useCreateLocation()

  const form = useForm<CreateLocationFormData>({
    resolver: zodResolver(createLocationSchema),
    defaultValues: {
      name: '',
      fobId: '',
      pastor: '',
      contact: '',
    },
  })

  const onSubmit = async (data: CreateLocationFormData) => {
    try {
      await createLocation.mutateAsync({
        name: data.name,
        fobId: data.fobId,
        pastor: data.pastor || null,
        contact: data.contact || null,
      })
      toast({
        title: 'Location created',
        description: 'The location has been created successfully.',
      })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create location',
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
          <DialogTitle>Add Location</DialogTitle>
          <DialogDescription>
            Create a new location for your church.
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
              <Button type="submit" disabled={createLocation.isPending}>
                {createLocation.isPending ? 'Creating...' : 'Create Location'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
