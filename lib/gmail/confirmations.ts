// Gmail Action Confirmation State Manager — Phase 4
// Manages pending confirmations for dangerous actions

import { ActionIntent } from './actions'

interface PendingConfirmation {
  userId: string
  action: ActionIntent
  emailIds: string[]
  timestamp: number
  expiresAt: number
}

// In-memory storage for pending confirmations
// In production, consider using Redis or database
const pendingConfirmations = new Map<string, PendingConfirmation>()

const CONFIRMATION_TIMEOUT = 5 * 60 * 1000 // 5 minutes

/**
 * Store a pending confirmation
 */
export function storePendingConfirmation(
  userId: string,
  action: ActionIntent,
  emailIds: string[]
): void {
  const now = Date.now()

  pendingConfirmations.set(userId, {
    userId,
    action,
    emailIds,
    timestamp: now,
    expiresAt: now + CONFIRMATION_TIMEOUT,
  })

  console.log('========== PENDING CONFIRMATION ==========')
  console.log('User:', userId)
  console.log('Action:', action.type)
  console.log('Email Count:', emailIds.length)
  console.log('Expires In:', CONFIRMATION_TIMEOUT / 1000, 'seconds')
  console.log('==========================================')
}

/**
 * Retrieve and remove pending confirmation
 */
export function getPendingConfirmation(
  userId: string
): PendingConfirmation | null {
  const pending = pendingConfirmations.get(userId)

  if (!pending) {
    return null
  }

  // Check if expired
  if (Date.now() > pending.expiresAt) {
    pendingConfirmations.delete(userId)
    console.log('Confirmation expired for user:', userId)
    return null
  }

  // Remove from storage (one-time use)
  pendingConfirmations.delete(userId)

  console.log('========== CONFIRMATION RETRIEVED ==========')
  console.log('User:', userId)
  console.log('Action:', pending.action.type)
  console.log('Email Count:', pending.emailIds.length)
  console.log('============================================')

  return pending
}

/**
 * Cancel pending confirmation
 */
export function cancelPendingConfirmation(userId: string): boolean {
  const had = pendingConfirmations.has(userId)
  pendingConfirmations.delete(userId)

  if (had) {
    console.log('========== CONFIRMATION CANCELLED ==========')
    console.log('User:', userId)
    console.log('============================================')
  }

  return had
}

/**
 * Check if user has pending confirmation
 */
export function hasPendingConfirmation(userId: string): boolean {
  const pending = pendingConfirmations.get(userId)

  if (!pending) {
    return false
  }

  // Check if expired
  if (Date.now() > pending.expiresAt) {
    pendingConfirmations.delete(userId)
    return false
  }

  return true
}

/**
 * Clean up expired confirmations (call periodically)
 */
export function cleanupExpiredConfirmations(): void {
  const now = Date.now()
  let cleaned = 0

  for (const [userId, pending] of pendingConfirmations.entries()) {
    if (now > pending.expiresAt) {
      pendingConfirmations.delete(userId)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired confirmations`)
  }
}

// Auto-cleanup every minute
setInterval(cleanupExpiredConfirmations, 60 * 1000)
