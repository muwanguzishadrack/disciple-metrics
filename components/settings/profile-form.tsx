'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useProfile } from '@/hooks/use-user'
import { useUpdateEmail } from '@/hooks/use-auth'
import { profileSchema, type ProfileFormData } from '@/lib/validations/settings'
import { DeleteAccountDialog } from './delete-account-dialog'

export function ProfileForm() {
  const { toast } = useToast()
  const { data: profile, isLoading } = useProfile()
  const updateEmail = useUpdateEmail()

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: '',
    },
  })

  useEffect(() => {
    if (profile) {
      form.reset({
        email: profile.email || '',
      })
    }
  }, [profile, form])

  async function onSubmit(data: ProfileFormData) {
    try {
      // Update email if changed
      if (data.email !== profile?.email) {
        await updateEmail.mutateAsync(data.email)
        toast({
          title: 'Verification email sent',
          description: 'Please check your new email to confirm the change.',
        })
      } else {
        toast({
          title: 'No changes',
          description: 'Your email address is already up to date.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update email',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@example.com" {...field} />
                </FormControl>
                <FormDescription>
                  Changing your email will require verification.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={updateEmail.isPending}
          >
            {updateEmail.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        </form>
      </Form>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>
        </div>
        <DeleteAccountDialog />
      </div>
    </div>
  )
}
