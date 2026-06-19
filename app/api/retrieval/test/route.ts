// Test endpoint for the shared retrieval function
// This can be used to verify Phase 2 is working before building Phase 3+
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { retrieveRelevantEmails, formatEmailContext, hasQualityResults } from '@/lib/retrieval'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { query, topK = 5, threshold = 0.7 } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Use the shared retrieval function
    const results = await retrieveRelevantEmails(
      query,
      session.user.id,
      topK,
      threshold
    )

    // Check if results meet quality threshold (hallucination prevention)
    const hasQuality = hasQualityResults(results, threshold)

    // Format as context
    const context = formatEmailContext(results)

    return NextResponse.json({
      success: true,
      query,
      resultsCount: results.length,
      hasQualityResults: hasQuality,
      results: results.map(r => ({
        id: r.id,
        sender: r.sender,
        subject: r.subject,
        received_at: r.received_at,
        similarity: r.similarity,
        preview: r.chunk_text.substring(0, 200) + '...',
      })),
      context, // Full formatted context for LLM
    })
  } catch (error: any) {
    console.error('Retrieval test error:', error)
    return NextResponse.json(
      {
        error: 'Retrieval failed',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
