// SHARED RETRIEVAL FUNCTION — Built once in Phase 2, reused across Phases 3, 4, 5, 6

import { createServiceClient } from './supabase/server'
import { generateEmbedding } from './ai-provider'

export interface RetrievedEmail {
  id: string
  gmail_message_id: string
  thread_id: string
  sender: string
  recipient: string
  subject: string
  body_text: string
  received_at: string
  category: string | null
  similarity: number
  chunk_text: string
}

export async function retrieveRelevantEmails(
  query: string,
  userId: string,
  topK: number = 10,
  similarityThreshold: number = 0.4
): Promise<RetrievedEmail[]> {
  const supabase = createServiceClient()

  try {
    console.log("===================================")
    console.log("RAG SEARCH START")
    console.log("Query:", query)
    console.log("User:", userId)
    console.log("TopK:", topK)
    console.log("Similarity:", similarityThreshold)

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)

    console.log("Embedding Length:", queryEmbedding.length)
    console.log("Embedding Sample:", queryEmbedding.slice(0, 5))

    const { data, error } = await supabase.rpc("search_emails", {
      query_embedding: queryEmbedding,
      match_threshold: 1 - similarityThreshold,
      match_count: topK,
      user_id_param: userId,
    })

    console.log("RPC ERROR:", error)
    console.log("RPC DATA COUNT:", data?.length ?? 0)

    if (data && data.length > 0) {
      console.log("Unique Emails Retrieved:")
      data.forEach((email: any, index: number) => {
        console.log(
          `${index + 1}. ${email.subject} | Similarity: ${email.similarity.toFixed(2)}`
        )
      })
    } else {
      console.log("No results found")
    }

    console.log("===================================")

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Retrieval error:", error)
    throw error
  }
}

export async function retrieveThreadEmails(
  threadId: string,
  userId: string
): Promise<RetrievedEmail[]> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .order("received_at", { ascending: true })

    if (error) throw error

    return (data || []).map((email: any) => ({
      ...email,
      similarity: 1,
      chunk_text: email.body_text,
    }))
  } catch (error) {
    console.error("Thread retrieval error:", error)
    throw error
  }
}

export function hasQualityResults(
  results: RetrievedEmail[],
  minSimilarity: number = 0.4
): boolean {
  if (!results || results.length === 0) return false

  console.log(
    "Best Similarity:",
    results[0].similarity,
    "Threshold:",
    minSimilarity
  )

  return results[0].similarity >= minSimilarity
}

export function formatEmailContext(
  emails: RetrievedEmail[],
  includeBody: boolean = true
): string {
  return emails
    .map((email, index) => {
      const header = `[Email ${index + 1}]
From: ${email.sender}
To: ${email.recipient}
Subject: ${email.subject}
Date: ${new Date(email.received_at).toLocaleString()}
${email.category ? `Category: ${email.category}` : ""}`

      const body = includeBody
        ? `\n\n${email.chunk_text || email.body_text}`
        : ""

      return header + body
    })
    .join("\n\n-------------------------\n\n")
}