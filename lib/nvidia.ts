// NVIDIA NIM utilities for email categorization
// Architectural decision: Use NIM for classification (simpler task) vs Gemini for reasoning

const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1'

export type EmailCategory = 'Work' | 'Personal' | 'Newsletter' | 'Action Required' | 'Other'

interface NIMChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Categorize email using NVIDIA NIM
 * Uses a small, efficient model for simple classification task
 */
export async function categorizeEmail(
  subject: string,
  sender: string,
  bodySnippet: string
): Promise<EmailCategory> {
  try {
    const messages: NIMChatMessage[] = [
      {
        role: 'system',
        content: `You are an email classifier. Categorize emails into exactly one of these categories:
- Work: Professional emails, business communications, work-related matters
- Personal: Personal correspondence, friends, family
- Newsletter: Marketing emails, newsletters, promotional content, automated updates
- Action Required: Emails requiring immediate action, responses, or decisions
- Other: Everything else

Respond with ONLY the category name, nothing else.`
      },
      {
        role: 'user',
        content: `From: ${sender}
Subject: ${subject}
Preview: ${bodySnippet.substring(0, 200)}

Category:`
      }
    ]

    const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct', // Efficient model for classification
        messages,
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: 20,
      }),
    })

    if (!response.ok) {
      console.error('NVIDIA NIM error:', await response.text())
      return 'Other' // Fallback category
    }

    const data = await response.json()
    const category = data.choices[0]?.message?.content?.trim()

    // Validate and normalize category
    const validCategories: EmailCategory[] = ['Work', 'Personal', 'Newsletter', 'Action Required', 'Other']
    
    for (const validCat of validCategories) {
      if (category?.toLowerCase().includes(validCat.toLowerCase())) {
        return validCat
      }
    }

    return 'Other' // Fallback if no match
  } catch (error) {
    console.error('Email categorization error:', error)
    return 'Other' // Fallback on error
  }
}

/**
 * Batch categorize multiple emails
 * Includes rate limiting delays
 */
export async function categorizeEmails(
  emails: Array<{ id: string; subject: string; sender: string; body_text: string }>
): Promise<Map<string, EmailCategory>> {
  const categories = new Map<string, EmailCategory>()

  for (const email of emails) {
    const category = await categorizeEmail(
      email.subject,
      email.sender,
      email.body_text
    )
    categories.set(email.id, category)

    // Small delay between requests
    if (categories.size < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return categories
}

/**
 * Get color for category badge
 */
export function getCategoryColor(category: EmailCategory): string {
  const colors: Record<EmailCategory, string> = {
    'Work': 'bg-blue-100 text-blue-700 border-blue-200',
    'Personal': 'bg-purple-100 text-purple-700 border-purple-200',
    'Newsletter': 'bg-gray-100 text-gray-700 border-gray-200',
    'Action Required': 'bg-red-100 text-red-700 border-red-200',
    'Other': 'bg-green-100 text-green-700 border-green-200',
  }
  return colors[category] || colors['Other']
}

/**
 * Get icon for category
 */
export function getCategoryIcon(category: EmailCategory): string {
  const icons: Record<EmailCategory, string> = {
    'Work': '💼',
    'Personal': '👤',
    'Newsletter': '📰',
    'Action Required': '⚡',
    'Other': '📁',
  }
  return icons[category] || icons['Other']
}
