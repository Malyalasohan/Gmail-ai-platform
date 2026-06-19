import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import LoginButton from '@/components/LoginButton'

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#030712] text-slate-100 overflow-hidden relative font-sans selection:bg-blue-500/30">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none translate-y-1/3"></div>
      
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-white">Gmail AI</span>
        </div>
        <div className="text-sm text-slate-400">
          v1.0.0
        </div>
      </header>

      {/* Main Hero & Features */}
      <main className="max-w-6xl mx-auto px-6 py-16 text-center z-10 flex-1 flex flex-col justify-center">
        <div className="space-y-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 mx-auto shadow-inner">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            Now Powered by Gemini 1.5 Pro & NIMs
          </div>

          {/* Hero text */}
          <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
              Transform Your Inbox with{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Gmail AI Intelligence
              </span>
            </h1>
            <p className="text-base sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
              Supercharge your emails into an interactive knowledge base. Extract insights, categorize items dynamically, and converse with your history.
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center justify-center gap-3 pt-4">
            <LoginButton />
            <p className="text-xs text-slate-500">
              Secure OAuth integration. We only request read & write permissions for Gmail.
            </p>
          </div>

          {/* Product Dashboard Mockup Preview */}
          <div className="relative max-w-4xl mx-auto pt-8">
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent z-10"></div>
            <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-2 shadow-2xl overflow-hidden backdrop-blur-sm">
              <div className="border border-slate-800/80 bg-slate-900/10 rounded-xl p-4 sm:p-6 text-left space-y-4">
                {/* Mockup Header */}
                <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/60"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-500/60"></span>
                    <span className="w-3 h-3 rounded-full bg-green-500/60"></span>
                  </div>
                  <div className="text-xs text-slate-500 select-none">gmail-ai-platform.internal</div>
                  <div className="w-8"></div>
                </div>
                
                {/* Mockup Body Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Left Column: Sidebar Mock */}
                  <div className="space-y-3 hidden md:block col-span-1 border-r border-slate-800/30 pr-4">
                    <div className="h-8 bg-blue-600/10 border border-blue-500/20 rounded-lg flex items-center px-3 gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                      <div className="w-12 h-2.5 bg-blue-300/40 rounded"></div>
                    </div>
                    <div className="h-8 hover:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                      <div className="w-16 h-2.5 bg-slate-600 rounded"></div>
                    </div>
                    <div className="h-8 hover:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                      <div className="w-14 h-2.5 bg-slate-600 rounded"></div>
                    </div>
                  </div>
                  {/* Right Column: Mail Content Mock */}
                  <div className="col-span-3 md:col-span-2 space-y-4">
                    <div className="bg-slate-900/50 p-4 border border-slate-800/60 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">JD</div>
                          <span className="text-xs font-semibold text-white">John Doe</span>
                        </div>
                        <span className="text-[10px] text-slate-500">10:42 AM</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3.5 bg-slate-800 rounded w-3/4"></div>
                        <div className="h-2.5 bg-slate-800/60 rounded w-5/6"></div>
                      </div>
                      <div className="pt-2 border-t border-slate-800/30 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                          ⚡ AI Summary
                        </div>
                        <span className="text-[10px] text-slate-400 italic">"Confirm schedule for Friday presentation"</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-8">
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 text-left hover:border-slate-800 hover:bg-slate-900/55 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-xl mb-4">✨</div>
              <h3 className="font-semibold text-white mb-2 text-base">Gemini Summaries</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Automatically extract key points and action items from long email threads with one-click summaries.
              </p>
            </div>
            
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 text-left hover:border-slate-800 hover:bg-slate-900/55 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-xl mb-4">🎯</div>
              <h3 className="font-semibold text-white mb-2 text-base">Dynamic NIM Tagging</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Categorize your incoming messages automatically into Work, Personal, Newsletters, or Action Required.
              </p>
            </div>

            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 text-left hover:border-slate-800 hover:bg-slate-900/55 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-xl mb-4">💬</div>
              <h3 className="font-semibold text-white mb-2 text-base">Conversational Search</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Query your entire email history in natural language. Chat with your inbox and get quoted sources.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Gmail AI Platform. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-slate-400 transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-400 transition-colors">Terms of Service</span>
            <span className="hover:text-slate-400 transition-colors">Security</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

