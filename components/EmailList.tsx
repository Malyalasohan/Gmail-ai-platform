'use client'

import { useState, useTransition } from 'react'
import { EmailCategory, getCategoryColor, getCategoryIcon } from '@/lib/nvidia'

interface EmailThread {
  thread_id: string
  email_count: number
  latest_email: any
  all_emails: any[]
}

interface EmailListProps {
  threads: EmailThread[]
  selectedThread: EmailThread | null
  onSelectThread: (thread: EmailThread) => void
  selectedCategory: EmailCategory | 'all'
  onSelectCategory: (category: EmailCategory | 'all') => void
  isLoading: boolean
  error: string | null
}

const categories: Array<EmailCategory | 'all'> = ['all', 'Work', 'Personal', 'Newsletter', 'Action Required', 'Other']

export default function EmailList({
  threads,
  selectedThread,
  onSelectThread,
  selectedCategory,
  onSelectCategory,
  isLoading,
  error,
}: EmailListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [starredThreads, setStarredThreads] = useState<Set<string>>(new Set())
  const [hiddenThreads, setHiddenThreads] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  function extractSenderName(sender: string): string {
    const match = sender.match(/^([^<]+)/)
    return match ? match[1].trim() : sender
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'bg-red-500/20 text-red-400 border-red-500/30',
      'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'bg-green-500/20 text-green-400 border-green-500/30',
      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  function truncate(text: string, maxLength: number): string {
    if (!text) return ''
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  // Handle Quick Star action
  async function handleToggleStar(e: React.MouseEvent, thread: EmailThread) {
    e.stopPropagation()
    const threadId = thread.thread_id
    const isStarred = starredThreads.has(threadId)
    const newStarred = new Set(starredThreads)
    
    if (isStarred) {
      newStarred.delete(threadId)
    } else {
      newStarred.add(threadId)
    }
    setStarredThreads(newStarred)

    try {
      await fetch('/api/gmail/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: thread.all_emails.map((e) => e.id),
          star: !isStarred,
        }),
      })
    } catch (err) {
      console.error('Star toggle failed:', err)
    }
  }

  // Handle Quick Archive action
  async function handleArchive(e: React.MouseEvent, thread: EmailThread) {
    e.stopPropagation()
    const threadId = thread.thread_id
    const newHidden = new Set(hiddenThreads)
    newHidden.add(threadId)
    setHiddenThreads(newHidden)

    try {
      await fetch('/api/gmail/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: thread.all_emails.map((e) => e.id),
        }),
      })
    } catch (err) {
      console.error('Archive failed:', err)
      // Revert UI state on failure
      const reverted = new Set(hiddenThreads)
      reverted.delete(threadId)
      setHiddenThreads(reverted)
    }
  }

  // Handle Quick Delete action
  async function handleDelete(e: React.MouseEvent, thread: EmailThread) {
    e.stopPropagation()
    const threadId = thread.thread_id
    const newHidden = new Set(hiddenThreads)
    newHidden.add(threadId)
    setHiddenThreads(newHidden)

    try {
      await fetch('/api/gmail/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: thread.all_emails.map((e) => e.id),
          permanent: false,
        }),
      })
    } catch (err) {
      console.error('Delete failed:', err)
      // Revert UI state on failure
      const reverted = new Set(hiddenThreads)
      reverted.delete(threadId)
      setHiddenThreads(reverted)
    }
  }

  // Filter threads by search query and category (and exclude locally hidden items)
  const visibleThreads = threads.filter((thread) => {
    if (hiddenThreads.has(thread.thread_id)) return false
    
    const email = thread.latest_email
    const sender = extractSenderName(email.sender).toLowerCase()
    const subject = (email.subject || '').toLowerCase()
    const body = (email.body_text || '').toLowerCase()
    const query = searchQuery.toLowerCase()

    return sender.includes(query) || subject.includes(query) || body.includes(query)
  })

  return (
    <>
      {/* Header with category filters */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-900 bg-[#0b0f19]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Inbox</h1>
          {visibleThreads.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-full">
              {visibleThreads.length}
            </span>
          )}
        </div>
        
        {/* Search input bar */}
        <div className="mb-4 relative">
          <input
            type="text"
            placeholder="Search in inbox..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors focus:outline-none"
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {categories.map((category) => {
            const isSelected = selectedCategory === category
            const isAll = category === 'all'
            
            return (
              <button
                key={category}
                onClick={() => onSelectCategory(category)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isAll
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                      : getCategoryColor(category as EmailCategory) + ' border font-semibold'
                    : 'bg-slate-950 text-slate-400 border border-slate-900 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {!isAll && <span>{getCategoryIcon(category as EmailCategory)}</span>}
                <span>{category === 'all' ? 'All' : category}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto bg-[#0b0f19] divide-y divide-slate-900/40">
        {isLoading && visibleThreads.length === 0 && (
          <div className="p-8 text-center space-y-3">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-xs text-slate-400">Loading your inbox...</p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">⚠️</div>
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {!isLoading && !error && visibleThreads.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <div className="text-3xl">📭</div>
            <h3 className="text-sm font-semibold text-slate-300">Clean Inbox</h3>
            <p className="text-xs text-slate-500">
              {selectedCategory !== 'all' 
                ? `No emails in "${selectedCategory}"`
                : 'All messages read or synced!'
              }
            </p>
          </div>
        )}

        {visibleThreads.map((thread) => {
          const email = thread.latest_email
          const isSelected = selectedThread?.thread_id === thread.thread_id
          const senderName = extractSenderName(email.sender)
          const isStarred = starredThreads.has(thread.thread_id)

          return (
            <div
              key={thread.thread_id}
              onClick={() => onSelectThread(thread)}
              className={`w-full px-4 py-3.5 text-left transition-all cursor-pointer border-l-2 relative group hover:bg-slate-900/40 ${
                isSelected 
                  ? 'bg-blue-600/5 border-l-blue-500' 
                  : 'border-l-transparent hover:border-l-slate-800'
              }`}
            >
              {/* Main Content Flex */}
              <div className="flex gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold border flex-shrink-0 ${getAvatarColor(senderName)}`}>
                  {senderName[0].toUpperCase()}
                </div>

                {/* Text Block */}
                <div className="flex-1 min-w-0">
                  {/* Sender & Date */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 text-xs truncate max-w-[150px]">
                      {senderName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDate(email.received_at)}
                    </span>
                  </div>

                  {/* Subject */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-xs font-medium text-slate-300 truncate flex-1">
                      {email.subject || '(No subject)'}
                    </span>
                    {thread.email_count > 1 && (
                      <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-semibold">
                        {thread.email_count}
                      </span>
                    )}
                  </div>

                  {/* Body & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-400 truncate flex-1 leading-relaxed">
                      {truncate(email.body_text, 60)}
                    </p>
                    {email.category && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${getCategoryColor(email.category as EmailCategory)}`}>
                        <span>{getCategoryIcon(email.category as EmailCategory)}</span>
                        <span>{email.category}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hover Quick Actions */}
              <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 hover:bg-slate-950 p-1 rounded-lg border border-slate-900/60 shadow-lg">
                {/* Star Action */}
                <button
                  onClick={(e) => handleToggleStar(e, thread)}
                  className={`p-1.5 rounded hover:bg-slate-900 transition-colors ${
                    isStarred ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={isStarred ? "Remove Star" : "Star"}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </button>
                {/* Archive Action */}
                <button
                  onClick={(e) => handleArchive(e, thread)}
                  className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-colors"
                  title="Archive"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>
                {/* Delete Action */}
                <button
                  onClick={(e) => handleDelete(e, thread)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

