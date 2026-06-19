'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  source_email_ids?: string[]
  sources?: EmailSource[]
  created_at: string
}

interface EmailSource {
  id: string
  sender: string
  subject: string
  received_at: string
  similarity?: number
  thread_id: string
}

interface LocalConversation {
  id: string
  title: string
  isPinned: boolean
  messageIds: string[]
  created_at: string
}

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<LocalConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string>('default')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Load chat history and local conversations on mount
  useEffect(() => {
    loadChatHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeConvId])

  async function loadChatHistory() {
    try {
      const response = await fetch('/api/chat')
      if (!response.ok) throw new Error('Failed to load chat history')
      
      const data = await response.json()
      const allMsgs: ChatMessage[] = data.messages || []
      
      // Load conversations from local storage
      const savedConvs = localStorage.getItem('gmail_ai_conversations')
      let convList: LocalConversation[] = savedConvs ? JSON.parse(savedConvs) : []

      // If no local conversations exist but we have database messages, perform time-based auto-segmentation
      if (convList.length === 0 && allMsgs.length > 0) {
        convList = segmentMessagesIntoConversations(allMsgs)
      } else {
        // Clean up: make sure messageIds actually exist in allMsgs (filter out deleted or missing)
        const allMsgIds = new Set(allMsgs.map(m => m.id))
        convList = convList.map(c => ({
          ...c,
          messageIds: c.messageIds.filter(id => allMsgIds.has(id))
        })).filter(c => c.messageIds.length > 0)

        // Find any messages that aren't grouped yet and group them in a default conversation
        const groupedIds = new Set(convList.flatMap(c => c.messageIds))
        const ungroupedMsgs = allMsgs.filter(m => !groupedIds.has(m.id))
        if (ungroupedMsgs.length > 0) {
          const ungroupedConvs = segmentMessagesIntoConversations(ungroupedMsgs)
          convList = [...convList, ...ungroupedConvs]
        }
      }

      // Sort conversations: pinned first, then by latest message date
      sortAndSaveConversations(convList)
      setMessages(allMsgs)
      
      // Select the first conversation as active if none is set
      if (convList.length > 0) {
        setActiveConvId(convList[0].id)
      } else {
        setActiveConvId('default')
      }
    } catch (err) {
      console.error('Load chat history error:', err)
    }
  }

  // Segment a list of messages into conversation chunks (if local storage is empty)
  function segmentMessagesIntoConversations(msgs: ChatMessage[]): LocalConversation[] {
    const segments: LocalConversation[] = []
    let currentChunk: string[] = []
    let chunkStart: Date | null = null

    msgs.forEach((msg, idx) => {
      const msgDate = new Date(msg.created_at)
      
      // Split conversation if there's a gap of more than 30 minutes
      if (!chunkStart || (msgDate.getTime() - chunkStart.getTime()) < 30 * 60 * 1000) {
        currentChunk.push(msg.id)
        if (!chunkStart) chunkStart = msgDate
      } else {
        const firstMsg = msgs.find(m => m.id === currentChunk[0])
        segments.push({
          id: 'conv-' + firstMsg?.id || Date.now().toString(),
          title: generateConvTitle(firstMsg?.content || 'Previous Chat'),
          isPinned: false,
          messageIds: currentChunk,
          created_at: firstMsg?.created_at || new Date().toISOString()
        })
        currentChunk = [msg.id]
        chunkStart = msgDate
      }

      // Handle final element
      if (idx === msgs.length - 1 && currentChunk.length > 0) {
        const firstMsg = msgs.find(m => m.id === currentChunk[0])
        segments.push({
          id: 'conv-' + firstMsg?.id || Date.now().toString(),
          title: generateConvTitle(firstMsg?.content || 'Previous Chat'),
          isPinned: false,
          messageIds: currentChunk,
          created_at: firstMsg?.created_at || new Date().toISOString()
        })
      }
    })

    return segments.reverse()
  }

  function generateConvTitle(text: string): string {
    const clean = text.replace(/^[💬📎✨]/g, '').trim()
    return clean.length > 25 ? clean.substring(0, 25) + '...' : clean
  }

  function sortAndSaveConversations(list: LocalConversation[]) {
    // Sort: pinned first, then by creation date desc
    const sorted = [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    setConversations(sorted)
    localStorage.setItem('gmail_ai_conversations', JSON.stringify(sorted))
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Create a new empty chat conversation
  function handleNewChat() {
    setError(null)
    const newId = 'conv-new-' + Date.now()
    const newConv: LocalConversation = {
      id: newId,
      title: 'New Chat',
      isPinned: false,
      messageIds: [],
      created_at: new Date().toISOString()
    }
    const updated = [newConv, ...conversations]
    sortAndSaveConversations(updated)
    setActiveConvId(newId)
    setInputValue('')
  }

  // Delete a conversation locally
  function handleDeleteConversation(e: React.MouseEvent, convId: string) {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this chat from your sidebar?')) return
    const updated = conversations.filter(c => c.id !== convId)
    sortAndSaveConversations(updated)
    
    if (activeConvId === convId) {
      if (updated.length > 0) {
        setActiveConvId(updated[0].id)
      } else {
        setActiveConvId('default')
      }
    }
  }

  // Pin / Unpin a conversation
  function handleTogglePin(e: React.MouseEvent, convId: string) {
    e.stopPropagation()
    const updated = conversations.map(c => {
      if (c.id === convId) {
        return { ...c, isPinned: !c.isPinned }
      }
      return c
    })
    sortAndSaveConversations(updated)
  }

  // Edit conversation title
  function handleStartRename(e: React.MouseEvent, conv: LocalConversation) {
    e.stopPropagation()
    setEditingConvId(conv.id)
    setEditTitle(conv.title)
  }

  function handleSaveRename(e: React.FormEvent, convId: string) {
    e.preventDefault()
    if (!editTitle.trim()) return
    const updated = conversations.map(c => {
      if (c.id === convId) {
        return { ...c, title: editTitle.trim() }
      }
      return c
    })
    sortAndSaveConversations(updated)
    setEditingConvId(null)
  }

  async function handleSendMessage(e: React.FormEvent, overrideText?: string) {
    if (e) e.preventDefault()
    
    const queryText = overrideText || inputValue.trim()
    if (!queryText || isLoading) return

    setInputValue('')
    setIsLoading(true)
    setError(null)

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: 'temp-user-' + Date.now(),
      role: 'user',
      content: queryText,
      created_at: new Date().toISOString(),
    }

    const currentActiveMsgs = getActiveConvMessages()
    const activeMsgList = [...currentActiveMsgs, tempUserMsg]

    // Update messages array state
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: queryText }),
      })

      const data = await response.json()
      
      // Handle quota exceeded
      if (data.error === 'AI_QUOTA_EXCEEDED') {
        const quotaMessage: ChatMessage = {
          id: 'quota-' + Date.now(),
          role: 'assistant',
          content: data.message || 'The AI assistant is temporarily unavailable due to API rate limits. Below are the retrieved email sources matching your request.',
          sources: data.sources || [],
          created_at: new Date().toISOString(),
        }
        
        appendMessagesToActiveConversation(tempUserMsg, quotaMessage)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message')
      }

      // Add actual assistant message returned
      const assistantMessage: ChatMessage = {
        ...data.message,
        sources: data.sources || [],
      }

      appendMessagesToActiveConversation(tempUserMsg, assistantMessage)
    } catch (err: any) {
      console.error('Send message error:', err)
      setError('Failed to send message. Please check connection and try again.')
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setIsLoading(false)
      // Reload from backend to synchronize the exact message IDs stored in database
      setTimeout(() => loadChatHistory(), 1500)
    }
  }

  function appendMessagesToActiveConversation(userMsg: ChatMessage, assistantMsg: ChatMessage) {
    setMessages(prev => {
      const withoutTemp = prev.filter(m => m.id !== userMsg.id)
      return [...withoutTemp, userMsg, assistantMsg]
    })

    // Update conversation metadata
    let currentConv = conversations.find(c => c.id === activeConvId)
    let updatedConvs = [...conversations]

    if (!currentConv || activeConvId.startsWith('conv-new-')) {
      // Create new conversation block if it was a fresh chat
      const realId = 'conv-' + userMsg.id
      const newConv: LocalConversation = {
        id: realId,
        title: generateConvTitle(userMsg.content),
        isPinned: false,
        messageIds: [userMsg.id, assistantMsg.id],
        created_at: userMsg.created_at
      }
      updatedConvs = updatedConvs.filter(c => c.id !== activeConvId)
      updatedConvs.push(newConv)
      setActiveConvId(realId)
    } else {
      updatedConvs = conversations.map(c => {
        if (c.id === activeConvId) {
          return {
            ...c,
            messageIds: [...c.messageIds, userMsg.id, assistantMsg.id]
          }
        }
        return c
      })
    }

    sortAndSaveConversations(updatedConvs)
  }

  // Trigger regeneration of last response
  async function handleRegenerate() {
    const activeMsgs = getActiveConvMessages()
    const lastUserMsg = [...activeMsgs].reverse().find(m => m.role === 'user')
    if (lastUserMsg) {
      handleSendMessage(null as any, lastUserMsg.content)
    }
  }

  function handleCopyResponse(text: string) {
    navigator.clipboard.writeText(text)
  }

  function getActiveConvMessages(): ChatMessage[] {
    const activeConv = conversations.find(c => c.id === activeConvId)
    if (!activeConv) return []
    const idSet = new Set(activeConv.messageIds)
    return messages.filter(m => idSet.has(m.id))
  }

  // Search filtered conversations
  const filteredConversations = conversations.filter(c => {
    return c.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function extractSenderName(sender: string): string {
    const match = sender.match(/^([^<]+)/)
    return match ? match[1].trim() : sender
  }

  function handleSourceClick(threadId: string) {
    router.push(`/dashboard?thread=${threadId}`)
  }

  const activeMessages = getActiveConvMessages()

  return (
    <div className="h-full flex bg-[#090d16] text-slate-200">
      
      {/* Left Panel: Conversation History Sidebar */}
      <aside className="w-64 border-r border-slate-900 bg-[#0b0f19] flex flex-col flex-shrink-0">
        
        {/* New Chat Button */}
        <div className="p-4 border-b border-slate-900/60">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-100 font-medium rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition-all cursor-pointer"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Chat</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="p-3 border-b border-slate-900/40">
          <div className="relative">
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-900 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/40"
            />
            <svg className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredConversations.length === 0 ? (
            <p className="text-[11px] text-slate-600 text-center py-6 select-none">No active conversations</p>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConvId === conv.id
              const isEditing = editingConvId === conv.id
              
              return (
                <div
                  key={conv.id}
                  onClick={() => !isEditing && setActiveConvId(conv.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer group relative transition-all duration-150 ${
                    isActive 
                      ? 'bg-slate-900 text-slate-100 border-l-2 border-blue-500 font-medium' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/45'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] shrink-0">{conv.isPinned ? '📌' : '💬'}</span>
                    
                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveRename(e, conv.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-xs px-1 py-0.5 rounded text-white focus:outline-none"
                          autoFocus
                          onBlur={(e) => handleSaveRename(e as any, conv.id)}
                        />
                      </form>
                    ) : (
                      <span className="truncate pr-1">{conv.title}</span>
                    )}
                  </div>

                  {/* Actions overlay */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0b0f19]/90 shrink-0">
                      <button
                        onClick={(e) => handleTogglePin(e, conv.id)}
                        className="p-1 hover:text-yellow-400 text-slate-600 rounded"
                        title={conv.isPinned ? "Unpin Chat" : "Pin Chat"}
                      >
                        📍
                      </button>
                      <button
                        onClick={(e) => handleStartRename(e, conv)}
                        className="p-1 hover:text-slate-200 text-slate-600 rounded"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="p-1 hover:text-red-400 text-slate-600 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Right Panel: Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#090d16]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-900 bg-[#0b0f19] flex items-center justify-between z-10">
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight">AI Inbox Copilot</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Ask questions about your emails and let the AI index your database
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Gemini 1.5 Pro</span>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {activeMessages.length === 0 && !isLoading && (
            <div className="max-w-xl mx-auto text-center py-16 space-y-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-200">Semantic Inbox Search</h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Query, filter, or summarize emails using natural language instructions. 
                </p>
              </div>
              
              {/* Starters */}
              <div className="space-y-2 text-left max-w-md mx-auto bg-slate-950/20 border border-slate-900 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 select-none">Suggested prompts:</p>
                {[
                  "What did my manager say about the deadline?",
                  "Show me emails about the project budget",
                  "When is my next meeting?",
                  "What action items do I have?",
                ].map((question, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(question)}
                    className="block w-full px-3.5 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 rounded-xl text-left text-xs text-slate-300 hover:border-blue-500/20 transition-all cursor-pointer"
                  >
                    💬 {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  ✨
                </div>
              )}
              
              <div className={`max-w-2xl ${msg.role === 'user' ? 'w-auto' : 'w-full'}`}>
                {/* Bubble card */}
                <div
                  className={`rounded-2xl px-4 py-3.5 border relative group shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#0b0f19]/80 border-slate-900 text-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed font-sans">{msg.content}</p>
                  
                  <div className="flex items-center justify-between mt-2.5 border-t border-slate-900/40 pt-2 shrink-0">
                    <span className={`text-[9px] ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-500'}`}>
                      {formatDate(msg.created_at)}
                    </span>
                    
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleCopyResponse(msg.content)}
                        className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        title="Copy to clipboard"
                      >
                        Copy Response
                      </button>
                    )}
                  </div>
                </div>

                {/* Sources attribution */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pl-4 space-y-2 border-l border-slate-900">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Cited Sources ({msg.sources.length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.sources.map((source) => (
                        <button
                          key={source.id}
                          onClick={() => handleSourceClick(source.thread_id)}
                          className="block w-full text-left px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900/60 rounded-xl transition-all cursor-pointer hover:border-slate-800"
                        >
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {source.subject || '(No subject)'}
                          </p>
                          <p className="text-[9px] text-slate-500 truncate mt-1">
                            From: {extractSenderName(source.sender)} • {new Date(source.received_at).toLocaleDateString()}
                          </p>
                          {source.similarity && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span className="text-[9px] text-blue-400 font-medium">
                                Relevance: {Math.round(source.similarity * 100)}%
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 shadow-md text-xs font-semibold">
                  U
                </div>
              )}
            </div>
          ))}

          {/* Assistant Loading Response */}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                ✨
              </div>
              <div className="max-w-2xl w-full">
                <div className="rounded-2xl px-4 py-3.5 bg-[#0b0f19]/80 border border-slate-900 text-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 shrink-0">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-slate-400">Consulting inbox embeddings...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error panel */}
          {error && (
            <div className="max-w-xl mx-auto">
              <div className="rounded-xl px-4 py-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Bar */}
        <div className="px-6 py-4 border-t border-slate-900 bg-[#0b0f19]">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-3 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Query deadline updates, search invoices, or summarize events..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            
            {/* Action buttons inside form */}
            <div className="flex items-center gap-1.5">
              {activeMessages.length > 0 && !isLoading && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="px-3.5 py-3 border border-slate-800 hover:bg-slate-900 rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  title="Regenerate last response"
                >
                  Regen
                </button>
              )}
              
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
