'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import SyncProgress from './SyncProgress'
import EmailList from './EmailList'
import ThreadDetail from './ThreadDetail'
import { EmailCategory } from '@/lib/nvidia'

type SyncStatus = 'idle' | 'syncing' | 'generating-embeddings' | 'categorizing' | 'synced'

interface EmailThread {
  thread_id: string
  email_count: number
  latest_email: any
  all_emails: any[]
}

export default function InboxView() {
  const searchParams = useSearchParams()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<EmailCategory | 'all'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkSyncStatus()
  }, [])

  // Handle thread navigation from chat (via URL param)
  useEffect(() => {
    const threadId = searchParams.get('thread')
    if (threadId && threads.length > 0) {
      const thread = threads.find(t => t.thread_id === threadId)
      if (thread) {
        setSelectedThread(thread)
      }
    }
  }, [searchParams, threads])

  async function checkSyncStatus() {
    try {
      const response = await fetch('/api/emails?limit=1')
      const data = await response.json()
      
      if (data.threads && data.threads.length > 0) {
        setSyncStatus('synced')
        loadEmails()
      } else {
        startSync()
      }
    } catch (error) {
      startSync()
    }
  }

  async function startSync() {
    setSyncStatus('syncing')
    
    try {
      // Step 1: Sync emails
      const syncResponse = await fetch('/api/sync', {
        method: 'POST',
      })

      if (!syncResponse.ok) throw new Error('Sync failed')

      // Step 2: Generate embeddings
      setSyncStatus('generating-embeddings')
      fetch('/api/embeddings/generate', { method: 'POST' })
        .catch(err => console.error('Embedding generation failed:', err))

      // Step 3: Categorize emails
      setSyncStatus('categorizing')
      const catResponse = await fetch('/api/emails/categorize', {
        method: 'POST',
      })

      if (!catResponse.ok) console.error('Categorization failed')

      // Complete
      setSyncStatus('synced')
      loadEmails()
    } catch (error) {
      console.error('Sync error:', error)
      setError('Failed to sync emails. Please try again.')
      setSyncStatus('idle')
    }
  }

  async function loadEmails() {
    setIsLoading(true)
    setError(null)
    
    try {
      const category = selectedCategory === 'all' ? '' : selectedCategory
      const response = await fetch(`/api/emails?category=${category}&limit=50`)
      
      if (!response.ok) throw new Error('Failed to load emails')
      
      const data = await response.json()
      setThreads(data.threads || [])
    } catch (error) {
      console.error('Load emails error:', error)
      setError('Failed to load emails')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (syncStatus === 'synced') {
      loadEmails()
    }
  }, [selectedCategory])

  if (syncStatus === 'syncing') {
    return <SyncProgress 
      synced={0} 
      total={0}
      message="Syncing your inbox..."
      submessage="Fetching your last 150 messages from Gmail API"
    />
  }

  if (syncStatus === 'generating-embeddings') {
    return <SyncProgress 
      synced={0} 
      total={0}
      message="Preparing AI features..."
      submessage="Generating semantic embeddings for search indexing"
    />
  }

  if (syncStatus === 'categorizing') {
    return <SyncProgress 
      synced={0} 
      total={0}
      message="Organizing your inbox..."
      submessage="Running NVIDIA Llama NIM on messages"
    />
  }

  if (syncStatus === 'idle') {
    return (
      <div className="h-full flex items-center justify-center bg-[#090d16]">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto text-blue-500 border border-blue-500/20">
            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100">Welcome to Gmail AI</h2>
            <p className="text-sm text-slate-400">Click below to sync your emails and start utilizing advanced AI features.</p>
          </div>
          {error && (
            <p className="text-red-400 text-xs bg-red-950/20 py-2 px-3 border border-red-900/30 rounded-lg">{error}</p>
          )}
          <button
            onClick={startSync}
            className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-md transition-all cursor-pointer"
          >
            Start Initial Sync
          </button>
        </div>
      </div>
    )
  }

  // Main inbox view
  return (
    <div className="h-full flex bg-[#090d16]">
      {/* Email list */}
      <div className={`flex flex-col bg-[#0b0f19] border-r border-slate-900 transition-all duration-300 ${selectedThread ? 'w-[400px] flex-shrink-0' : 'flex-1'}`}>
        <EmailList
          threads={threads}
          selectedThread={selectedThread}
          onSelectThread={setSelectedThread}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Thread detail */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#090d16]">
          <ThreadDetail
            thread={selectedThread}
            onClose={() => setSelectedThread(null)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 bg-[#090d16]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L4 13" />
              </svg>
            </div>
            <p className="text-sm">Select an email to view details</p>
          </div>
        </div>
      )}
    </div>
  )
}

