'use client'

import { useState } from 'react'

interface ReplyModalProps {
  isOpen: boolean
  onClose: () => void
  threadId: string
  replyTo: string
}

type ReplyStep = 'prompt' | 'preview' | 'sending' | 'sent' | 'error'

export default function ReplyModal({ isOpen, onClose, threadId, replyTo }: ReplyModalProps) {
  const [step, setStep] = useState<ReplyStep>('prompt')
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState({ subject: '', body: '', to: '', threadId: '', inReplyTo: '' })
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleGenerateDraft() {
    if (!prompt.trim()) return

    setStep('preview')
    setError(null)

    try {
      const response = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, prompt }),
      })

      if (!response.ok) throw new Error('Failed to generate reply')

      const data = await response.json()
      setDraft(data.draft)
    } catch (err) {
      console.error('Reply generation error:', err)
      setError('Failed to generate reply. Please try again.')
      setStep('error')
    }
  }

  async function handleSend() {
    setStep('sending')
    setError(null)

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          threadId: draft.threadId,
          inReplyTo: draft.inReplyTo,
        }),
      })

      if (!response.ok) throw new Error('Failed to send reply')

      setStep('sent')
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      console.error('Send error:', err)
      setError('Failed to send reply. Please try again.')
      setStep('error')
    }
  }

  function handleClose() {
    setStep('prompt')
    setPrompt('')
    setDraft({ subject: '', body: '', to: '', threadId: '', inReplyTo: '' })
    setError(null)
    onClose()
  }

  function handleBack() {
    setStep('prompt')
    setError(null)
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 p-4 max-w-xl w-full">
      <div className="bg-[#0b0f19] border border-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-900/60 bg-slate-950 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-100 tracking-wide block">Reply with AI</span>
            <span className="text-[10px] text-slate-500 truncate block mt-0.5">To: {replyTo}</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step 1: Prompt */}
          {step === 'prompt' && (
            <div className="space-y-4">
              <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-400">
                🧵 AI will scan the full thread history to generate a contextually accurate reply.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  What is the core message of your reply? ✨
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Accept the proposal and request a contract review on Monday, reschedule the call to next Thursday, say thank you..."
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-600 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none resize-none"
                  autoFocus
                />
              </div>

              <button
                onClick={handleGenerateDraft}
                disabled={!prompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Draft Intelligent Reply
              </button>
            </div>
          )}

          {/* Step 2: Preview (Loading) */}
          {step === 'preview' && !draft.body && (
            <div className="text-center py-16 space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-200">Generating reply layout...</p>
                <p className="text-xs text-slate-500">Scanning email thread indices</p>
              </div>
            </div>
          )}

          {/* Step 2: Preview (Draft Ready) */}
          {step === 'preview' && draft.body && (
            <div className="space-y-4">
              <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-400">
                ✨ Edit the generated reply below before sending.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  To
                </label>
                <input
                  type="email"
                  value={draft.to}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-slate-400 text-sm cursor-not-allowed"
                  disabled
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 text-sm focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Message Content
                </label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-slate-300 text-xs focus:border-blue-500/50 focus:outline-none font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-xs transition-colors border border-slate-850 cursor-pointer"
                >
                  Modify Prompt
                </button>
                <button
                  onClick={handleSend}
                  disabled={!draft.to || !draft.subject || !draft.body}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-md transition-colors disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                >
                  Send Reply
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Sending */}
          {step === 'sending' && (
            <div className="text-center py-16 space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-slate-400">Delivering response via Gmail API...</p>
            </div>
          )}

          {/* Step 4: Sent */}
          {step === 'sent' && (
            <div className="text-center py-16 space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">Reply Delivered! 🎉</h3>
                <p className="text-xs text-slate-500">Successfully sent and synced</p>
              </div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-full border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">Delivery Failure</h3>
                <p className="text-xs text-red-400">{error}</p>
              </div>
              <button
                onClick={handleBack}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Back to Draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

