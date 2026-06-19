// Centralized AI Provider with Gemini (primary) and NVIDIA NIM (fallback)
// Using REST API directly to support AQ.-prefixed authorization keys

// ========== AI PROVIDER CONFIGURATION ==========
// Lazy initialization - env vars read only when functions are called
function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY
}

function getNvidiaApiKey(): string | undefined {
  return process.env.NVIDIA_NIM_API_KEY
}

// Gemini REST API endpoints
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'

// NVIDIA NIM model configuration - CORRECTED ENDPOINT
const NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct' // Updated to available model
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

// ========== ERROR DETECTION ==========

/**
 * Check if error indicates Gemini is unavailable (quota, rate limit, timeout, 5xx)
 */
export function isGeminiUnavailable(error: any): boolean {
  if (!error) return false
  
  const errorString = JSON.stringify(error).toLowerCase()
  const message = (error.message || '').toLowerCase()
  const status = error.status || error.statusCode || error.code
  
  // Check for quota exceeded
  const isQuota = (
    status === 429 ||
    status === '429' ||
    errorString.includes('resource_exhausted') ||
    errorString.includes('quota') ||
    errorString.includes('rate limit') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit')
  )
  
  // Check for server errors (5xx)
  const isServerError = (
    typeof status === 'number' && status >= 500 && status < 600
  )
  
  // Check for timeout
  const isTimeout = (
    errorString.includes('timeout') ||
    errorString.includes('econnreset') ||
    errorString.includes('econnrefused') ||
    message.includes('timeout')
  )
  
  return isQuota || isServerError || isTimeout
}

/**
 * Format error for logging
 */
export function formatAIError(error: any, provider: 'gemini' | 'nvidia'): string {
  const status = error.status || error.statusCode || error.code
  const message = error.message || 'Unknown error'
  
  if (isGeminiUnavailable(error)) {
    return `${provider} unavailable: ${status || 'unknown'} - ${message}`
  }
  
  return `${provider} error: ${message}`
}

// ========== NVIDIA NIM PROVIDER ==========

/**
 * Call NVIDIA NIM API
 */
async function callNvidiaNIM(prompt: string): Promise<string> {
  const NVIDIA_NIM_API_KEY = getNvidiaApiKey()
  
  if (!NVIDIA_NIM_API_KEY) {
    throw new Error('NVIDIA_NIM_API_KEY not configured')
  }
  
  console.log('🔄 Calling NVIDIA NIM fallback...')
  
  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      top_p: 1,
      max_tokens: 1024,
      stream: false,
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ NVIDIA NIM API error:', response.status, errorText)
    throw new Error(`NVIDIA NIM API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('NVIDIA NIM returned no content')
  }
  
  console.log('✅ NVIDIA NIM response received')
  
  return data.choices[0].message.content
}

// ========== GEMINI REST API CALLS ==========

/**
 * Call Gemini REST API directly (supports AQ. authorization keys)
 */
async function callGeminiAPI(prompt: string): Promise<string> {
  const GEMINI_API_KEY = getGeminiApiKey()
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  console.log('🤖 Calling Gemini REST API...')
  console.log('📝 Model:', GEMINI_MODEL)
  console.log('📝 Prompt length:', prompt.length)
  console.log('📝 Auth Method: x-goog-api-key header (supports AQ. keys)')

  const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Gemini API error:', response.status, errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Gemini returned no text')
  }

  console.log('✅ Gemini response received')

  return data.candidates[0].content.parts[0].text
}

/**
 * Call Gemini Embedding API directly (supports AQ. authorization keys)
 */
async function callGeminiEmbeddingAPI(text: string): Promise<number[]> {
  const GEMINI_API_KEY = getGeminiApiKey()
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  console.log('🔍 Calling Gemini Embedding API...')
  console.log('📝 Model:', GEMINI_EMBEDDING_MODEL)
  console.log('📝 Text length:', text.length)
  console.log('📝 Auth Method: x-goog-api-key header (supports AQ. keys)')

  const url = `${GEMINI_BASE_URL}/models/${GEMINI_EMBEDDING_MODEL}:embedContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      content: {
        parts: [{
          text: text
        }]
      },
      outputDimensionality: 768,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Gemini Embedding API error:', response.status, errorText)
    throw new Error(`Gemini Embedding API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (!data.embedding?.values) {
    throw new Error('No embedding values returned')
  }

  if (data.embedding.values.length !== 768) {
    throw new Error(`Expected 768 dimensions, got ${data.embedding.values.length}`)
  }

  console.log('✅ Embedding generated successfully')

  return data.embedding.values
}

// ========== UNIFIED AI INTERFACE ==========

export interface AIResponse {
  success: boolean
  text?: string
  provider?: 'gemini' | 'nvidia'
  error?: {
    message: string
    originalError: any
    isGeminiUnavailable: boolean
  }
}

/**
 * Generate content with automatic Gemini → NVIDIA fallback
 * 
 * Flow:
 * 1. Try Gemini (primary)
 * 2. If Gemini fails with quota/rate limit/timeout/5xx, try NVIDIA NIM
 * 3. If both fail, return error
 */
export async function generateContent(prompt: string): Promise<AIResponse> {
  const GEMINI_API_KEY = getGeminiApiKey()
  const NVIDIA_NIM_API_KEY = getNvidiaApiKey()
  
  // Try Gemini first
  if (GEMINI_API_KEY) {
    try {
      const text = await callGeminiAPI(prompt)
      
      return {
        success: true,
        text,
        provider: 'gemini',
      }
    } catch (error: any) {
      console.error('❌ Gemini error:', formatAIError(error, 'gemini'))
      console.error('❌ Full error object:', JSON.stringify(error, null, 2))
      
      // Check if we should fallback to NVIDIA
      if (isGeminiUnavailable(error) && NVIDIA_NIM_API_KEY) {
        console.log('⚠️ Gemini unavailable, falling back to NVIDIA NIM...')
        
        try {
          const nvidiaText = await callNvidiaNIM(prompt)
          
          return {
            success: true,
            text: nvidiaText,
            provider: 'nvidia',
          }
        } catch (nvidiaError: any) {
          console.error('❌ NVIDIA NIM error:', formatAIError(nvidiaError, 'nvidia'))
          
          return {
            success: false,
            error: {
              message: 'Both AI providers failed. Please try again later.',
              originalError: nvidiaError,
              isGeminiUnavailable: true,
            },
          }
        }
      }
      
      // Not a fallback-worthy error or no NVIDIA key
      return {
        success: false,
        error: {
          message: error.message || 'Failed to generate content',
          originalError: error,
          isGeminiUnavailable: isGeminiUnavailable(error),
        },
      }
    }
  }
  
  // No Gemini configured, try NVIDIA directly
  if (NVIDIA_NIM_API_KEY) {
    console.log('⚠️ Gemini not configured, using NVIDIA NIM...')
    
    try {
      const text = await callNvidiaNIM(prompt)
      
      return {
        success: true,
        text,
        provider: 'nvidia',
      }
    } catch (error: any) {
      console.error('❌ NVIDIA NIM error:', formatAIError(error, 'nvidia'))
      
      return {
        success: false,
        error: {
          message: error.message || 'Failed to generate content',
          originalError: error,
          isGeminiUnavailable: false,
        },
      }
    }
  }
  
  // No AI providers configured
  return {
    success: false,
    error: {
      message: 'No AI providers configured',
      originalError: new Error('GEMINI_API_KEY and NVIDIA_NIM_API_KEY are both missing'),
      isGeminiUnavailable: false,
    },
  }
}

/**
 * Legacy wrapper for backward compatibility with gemini.ts
 * Maintains the same interface as safeGenerateContent
 */
export async function safeGenerateContent(
  prompt: string,
  contextOrOptions?: string | Record<string, any>
): Promise<{ success: boolean; text?: string; error?: any }> {
  // Handle both context string and options object
  const context = typeof contextOrOptions === 'string' ? contextOrOptions : undefined
  const fullPrompt = context ? `${context}\n\n${prompt}` : prompt
  
  const result = await generateContent(fullPrompt)
  
  if (result.provider) {
    console.log(`📊 AI Provider used: ${result.provider.toUpperCase()}`)
  }
  
  return {
    success: result.success,
    text: result.text,
    error: result.error,
  }
}

/**
 * Legacy wrapper that throws errors (for backward compatibility)
 */
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

/**
 * Check if error indicates AI is unavailable
 * Exported for use in route handlers
 */
export function isQuotaExceededError(error: any): boolean {
  return isGeminiUnavailable(error)
}

// ========== EMBEDDING SUPPORT (Gemini only) ==========

/**
 * Generate embedding (no fallback - embeddings are Gemini-specific)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error('Text cannot be empty')
  }
  
  const GEMINI_API_KEY = getGeminiApiKey()
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured - embeddings require Gemini')
  }

  try {
    return await callGeminiEmbeddingAPI(text)
  } catch (error: any) {
    if (isGeminiUnavailable(error)) {
      console.warn('⚠️ Gemini embedding API unavailable')
    } else {
      console.error('❌ Gemini embedding error:', error)
    }
    console.error('❌ Full embedding error object:', JSON.stringify(error, null, 2))
    throw error
  }
}

/**
 * Generate multiple embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (const text of texts) {
    embeddings.push(await generateEmbedding(text))
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return embeddings
}

/**
 * Chunk text for embeddings
 */
export function chunkText(text: string, maxChunkSize = 1000): string[] {
  if (!text.trim()) return []

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (current.length && current.length + paragraph.length > maxChunkSize) {
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

/**
 * Get the text generation model name
 */
export function getGenerativeModel(): string {
  return GEMINI_MODEL
}
