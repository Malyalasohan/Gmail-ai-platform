// Production-safe job manager using database-backed locks
// Works across multiple server instances, handles stale jobs, and persists state

import { createServiceClient } from './supabase/server'

const STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

export type JobType = 'sync' | 'embedding'
export type JobStatus = 'running' | 'completed' | 'failed'

export interface BackgroundJob {
  id: string
  user_id: string
  job_type: JobType
  status: JobStatus
  started_at: string
  updated_at: string
  error_message?: string
  metadata?: Record<string, any>
}

class JobManager {
  private supabase = createServiceClient()

  /**
   * Check if a job can start (no running job exists)
   */
  async canStartJob(userId: string, jobType: JobType): Promise<boolean> {
    try {
      // Clean up stale jobs first
      await this.cleanupStaleJobs(userId, jobType)

      // Check for running jobs
      const { data, error } = await this.supabase
        .from('background_jobs')
        .select('id, started_at')
        .eq('user_id', userId)
        .eq('job_type', jobType)
        .eq('status', 'running')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (which is good)
        console.error('Error checking job status:', error)
        return false
      }

      return !data // Can start if no running job found
    } catch (error) {
      console.error('Error in canStartJob:', error)
      return false
    }
  }

  /**
   * Start a new job
   */
  async startJob(
    userId: string,
    jobType: JobType,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    try {
      // Double-check we can start
      const canStart = await this.canStartJob(userId, jobType)
      if (!canStart) {
        console.log(`Job ${jobType} already running for user ${userId}`)
        return null
      }

      // Create new job
      const { data, error } = await this.supabase
        .from('background_jobs')
        .insert({
          user_id: userId,
          job_type: jobType,
          status: 'running',
          metadata,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error starting job:', error)
        return null
      }

      console.log(`✅ Started ${jobType} job ${data.id} for user ${userId}`)
      return data.id
    } catch (error) {
      console.error('Error in startJob:', error)
      return null
    }
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('background_jobs')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      if (error) {
        console.error('Error completing job:', error)
      } else {
        console.log(`✅ Completed job ${jobId}`)
      }
    } catch (error) {
      console.error('Error in completeJob:', error)
    }
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('background_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      if (error) {
        console.error('Error failing job:', error)
      } else {
        console.log(`❌ Failed job ${jobId}: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error in failJob:', error)
    }
  }

  /**
   * Update job progress (keeps it alive)
   */
  async updateJobProgress(
    jobId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('background_jobs')
        .update({
          updated_at: new Date().toISOString(),
          metadata,
        })
        .eq('id', jobId)

      if (error) {
        console.error('Error updating job progress:', error)
      }
    } catch (error) {
      console.error('Error in updateJobProgress:', error)
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(
    userId: string,
    jobType: JobType
  ): Promise<BackgroundJob | null> {
    try {
      const { data, error } = await this.supabase
        .from('background_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('job_type', jobType)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting job status:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getJobStatus:', error)
      return null
    }
  }

  /**
   * Clean up stale jobs (older than 30 minutes and still "running")
   */
  private async cleanupStaleJobs(
    userId: string,
    jobType: JobType
  ): Promise<void> {
    try {
      const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS)

      const { error } = await this.supabase
        .from('background_jobs')
        .update({
          status: 'failed',
          error_message: 'Job marked as stale (exceeded 30 minute timeout)',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('job_type', jobType)
        .eq('status', 'running')
        .lt('updated_at', staleThreshold.toISOString())

      if (error) {
        console.error('Error cleaning up stale jobs:', error)
      }
    } catch (error) {
      console.error('Error in cleanupStaleJobs:', error)
    }
  }

  /**
   * Convenience methods for sync jobs
   */
  async canStartSync(userId: string): Promise<boolean> {
    return this.canStartJob(userId, 'sync')
  }

  async startSync(userId: string): Promise<string | null> {
    return this.startJob(userId, 'sync')
  }

  async completeSync(jobId: string): Promise<void> {
    return this.completeJob(jobId)
  }

  async failSync(jobId: string, error: string): Promise<void> {
    return this.failJob(jobId, error)
  }

  /**
   * Convenience methods for embedding jobs
   */
  async canStartEmbedding(userId: string): Promise<boolean> {
    return this.canStartJob(userId, 'embedding')
  }

  async startEmbedding(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    return this.startJob(userId, 'embedding', metadata)
  }

  async completeEmbedding(jobId: string): Promise<void> {
    return this.completeJob(jobId)
  }

  async failEmbedding(jobId: string, error: string): Promise<void> {
    return this.failJob(jobId, error)
  }

  async updateEmbeddingProgress(
    jobId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    return this.updateJobProgress(jobId, metadata)
  }
}

// Singleton instance
export const jobManager = new JobManager()

