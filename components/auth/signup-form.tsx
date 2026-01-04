'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'
import { useSignup } from '@/hooks/use-auth'
import { useFobs, useLocations } from '@/hooks/use-pga'
import {
  signupSchema,
  type SignupFormData,
  calculatePasswordStrength,
} from '@/lib/validations/auth'
import { cn } from '@/lib/utils'

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { toast } = useToast()
  const signup = useSignup()
  const { data: fobs, isLoading: fobsLoading } = useFobs()
  const { data: locations, isLoading: locationsLoading } = useLocations()

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      fobId: '',
      locationId: '',
    },
  })

  const password = form.watch('password')
  const selectedFobId = form.watch('fobId')
  const passwordStrength = calculatePasswordStrength(password)

  // Filter locations by selected FOB
  const filteredLocations = useMemo(() => {
    if (!selectedFobId || !locations) return []
    return locations.filter((loc) => loc.fob_id === selectedFobId)
  }, [locations, selectedFobId])

  // Reset location when FOB changes
  useEffect(() => {
    if (selectedFobId) {
      form.setValue('locationId', '')
    }
  }, [selectedFobId, form])

  // Build options for comboboxes
  const fobOptions = useMemo(() => {
    return (fobs || []).map((fob) => ({
      value: fob.id,
      label: fob.name,
    }))
  }, [fobs])

  const locationOptions = useMemo(() => {
    return filteredLocations.map((loc) => ({
      value: loc.id,
      label: loc.name,
    }))
  }, [filteredLocations])

  const passwordChecks = [
    { check: password.length >= 8, label: 'At least 8 characters' },
    { check: /[A-Z]/.test(password), label: 'Uppercase letter' },
    { check: /[a-z]/.test(password), label: 'Lowercase letter' },
    { check: /[0-9]/.test(password), label: 'Number' },
    { check: /[!@#$%^&*(),.?":{}|<>]/.test(password), label: 'Special character' },
  ]

  async function onSubmit(data: SignupFormData) {
    try {
      await signup.mutateAsync(data)
      toast({
        title: 'Account created!',
        description: 'Welcome to Disciple Metrics.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create account',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input placeholder="John" autoComplete="given-name" {...field} />
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
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 gap-4"
        >
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
                    placeholder={fobsLoading ? 'Loading...' : 'Select FOB...'}
                    searchPlaceholder="Search FOB..."
                    disabled={fobsLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Combobox
                    options={locationOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={
                      !selectedFobId
                        ? 'Select FOB first'
                        : locationsLoading
                          ? 'Loading...'
                          : 'Select location...'
                    }
                    searchPlaceholder="Search location..."
                    disabled={!selectedFobId || locationsLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        {password && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all', passwordStrength.color)}
                  style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium">{passwordStrength.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {passwordChecks.map(({ check, label }) => (
                <div key={label} className="flex items-center gap-1">
                  {check ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={check ? 'text-green-500' : 'text-muted-foreground'}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button type="submit" className="w-full" disabled={signup.isPending}>
            {signup.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create account
          </Button>
        </motion.div>
      </form>
    </Form>
  )
}
