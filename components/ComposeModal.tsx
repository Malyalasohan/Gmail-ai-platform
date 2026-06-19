'use client'

import { useState } from 'react'

interface ComposeModalProps {
  isOpen: boolean
  onClose: () => void
}

type ComposeStep = 'prompt' | 'preview' | 'sending' | 'sent' | 'error'

export default function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const [step, setStep] = useState<ComposeStep>('prompt')
  const [prompt, setPrompt] = useState('')
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState({ subject: '', body: '', to: '' })
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleGenerateDraft() {
    if (!prompt.trim()) return

    setStep('preview')
    setError(null)

    try {
      const response = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, to }),
      })

      if (!response.ok) throw new Error('Failed to generate draft')

      const data = await response.json()
      setDraft(data.draft)
    } catch (err) {
      console.error('Draft generation error:', err)
      setError('Failed to generate draft. Please try again.')
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
        }),
      })

      if (!response.ok) throw new Error('Failed to send email')

      setStep('sent')
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      console.error('Send error:', err)
      setError('Failed to send email. Please try again.')
      setStep('error')
    }
  }

  function handleClose() {
    setStep('prompt')
    setPrompt('')
    setTo('')
    setDraft({ subject: '', body: '', to: '' })
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-100 tracking-wide">New Message</span>
            <span className="text-[10px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">AI Compose</span>
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
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Recipient (To)
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-600 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Describe what you want to write ✨
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Request a project extension deadline, thank the operations team for a great presentation, follow up on budget invoices..."
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 placeholder-slate-600 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleGenerateDraft}
                disabled={!prompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Generate Draft with Gemini
              </button>
            </div>
          )}

          {/* Step 2: Preview (Loading) */}
          {step === 'preview' && !draft.body && (
            <div className="text-center py-16 space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-200">Writing email draft...</p>
                <p className="text-xs text-slate-500">Refining style and layout</p>
              </div>
            </div>
          )}

          {/* Step 2: Preview (Draft Ready) */}
          {step === 'preview' && draft.body && (
            <div className="space-y-4">
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400">
                ✨ Edit the generated content below before sending.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  To
                </label>
                <input
                  type="email"
                  value={draft.to}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 text-sm focus:border-blue-500/50 focus:outline-none"
                  required
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
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-xs transition-colors cursor-pointer border border-slate-850"
                >
                  Modify Prompt
                </button>
                <button
                  onClick={handleSend}
                  disabled={!draft.to || !draft.subject || !draft.body}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-md transition-colors disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                >
                  Send Message
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Sending */}
          {step === 'sending' && (
            <div className="text-center py-16 space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-slate-400">Delivering email via Gmail API...</p>
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
                <h3 className="text-sm font-bold text-slate-200">Email Delivered! 🎉</h3>
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
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
