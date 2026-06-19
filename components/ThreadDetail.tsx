'use client'

import { useState, useEffect } from 'react'
import { EmailCategory, getCategoryColor, getCategoryIcon } from '@/lib/nvidia'
import ReplyModal from './ReplyModal'

interface EmailThread {
  thread_id: string
  email_count: number
  latest_email: any
  all_emails: any[]
}

interface ThreadDetailProps {
  thread: EmailThread
  onClose: () => void
}

export default function ThreadDetail({ thread, onClose }: ThreadDetailProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isReplyOpen, setIsReplyOpen] = useState(false)
  const [isStarred, setIsStarred] = useState(false)
  const [copied, setCopied] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    // Reset state when thread changes
    setSummary(null)
    setIsLoadingSummary(false)
    setSummaryError(null)
    setIsStarred(false)
    setCopied(false)
    
    // Load summary
    loadSummary()
  }, [thread.thread_id])

  async function loadSummary() {
    // Check if any email in thread already has a summary (cached)
    const cachedSummary = thread.all_emails.find(e => e.summary)?.summary
    
    if (cachedSummary) {
      setSummary(cachedSummary)
      return
    }

    // Generate new summary
    setIsLoadingSummary(true)
    setSummaryError(null)
    
    try {
      const response = await fetch('/api/emails/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thread.thread_id }),
      })

      if (!response.ok) throw new Error('Failed to generate summary')

      const data = await response.json()
      setSummary(data.summary)
    } catch (error) {
      console.error('Summary error:', error)
      setSummaryError('Failed to generate summary')
    } finally {
      setIsLoadingSummary(false)
    }
  }

  function formatFullDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function extractSenderName(sender: string): string {
    const match = sender.match(/^([^<]+)/)
    return match ? match[1].trim() : sender
  }

  function extractEmail(emailString: string): string {
    const match = emailString.match(/<(.+?)>/)
    return match ? match[1] : emailString
  }

  // Handle Copy Action
  function handleCopySummary() {
    if (!summary) return
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Action: Archive Thread
  async function handleArchive() {
    setActionLoading(true)
    try {
      await fetch('/api/gmail/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: thread.all_emails.map((e) => e.id),
        }),
      })
      onClose()
    } catch (error) {
      console.error('Archive action failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Delete Thread
  async function handleDelete() {
    if (!confirm('Are you sure you want to move this thread to trash?')) return
    setActionLoading(true)
    try {
      await fetch('/api/gmail/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: thread.all_emails.map((e) => e.id),
          permanent: false,
        }),
      })
      onClose()
    } catch (error) {
      console.error('Delete action failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Star/Unstar Thread
  async function handleToggleStar() {
    setActionLoading(true)
    try {
      await fetch('/api/gmail/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: thread.all_emails.map((e) => e.id),
          star: !isStarred,
        }),
      })
      setIsStarred(!isStarred)
    } catch (error) {
      console.error('Star toggle failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#090d16] h-full overflow-hidden">
      {/* Sticky Header */}
      <div className="px-6 py-4 border-b border-slate-900 bg-[#0b0f19] flex items-center justify-between z-10">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-100 truncate tracking-tight">
            {thread.latest_email.subject || '(No subject)'}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
            <span>{thread.email_count} {thread.email_count === 1 ? 'message' : 'messages'}</span>
            <span>•</span>
            <span>Thread ID: {thread.thread_id}</span>
          </div>
        </div>
        
        {/* Floating Toolbar */}
        <div className="flex items-center gap-1.5 ml-4">
          {/* Toggle Star */}
          <button
            onClick={handleToggleStar}
            disabled={actionLoading}
            className={`p-2 rounded-lg hover:bg-slate-900 border transition-all duration-150 cursor-pointer ${
              isStarred 
                ? 'text-yellow-400 bg-yellow-400/5 border-yellow-500/25' 
                : 'text-slate-400 hover:text-slate-200 border-slate-900'
            }`}
            title="Star thread"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
          
          {/* Archive */}
          <button
            onClick={handleArchive}
            disabled={actionLoading}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-900 rounded-lg transition-colors cursor-pointer"
            title="Archive thread"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 border border-slate-900 rounded-lg transition-colors cursor-pointer"
            title="Delete thread"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-900 mx-1"></div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI Summary Section */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-indigo-900/10 border-b border-slate-900 relative">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">AI Summary</h3>
                {isLoadingSummary && (
                  <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                )}
              </div>
              {summary && (
                <button 
                  onClick={handleCopySummary}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer bg-slate-950/40 hover:bg-slate-950 px-2 py-1 rounded border border-slate-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            
            {isLoadingSummary && !summary && (
              <p className="text-sm text-slate-400 italic">Synthesizing conversation timeline...</p>
            )}
            
            {summaryError && (
              <p className="text-sm text-red-400">{summaryError}</p>
            )}
            
            {summary && (
              <p className="text-sm text-slate-300 leading-relaxed font-sans">{summary}</p>
            )}
          </div>
        </div>
      </div>

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {thread.all_emails.map((email, index) => {
          const senderName = extractSenderName(email.sender)
          const isLatest = index === thread.all_emails.length - 1
          
          return (
            <div key={email.id} className="border border-slate-900 bg-[#0b0f19]/40 rounded-xl overflow-hidden shadow-sm">
              {/* Email header */}
              <div className="px-5 py-4 bg-[#0b0f19]/80 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                    {senderName[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-200">
                      {senderName}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {extractEmail(email.sender)}
                    </div>
                  </div>
                </div>
                
                {/* Meta details */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  {email.category && (
                    <span className={`text-[9px] px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${getCategoryColor(email.category as EmailCategory)}`}>
                      <span>{getCategoryIcon(email.category as EmailCategory)}</span>
                      <span>{email.category}</span>
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {formatFullDate(email.received_at)}
                  </span>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="px-5 py-2 bg-slate-950/20 border-b border-slate-900/40 text-[10px] text-slate-500">
                To: {extractEmail(email.recipient)}
              </div>

              {/* Email body */}
              <div className="px-5 py-5">
                <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed font-sans">
                  {email.body_text || <span className="text-slate-600 italic">(No content)</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply Action Area */}
      <div className="px-6 py-4 border-t border-slate-900 bg-[#0b0f19] flex items-center justify-between gap-4">
        <div className="flex-1 text-slate-500 text-xs truncate">
          Reply to {extractSenderName(thread.latest_email.sender)} using thread history
        </div>
        <button
          onClick={() => setIsReplyOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>Reply with AI</span>
        </button>
      </div>

      {/* Reply Modal */}
      <ReplyModal
        isOpen={isReplyOpen}
        onClose={() => setIsReplyOpen(false)}
        threadId={thread.thread_id}
        replyTo={thread.latest_email.sender}
      />
    </div>
  )
}
