// Generate embeddings for synced emails with job locking and quota management
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { chunkText, generateEmbedding, isQuotaExceededError } from '@/lib/ai-provider'
import { jobManager } from '@/lib/job-manager'

// Exponential backoff configuration
const RETRY_DELAYS = [5000, 10000, 20000, 40000, 60000] // milliseconds
const MAX_RETRIES = 5

async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  emailId: string,
  attempt: number = 0
): Promise<T | null> {
  try {
    return await fn()
  } catch (error: any) {
    const is429 = isQuotaExceededError(error)

    if (!is429 || attempt >= MAX_RETRIES) {
      console.error(`❌ Failed email ${emailId} after ${attempt} retries:`, error.message)
      return null // Skip this email, don't fail entire job
    }

    const delay = RETRY_DELAYS[attempt]
    const jitter = Math.random() * 2000 // 0-2 seconds jitter
    const totalDelay = delay + jitter

    console.log(
      `⚠️  Retry ${attempt + 1}/${MAX_RETRIES} for email ${emailId} - waiting ${Math.round(totalDelay / 1000)}s`
    )

    await new Promise((resolve) => setTimeout(resolve, totalDelay))

    return retryWithExponentialBackoff(fn, emailId, attempt + 1)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userId = ''
  let jobId: string | null = null
  
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    userId = session.user.id

    // Check if embedding job is already running
    const canStart = await jobManager.canStartEmbedding(userId)
    if (!canStart) {
      const status = await jobManager.getJobStatus(userId, 'embedding')
      return NextResponse.json({
        success: true,
        message: 'Embedding generation already in progress',
        startedAt: status?.started_at,
      })
    }

    // Acquire database lock
    jobId = await jobManager.startEmbedding(userId)
    if (!jobId) {
      return NextResponse.json({
        success: true,
        message: 'Embedding generation already in progress',
      })
    }

    console.log('🚀 Embedding Job Started')

    const supabase = createServiceClient()

    // Get ALL emails first
    const { data: allEmails, error: emailsError } = await supabase
      .from('emails')
      .select('id, subject, body_text')
      .eq('user_id', userId)
      .not('body_text', 'is', null)
      .order('created_at', { ascending: true }) // Process oldest first

    if (emailsError) throw emailsError

    if (!allEmails || allEmails.length === 0) {
      await jobManager.completeEmbedding(jobId)
      console.log('✅ Embedding Job Completed - No emails found')
      return NextResponse.json({
        success: true,
        message: 'No emails to process',
        processed: 0,
      })
    }

    // Check which emails ALREADY HAVE embeddings (critical for deduplication)
    const { data: existingEmbeddings } = await supabase
      .from('email_embeddings')
      .select('email_id')
      .in('email_id', allEmails.map(e => e.id))

    const existingEmailIds = new Set(
      existingEmbeddings?.map((e) => e.email_id) || []
    )

    // Filter to ONLY emails without any embeddings
    const emailsToProcess = allEmails.filter(
      (email) => !existingEmailIds.has(email.id)
    )

    console.log(`📊 Total emails: ${allEmails.length}`)
    console.log(`✓ Already embedded: ${existingEmailIds.size}`)
    console.log(`⏳ To process: ${emailsToProcess.length}`)

    if (emailsToProcess.length === 0) {
      await jobManager.completeEmbedding(jobId)
      console.log('✅ Embedding Job Completed - All emails already have embeddings')
      return NextResponse.json({
        success: true,
        message: 'All emails already have embeddings',
        processed: 0,
        skipped: existingEmailIds.size,
      })
    }

    let processed = 0
    let skipped = 0
    let failed = 0
    let totalChunks = 0
    let totalApiCalls = 0

    // Process ONLY 2 emails per batch
    const EMAIL_BATCH_SIZE = 2
    const BATCH_DELAY = 10000 // 10 seconds between batches
    const EMBEDDING_DELAY = 1000 // 1 second between each embedding

    const totalBatches = Math.ceil(emailsToProcess.length / EMAIL_BATCH_SIZE)

    for (let i = 0; i < emailsToProcess.length; i += EMAIL_BATCH_SIZE) {
      const emailBatch = emailsToProcess.slice(i, i + EMAIL_BATCH_SIZE)
      const currentBatch = Math.floor(i / EMAIL_BATCH_SIZE) + 1

      console.log(`\n📦 Batch ${currentBatch}/${totalBatches} (${emailBatch.length} emails)`)

      // Process each email SEQUENTIALLY (never parallel)
      for (const email of emailBatch) {
        const emailIndex = i + emailBatch.indexOf(email) + 1

        // Double-check this email still needs embeddings (in case of restart)
        const { data: recheckEmbedding } = await supabase
          .from('email_embeddings')
          .select('email_id')
          .eq('email_id', email.id)
          .limit(1)

        if (recheckEmbedding && recheckEmbedding.length > 0) {
          console.log(`⏭️  Email ${emailIndex}/${emailsToProcess.length} - Already embedded (skipping)`)
          skipped++
          continue
        }

        console.log(`📧 Processing Email ${emailIndex}/${emailsToProcess.length}`)

        try {
          // Combine subject and body
          const fullText = `${email.subject || ''}\n\n${email.body_text || ''}`

          // Chunk the text
          const chunks = chunkText(fullText)

          if (chunks.length === 0) {
            console.log(`⏭️  Email ${email.id} - No valid chunks (skipping)`)
            skipped++
            continue
          }

          console.log(`   📝 ${chunks.length} chunks to process`)

          // Process each chunk SEQUENTIALLY with retry
          let chunksFailed = 0
          for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            const chunk = chunks[chunkIdx]

            const embedding = await retryWithExponentialBackoff(
              async () => {
                totalApiCalls++
                return await generateEmbedding(chunk)
              },
              email.id,
              0
            )

            if (!embedding) {
              chunksFailed++
              continue
            }

            // Store embedding
            const { error: insertError } = await supabase
              .from('email_embeddings')
              .insert({
                email_id: email.id,
                chunk_text: chunk,
                embedding: embedding,
              })

            if (insertError) {
              console.error(`   ❌ Failed to insert chunk ${chunkIdx + 1}:`, insertError.message)
              chunksFailed++
            } else {
              totalChunks++
            }

            // Wait 1 second between embeddings (critical for quota)
            if (chunkIdx < chunks.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, EMBEDDING_DELAY))
            }
          }

          if (chunksFailed === 0) {
            processed++
            console.log(`   ✅ Email ${email.id} completed (${chunks.length} chunks)`)
          } else if (chunksFailed < chunks.length) {
            processed++
            console.log(
              `   ⚠️  Email ${email.id} partially completed (${chunks.length - chunksFailed}/${chunks.length} chunks)`
            )
          } else {
            failed++
            console.log(`   ❌ Email ${email.id} failed (all chunks failed)`)
          }
        } catch (emailError: any) {
          console.error(`   ❌ Email ${email.id} error:`, emailError.message)
          failed++
        }
      }

      // Wait 10 seconds between batches (unless this is the last batch)
      if (i + EMAIL_BATCH_SIZE < emailsToProcess.length) {
        console.log(`⏸️  Waiting 10 seconds before next batch...`)
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000)

    console.log('\n✅ Embedding Job Completed')
    console.log(`📊 Statistics:`)
    console.log(`   - Total Emails Processed: ${processed}`)
    console.log(`   - Total Emails Skipped: ${skipped}`)
    console.log(`   - Total Emails Failed: ${failed}`)
    console.log(`   - Total Chunks Embedded: ${totalChunks}`)
    console.log(`   - Total API Calls: ${totalApiCalls}`)
    console.log(`   - Total Duration: ${duration}s`)

    await jobManager.completeEmbedding(jobId)

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      failed,
      totalChunks,
      totalApiCalls,
      duration,
      message: `Generated embeddings for ${processed} emails (${totalChunks} chunks, ${failed} failed)`,
    })
  } catch (error: any) {
    console.error('💥 Embedding generation error:', error)
    if (jobId) {
      await jobManager.failEmbedding(jobId, error.message || 'Unknown error')
    }
    return NextResponse.json(
      {
        error: 'Failed to generate embeddings',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
