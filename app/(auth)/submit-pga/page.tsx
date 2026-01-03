'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthCard } from '@/components/auth/auth-card'
import { PublicPgaForm } from '@/components/pga/public-pga-form'

export default function SubmitPgaPage() {
  const [submitted, setSubmitted] = useState(false)

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
        <Button onClick={() => setSubmitted(false)}>Submit Another Entry</Button>
      </motion.div>
    )
  }

  return (
    <AuthCard
      title="Submit PGA Report"
      description="Enter the attendance data for your location"
    >
      <PublicPgaForm onSuccess={() => setSubmitted(true)} />
    </AuthCard>
  )
}
