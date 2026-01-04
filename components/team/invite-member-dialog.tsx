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
import { useInviteMember, useRoles } from '@/hooks/use-team'
import { useFobs, useLocations } from '@/hooks/use-pga'
import {
  inviteMemberSchema,
  type InviteMemberFormData,
} from '@/lib/validations/team'
import { useToast } from '@/hooks/use-toast'
import { ROLE_DISPLAY_NAMES, type RoleName } from '@/types'

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteMemberDialog({
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const { toast } = useToast()
  const { data: roles } = useRoles()
  const { data: fobs } = useFobs()
  const { data: locations } = useLocations()
  const inviteMember = useInviteMember()

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      roleId: '',
      fobId: undefined,
      locationId: undefined,
    },
  })

  const selectedRoleId = form.watch('roleId')
  const selectedFobId = form.watch('fobId')

  const selectedRole = roles?.find((r) => r.id === selectedRoleId)
  const showFobSelect =
    selectedRole?.name === 'fob_leader' || selectedRole?.name === 'pastor'
  const showLocationSelect = selectedRole?.name === 'pastor'

  // Filter locations by selected FOB
  const filteredLocations =
    locations?.filter((l) => l.fob?.id === selectedFobId) || []

  // Reset dependent fields when role changes
  useEffect(() => {
    if (selectedRole?.name === 'admin') {
      form.setValue('fobId', undefined)
      form.setValue('locationId', undefined)
    }
  }, [selectedRole, form])

  // Reset location when FOB changes
  useEffect(() => {
    form.setValue('locationId', undefined)
  }, [selectedFobId, form])

  const onSubmit = async (data: InviteMemberFormData) => {
    try {
      await inviteMember.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        roleId: data.roleId,
        fobId: data.fobId || undefined,
        locationId: data.locationId || undefined,
      })
      toast({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${data.email}`,
      })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to send invitation',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. They will receive an email
            with a magic link.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              <Button type="submit" disabled={inviteMember.isPending}>
                {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
