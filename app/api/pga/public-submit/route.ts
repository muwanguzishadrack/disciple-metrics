import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicPgaSubmissionSchema } from '@/lib/validations/pga'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const result = publicPgaSubmissionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { accessCode, date, locationId, sv1, sv2, yxp, kids, local, hc1, hc2 } = result.data

    // Validate PIN
    const validPin = process.env.PGA_SUBMISSION_PIN
    if (!validPin || accessCode !== validPin) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()

    // Verify location exists
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .single()

    if (locationError || !location) {
      return NextResponse.json(
        { error: 'Invalid location' },
        { status: 400 }
      )
    }

    // Get or create report for this date
    let reportId: string

    const { data: existingReport } = await supabase
      .from('pga_reports')
      .select('id')
      .eq('date', date)
      .maybeSingle()

    if (existingReport?.id) {
      reportId = existingReport.id
    } else {
      const { data: newReport, error: reportError } = await supabase
        .from('pga_reports')
        .insert({
          date,
          created_by: null, // Anonymous submission
        })
        .select('id')
        .single()

      if (reportError || !newReport) {
        console.error('Failed to create report:', reportError)
        return NextResponse.json(
          { error: 'Failed to create report' },
          { status: 500 }
        )
      }
      reportId = newReport.id
    }

    // Check for existing entry (prevent duplicates for same date + location)
    const { data: existingEntry } = await supabase
      .from('pga_entries')
      .select('id')
      .eq('report_id', reportId)
      .eq('location_id', locationId)
      .maybeSingle()

    if (existingEntry) {
      return NextResponse.json(
        { error: 'An entry already exists for this date and location' },
        { status: 409 }
      )
    }

    // Create the entry
    const { error: entryError } = await supabase
      .from('pga_entries')
      .insert({
        report_id: reportId,
        location_id: locationId,
        sv1,
        sv2,
        yxp,
        kids,
        local,
        hc1,
        hc2,
        created_by: null, // Anonymous submission
      })

    if (entryError) {
      console.error('Failed to create entry:', entryError)
      return NextResponse.json(
        { error: 'Failed to create entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Public PGA submission error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
