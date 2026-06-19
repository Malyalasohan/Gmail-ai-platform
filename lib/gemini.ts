// Gemini AI utilities for embeddings and text generation
// Migrated to @google/genai SDK v2.8.0

import { GoogleGenAI } from '@google/genai'

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new GoogleGenAI({ apiKey });
}

// Text generation model
export function getGenerativeModel() {
  return 'gemini-2.0-flash-exp'
}

// Error types for Gemini API
export interface GeminiError {
  isQuotaExceeded: boolean
  originalError: any
  message: string
}

// Check if error is a quota/rate limit error
export function isQuotaExceededError(error: any): boolean {
  if (!error) return false
  
  const errorString = JSON.stringify(error).toLowerCase()
  const message = (error.message || '').toLowerCase()
  const status = error.status || error.statusCode || error.code
  
  // Check for various quota exceeded indicators
  return (
    status === 429 ||
    status === '429' ||
    errorString.includes('resource_exhausted') ||
    errorString.includes('quota') ||
    errorString.includes('rate limit') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit')
  )
}

// Format Gemini error for logging and response
export function formatGeminiError(error: any): GeminiError {
  const isQuota = isQuotaExceededError(error)
  
  return {
    isQuotaExceeded: isQuota,
    originalError: error,
    message: isQuota 
      ? 'AI service is temporarily unavailable due to quota limits.'
      : error.message || 'An unexpected error occurred with the AI service.',
  }
}

// Generate embedding with error handling
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error('Text cannot be empty')
  }

  try {
    const result = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    })

    if (!result.embeddings?.length) {
      throw new Error('No embedding returned')
    }

    const embedding = result.embeddings[0]

    if (!embedding.values) {
      throw new Error('No embedding values returned')
    }

    if (embedding.values.length !== 768) {
      throw new Error(
        `Expected 768 dimensions, got ${embedding.values.length}`
      )
    }

    return embedding.values
  } catch (error: any) {
    // Check if quota exceeded
    if (isQuotaExceededError(error)) {
      console.warn('⚠️ Gemini embedding API quota exceeded')
    } else {
      console.error('❌ Gemini embedding error:', error)
    }
    throw error // Propagate for caller to handle
  }
}

// Generate multiple embeddings
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const embeddings: number[][] = []

  for (const text of texts) {
    embeddings.push(await generateEmbedding(text))
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return embeddings
}

// Chunk email text
export function chunkText(text: string, maxChunkSize = 1000): string[] {
  if (!text.trim()) return []

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (
      current.length &&
      current.length + paragraph.length > maxChunkSize
    ) {
      chunks.push(current.trim())
      current = paragraph
    } else {
      current += (current ? '\n\n' : '') + paragraph
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.length ? chunks : [text.trim()]
}

// Safe wrapper for Gemini generateContent with quota error handling
export async function safeGenerateContent(
  prompt: string,
  contextOrOptions?: string | Record<string, any>
): Promise<{ success: boolean; text?: string; error?: GeminiError }> {
  try {
    // Handle both context string and options object
    const context = typeof contextOrOptions === 'string' ? contextOrOptions : undefined
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: fullPrompt,
    })

    const text = result.text

    if (!text) {
      throw new Error('No text generated')
    }

    return { success: true, text }
  } catch (error: any) {
    const geminiError = formatGeminiError(error)
    
    if (geminiError.isQuotaExceeded) {
      console.warn('⚠️ Gemini API quota exceeded')
    } else {
      console.error('❌ Gemini API error:', error)
    }
    
    return { success: false, error: geminiError }
  }
}

// Legacy generateText function - now uses safeGenerateContent internally
// Throws errors for backward compatibility with existing code
// Note: options parameter is ignored (for backward compatibility with workflow code)
export async function generateText(
  prompt: string,
  contextOrOptions?: string | Record<string, any>
): Promise<string> {
  const result = await safeGenerateContent(prompt, contextOrOptions)
  
  if (!result.success || !result.text) {
    throw result.error?.originalError || new Error('Failed to generate text')
  }
  
  return result.text
}