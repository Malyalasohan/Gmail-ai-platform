/**
 * Retry Engine
 * 
 * Handles retry logic for failed workflow steps with exponential backoff.
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
};

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[RETRY] Attempt ${attempt + 1}/${config.maxRetries + 1}${context ? ` for ${context}` : ''}`);
      
      const result = await fn();
      
      if (attempt > 0) {
        console.log(`[RETRY] Succeeded on attempt ${attempt + 1}${context ? ` for ${context}` : ''}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        console.error(`[RETRY] All attempts failed${context ? ` for ${context}` : ''}:`, error.message);
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        console.log(`[RETRY] Non-retryable error${context ? ` for ${context}` : ''}:`, error.message);
        throw error;
      }

      console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      
      // Wait before retrying
      await sleep(delay);
      
      // Exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // All retries failed
  throw lastError || new Error('Retry failed');
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Rate limit errors (429)
  if (error.message?.includes('429') || error.message?.includes('rate limit')) {
    return true;
  }

  // Network errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
    return true;
  }

  // Temporary server errors (5xx)
  if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
    return true;
  }

  // Gmail API quota errors
  if (error.message?.includes('quotaExceeded') || error.message?.includes('userRateLimitExceeded')) {
    return true;
  }

  // Default: not retryable
  return false;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff and jitter
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  context?: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Exponential backoff: 2^attempt * 1000ms + random jitter
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, 30000); // Max 30 seconds

      console.log(`[RETRY] Waiting ${delay.toFixed(0)}ms before attempt ${attempt + 2}${context ? ` for ${context}` : ''}`);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Batch retry - retry multiple operations with circuit breaker
 */
export async function batchWithRetry<T>(
  operations: (() => Promise<T>)[],
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ successes: T[]; failures: Error[] }> {
  const successes: T[] = [];
  const failures: Error[] = [];
  let consecutiveFailures = 0;
  const circuitBreakerThreshold = 5;

  for (let i = 0; i < operations.length; i++) {
    // Circuit breaker: if too many consecutive failures, stop
    if (consecutiveFailures >= circuitBreakerThreshold) {
      console.error('[RETRY] Circuit breaker triggered, stopping batch');
      failures.push(new Error('Circuit breaker triggered'));
      break;
    }

    try {
      const result = await withRetry(operations[i], config, `batch operation ${i + 1}`);
      successes.push(result);
      consecutiveFailures = 0; // Reset on success
    } catch (error: any) {
      failures.push(error);
      consecutiveFailures++;
    }

    // Rate limiting: small delay between operations
    if (i < operations.length - 1) {
      await sleep(100);
    }
  }

  return { successes, failures };
}

/**
 * Retry with timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<T> {
  return Promise.race([
    withRetry(fn, config, context),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
}
