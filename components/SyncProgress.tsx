'use client'

interface SyncProgressProps {
  synced: number
  total: number
  message?: string
  submessage?: string
}

export default function SyncProgress({ synced, total, message, submessage }: SyncProgressProps) {
  const currentMsg = message || ''
  
  // Map current message to active steps for visual progression
  const isSyncing = currentMsg.includes('Syncing')
  const isEmbeddings = currentMsg.includes('Preparing') || currentMsg.includes('embedding')
  const isCategorizing = currentMsg.includes('Organizing') || currentMsg.includes('Categorize') || currentMsg.includes('NIM')

  const steps = [
    {
      id: 1,
      label: 'Fetch Gmail inbox messages',
      status: isSyncing ? 'active' : (isEmbeddings || isCategorizing ? 'completed' : 'pending'),
    },
    {
      id: 2,
      label: 'Generate semantic embeddings',
      status: isEmbeddings ? 'active' : (isCategorizing ? 'completed' : 'pending'),
    },
    {
      id: 3,
      label: 'NVIDIA Llama NIM categorization',
      status: isCategorizing ? 'active' : 'pending',
    },
  ]

  return (
    <div className="h-full flex items-center justify-center bg-[#090d16] px-6">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Animated Icon & Rings */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl animate-pulse opacity-10 blur-xl"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl animate-spin opacity-20" style={{ animationDuration: '8s' }}></div>
          <div className="absolute inset-1.5 bg-[#0b0f19] rounded-2xl border border-slate-800 flex items-center justify-center shadow-2xl">
            <svg className="w-10 h-10 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        {/* Status titles */}
        <div className="space-y-2.5">
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            {message || 'Syncing your inbox...'}
          </h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
            {submessage || 'This usually takes 30-60 seconds'}
          </p>
        </div>

        {/* Progress indicators bar */}
        <div className="space-y-3 bg-[#0b0f19]/60 border border-slate-900 rounded-2xl p-5 text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-purple-600"></div>
          
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-2">
            Execution Progress
          </span>

          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-3">
                  {step.status === 'completed' && (
                    <div className="w-4 h-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {step.status === 'active' && (
                    <div className="w-4 h-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center flex-shrink-0 relative">
                      <span className="absolute w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75"></span>
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    </div>
                  )}
                  {step.status === 'pending' && (
                    <div className="w-4 h-4 bg-slate-900 border border-slate-800 text-slate-600 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold">
                      {step.id}
                    </div>
                  )}
                  <span className={`${
                    step.status === 'completed' ? 'text-slate-400 line-through decoration-slate-800' :
                    step.status === 'active' ? 'text-slate-200 font-semibold' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                
                {step.status === 'active' && (
                  <span className="text-[10px] text-blue-400 animate-pulse font-medium">
                    Processing
                  </span>
                )}
              </div>
            ))}
          </div>

          {synced > 0 && total > 0 && (
            <div className="pt-3 border-t border-slate-900 mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Progress:</span>
              <span className="font-bold text-slate-300">
                {synced} / {total} messages processed
              </span>
            </div>
          )}
        </div>

        {/* Additional info footer */}
        {!message && (
          <p className="text-[11px] text-slate-500">
            We are fetching your inbox and compiling a high-performance vector graph database locally.
          </p>
        )}
      </div>
    </div>
  )
}
