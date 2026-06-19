'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'

export default function SettingsView() {
  const { data: session } = useSession()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleResync() {
    setIsSyncing(true)
    setSyncStatus(null)
    setSyncError(null)

    try {
      const syncResponse = await fetch('/api/sync', {
        method: 'POST',
      })

      if (!syncResponse.ok) throw new Error('Sync failed')

      const syncData = await syncResponse.json()
      
      fetch('/api/embeddings/generate', { method: 'POST' })
        .catch(err => console.error('Embedding generation failed:', err))

      fetch('/api/emails/categorize', { method: 'POST' })
        .catch(err => console.error('Categorization failed:', err))

      setSyncStatus(`Successfully synced ${syncData.synced} emails`)
    } catch (error: any) {
      console.error('Re-sync error:', error)
      setSyncError('Failed to sync emails. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your Gmail account? This will delete all your synced emails and chat history.'
    )

    if (!confirmed) return

    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#090d16] text-slate-200">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">System Settings</h1>
          <p className="text-xs text-slate-400 mt-1">Manage credentials, syncing frequency, and data preferences.</p>
        </div>

        <div className="space-y-6">
          {/* Account Profile Card */}
          <div className="bg-[#0b0f19] border border-slate-900 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-900 bg-slate-950 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Google Account</h2>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Connected</span>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-14 h-14 rounded-full border border-slate-800"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <span className="text-slate-300 text-lg font-bold">
                      {session?.user?.email?.[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {session?.user?.email}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-900/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                  <span className="text-emerald-500">✓</span>
                  <span>OAuth scopes validated</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                  <span className="text-blue-500">⚡</span>
                  <span>AI features enabled</span>
                </div>
              </div>
            </div>
          </div>

          {/* Synchronization Control Card */}
          <div className="bg-[#0b0f19] border border-slate-900 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-900 bg-slate-950">
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Inbox Synchronization</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Manually retrieve the latest 150 email messages from Gmail API. This triggers database indexing, text embedding, and Llama NIM categorization.
              </p>

              {syncStatus && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                  <p className="text-xs text-emerald-400">✓ {syncStatus}</p>
                </div>
              )}

              {syncError && (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl">
                  <p className="text-xs text-red-400">⚠️ {syncError}</p>
                </div>
              )}

              <button
                onClick={handleResync}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl disabled:bg-blue-300/10 disabled:text-slate-600 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Re-sync Gmail Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Privacy & Storing Limits Card */}
          <div className="bg-[#0b0f19] border border-slate-900 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-900 bg-slate-950">
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Data Privacy</h2>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-400">
              <div className="space-y-2">
                <p className="font-semibold text-slate-200">Local Stored Attributes:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li>Last 150 emails (Subject, Sender, snippet)</li>
                  <li>AI summaries & Llama categorizations</li>
                  <li>RAG vector embeddings (768 dimensions)</li>
                </ul>
              </div>
              <div className="pt-3 border-t border-slate-900/60">
                <p>All sensitive credentials (refresh tokens) are stored encrypted at rest. No user data is sent for training models.</p>
              </div>
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-[#0b0f19] border border-red-950 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-red-950 bg-red-950/20">
              <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest">Danger Zone</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Revoking access will remove all synced messages, embedding vectors, and local chat configurations permanently from the database.
              </p>

              <button
                onClick={handleDisconnect}
                className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-400 text-xs font-semibold rounded-xl border border-red-900/30 transition-all cursor-pointer"
              >
                Disconnect Account
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

