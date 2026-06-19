'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ComposeModal from './ComposeModal'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Active navigation items backed by APIs/views
  const activeMailItems = [
    {
      href: '/dashboard',
      label: 'Inbox',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L4 13" />
        </svg>
      )
    }
  ]

  const activeIntelligenceItems = [
    {
      href: '/dashboard/chat',
      label: 'AI Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    },
    {
      href: '/dashboard/executive',
      label: 'Executive Brief',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      )
    },
    {
      href: '/dashboard/workflows',
      label: 'AI Workflows',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    }
  ]

  return (
    <>
      <div className="flex h-screen bg-[#030712] text-slate-100 font-sans antialiased overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            isCollapsed ? 'w-20' : 'w-64'
          } bg-[#0b0f19] border-r border-slate-900 flex flex-col transition-all duration-300 ease-in-out z-20`}
        >
          {/* Logo / Header */}
          <div className="p-4 border-b border-slate-900 flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-bold text-slate-100 text-sm tracking-wide">Gmail AI</span>
              </div>
            )}
            
            {/* Collapse toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer mx-auto"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>

          {/* Compose button */}
          <div className="p-4">
            <button
              onClick={() => setIsComposeOpen(true)}
              className={`w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer ${
                isCollapsed ? 'px-0' : 'px-4'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {!isCollapsed && <span>Compose</span>}
            </button>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 px-3 py-2 space-y-6 overflow-y-auto">
            {/* Mail Group */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 select-none">
                  Mail
                </div>
              )}
              {activeMailItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-blue-500'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex-shrink-0">{item.icon}</div>
                    {!isCollapsed && <span className="text-sm">{item.label}</span>}
                  </Link>
                )
              })}

              {/* Removed disabled folders - "Coming Soon" badges removed */}
            </div>

            {/* AI / Analytics Group */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 select-none">
                  Intelligence
                </div>
              )}
              {activeIntelligenceItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-blue-500'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex-shrink-0">{item.icon}</div>
                    {!isCollapsed && <span className="text-sm">{item.label}</span>}
                  </Link>
                )
              })}
            </div>

            {/* Configuration Group */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 select-none">
                  Configuration
                </div>
              )}
              <Link
                href="/dashboard/settings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                  pathname === '/dashboard/settings'
                    ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                {!isCollapsed && <span className="text-sm">Settings</span>}
              </Link>
            </div>
          </nav>

          {/* User profile section */}
          <div className="p-3 border-t border-slate-900 bg-slate-950/20">
            <div className="flex items-center gap-3 mb-2 px-1">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border border-slate-800"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-300 text-xs font-semibold">
                    {session?.user?.email?.[0].toUpperCase()}
                  </span>
                </div>
              )}
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {session?.user?.email}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-900/60 hover:border-slate-800/80 rounded-lg transition-colors cursor-pointer"
            >
              {!isCollapsed ? 'Sign Out' : 'Logout'}
            </button>
          </div>
        </aside>

        {/* Main content pane */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {children}
        </main>
      </div>

      {/* Compose Modal */}
      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />
    </>
  )
}

