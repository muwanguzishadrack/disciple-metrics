'use client'

import { useState } from 'react'
import { AuthCard } from '@/components/auth/auth-card'
import { PublicPgaForm } from '@/components/pga/public-pga-form'

export default function SubmitPgaPage() {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    // Success screen without AuthCard wrapper (no duplicate title)
    return (
      <div className="w-full">
        <PublicPgaForm
          onSuccess={() => setSubmitted(true)}
          onReset={() => setSubmitted(false)}
        />
      </div>
    )
  }

  return (
    <AuthCard
      title="Submit PGA Report"
      description="Enter the attendance data for your location"
    >
      <PublicPgaForm
        onSuccess={() => setSubmitted(true)}
        onReset={() => setSubmitted(false)}
      />
    </AuthCard>
  )
}
