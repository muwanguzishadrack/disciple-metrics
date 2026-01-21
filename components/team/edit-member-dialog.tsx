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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useUpdateMember, useRoles } from '@/hooks/use-team'
import { useFobs, useLocations } from '@/hooks/use-pga'
import {
  updateMemberSchema,
  type UpdateMemberFormData,
} from '@/lib/validations/team'
import { useToast } from '@/hooks/use-toast'
import { ROLE_DISPLAY_NAMES, type RoleName, type TeamMember } from '@/types'

interface EditMemberDialogProps {
  member: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditMemberDialog({
  member,
  open,
  onOpenChange,
}: EditMemberDialogProps) {
  const { toast } = useToast()
  const { data: roles } = useRoles()
  const { data: fobs } = useFobs()
  const { data: locations } = useLocations()
  const updateMember = useUpdateMember()

  const form = useForm<UpdateMemberFormData>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      roleId: '',
      fobId: undefined,
      locationId: undefined,
    },
  })

  // Reset form when dialog opens with a member
  useEffect(() => {
    if (member && open) {
      form.reset({
        roleId: member.role?.id || '',
        // For pastors, derive fobId from location's parent fob (since they don't have direct fob assignment)
        fobId: member.fob?.id || (member.location as { fob_id?: string })?.fob_id || undefined,
        locationId: member.location?.id || undefined,
      })
    }
  }, [member, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRoleId = form.watch('roleId')
  const selectedFobId = form.watch('fobId')

  const selectedRole = roles?.find((r) => r.id === selectedRoleId)
  const showFobSelect =
    selectedRole?.name === 'fob_leader' || selectedRole?.name === 'pastor'
  const showLocationSelect = selectedRole?.name === 'pastor'

  // Filter locations by selected FOB
  const filteredLocations =
    locations?.filter((l) => l.fob?.id === selectedFobId) || []

  // Reset dependent fields when role changes to admin
  useEffect(() => {
    if (selectedRole?.name === 'admin') {
      form.setValue('fobId', undefined)
      form.setValue('locationId', undefined)
    }
  }, [selectedRole, form])

  const onSubmit = async (data: UpdateMemberFormData) => {
    if (!member) return

    try {
      await updateMember.mutateAsync({
        id: member.id,
        data: {
          roleId: data.roleId,
          fobId: data.fobId || null,
          locationId: data.locationId || null,
        },
      })
      toast({
        title: 'Member updated',
        description: 'Team member role has been updated successfully.',
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update member',
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

  // Build location options for combobox
  const locationOptions = filteredLocations.map((loc) => ({
    value: loc.id,
    label: loc.name,
  }))

  const memberEmail = member?.email || 'Unknown'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
          <DialogDescription>
            Update the role and assignment for {memberEmail}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {ROLE_DISPLAY_NAMES[role.name as RoleName] ||
                            role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showFobSelect && (
              <FormField
                control={form.control}
                name="fobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FOB</FormLabel>
                    <FormControl>
                      <Combobox
                        options={fobOptions}
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Select a FOB"
                        searchPlaceholder="Search FOBs..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showLocationSelect && selectedFobId && (
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Combobox
                        options={locationOptions}
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Select a location"
                        searchPlaceholder="Search locations..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMember.isPending}>
                {updateMember.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
