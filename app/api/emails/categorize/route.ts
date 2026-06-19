// Categorize emails using NVIDIA NIM
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { categorizeEmail } from '@/lib/nvidia'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceClient()

    // Get all emails without categories
    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('id, subject, sender, body_text')
      .eq('user_id', session.user.id)
      .is('category', null)

    if (emailsError) throw emailsError

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails to categorize',
        categorized: 0,
      })
    }

    let categorized = 0
    let errors = 0

    // Categorize each email
    for (const email of emails) {
      try {
        const category = await categorizeEmail(
          email.subject || '',
          email.sender || '',
          email.body_text || ''
        )

        // Update email with category
        const { error: updateError } = await supabase
          .from('emails')
          .update({ category })
          .eq('id', email.id)

        if (updateError) {
          console.error('Error updating category:', updateError)
          errors++
        } else {
          categorized++
        }

        // Small delay between requests
        if (categorized + errors < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (emailError) {
        console.error(`Error categorizing email ${email.id}:`, emailError)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      categorized,
      errors,
      message: `Categorized ${categorized} emails${errors > 0 ? ` (${errors} errors)` : ''}`,
    })
  } catch (error: any) {
    console.error('Categorization error:', error)
    return NextResponse.json(
      {
        error: 'Failed to categorize emails',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
