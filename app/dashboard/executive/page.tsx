'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

interface DailyBrief {
  generatedAt: string
  summary: string
  inboxHealth: {
    totalEmails: number
    unread: number
    urgent: number
    needReply: number
    healthScore: number
    healthStatus: string
  }
  highPriority: BriefSection
  urgentDeadlines: BriefSection
  pendingReplies: BriefSection
  upcomingInterviews: BriefSection
  meetings: BriefSection
  invoices: BriefSection
  recommendations: Recommendation[]
  estimatedWorkTime: number
}

interface BriefSection {
  count: number
  items: BriefItem[]
  summary: string
}

interface BriefItem {
  id: string
  title: string
  subtitle: string
  timestamp: string
  priority: number
  action?: string
}

interface Recommendation {
  priority: number
  action: string
  reason: string
  estimatedMinutes: number
  relatedEmailId?: string
}

export default function ExecutivePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [report, setReport] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'recommendations'>('overview')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      loadReport()
    }
  }, [status])

  const loadReport = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/executive/report')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load report')
      }

      setReport(data.report)
    } catch (err: any) {
      console.error('Load report error:', err)
      setError(err.message || 'Failed to load executive report')
    } finally {
      setLoading(false)
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) {
      return {
        start: '#10b981', // emerald-500
        end: '#06b6d4',   // cyan-500
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/5',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        statusText: 'Excellent'
      }
    }
    if (score >= 60) {
      return {
        start: '#f59e0b', // amber-500
        end: '#f97316',   // orange-500
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/5',
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        statusText: 'Fair'
      }
    }
    return {
      start: '#f43f5e', // rose-500
      end: '#ef4444',   // red-500
      text: 'text-rose-400',
      border: 'border-rose-500/20',
      bg: 'bg-rose-500/5',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
      statusText: 'Needs Attention'
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#030712]">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full animate-pulse opacity-20"></div>
            <div className="absolute inset-2 bg-[#090d16] rounded-full flex items-center justify-center border border-slate-800">
              <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Generating your executive briefing...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#030712] px-6 text-center">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-slate-200 font-semibold mb-2">Failed to load Briefing</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-6">{error}</p>
          <button
            onClick={loadReport}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl font-medium transition-all cursor-pointer text-sm"
          >
            Retry Report
          </button>
        </div>
      </DashboardLayout>
    )
  }

  if (!report) {
    return null
  }

  const scoreColor = getHealthScoreColor(report.inboxHealth.healthScore)
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - report.inboxHealth.healthScore / 100)

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 bg-[#030712] min-h-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
              Executive Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              AI-generated summary and intelligent tasks backlog for{' '}
              <span className="text-blue-400 font-medium">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </p>
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-medium shadow-md shadow-blue-500/10 hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Report
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Inbox Health SVG Gauge */}
          <div className={`p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col justify-between relative overflow-hidden ${scoreColor.glow}`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-slate-200 font-semibold text-lg">Inbox Health</h3>
                <span className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold block mt-0.5">
                  AI Assessment Status
                </span>
              </div>
              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${scoreColor.text} ${scoreColor.border} ${scoreColor.bg}`}>
                {scoreColor.statusText}
              </span>
            </div>

            <div className="flex items-center justify-around my-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <defs>
                    <linearGradient id="radialHealthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={scoreColor.start} />
                      <stop offset="100%" stopColor={scoreColor.end} />
                    </linearGradient>
                  </defs>
                  {/* Track circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className="stroke-slate-800/80"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  {/* Active gauge */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    stroke="url(#radialHealthGradient)"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-slate-100 tracking-tight">
                    {report.inboxHealth.healthScore}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Score</span>
                </div>
              </div>
            </div>

            {/* Micro Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mt-6 border-t border-slate-900 pt-5">
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-slate-200">{report.inboxHealth.totalEmails}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Total synced</div>
              </div>
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{report.inboxHealth.unread}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Unread messages</div>
              </div>
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-rose-400">{report.inboxHealth.urgent}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Urgent priority</div>
              </div>
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{report.inboxHealth.needReply}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Need reply</div>
              </div>
            </div>
          </div>

          {/* Right Columns: Today's Executive Summary Letterhead */}
          <div className="lg:col-span-2 p-7 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col relative">
            <div className="absolute top-0 left-1/3 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Briefing Summary
            </div>

            <h3 className="text-slate-200 font-semibold text-lg mb-4 border-b border-slate-900 pb-3">
              Overview & Focus Points
            </h3>

            <div className="flex-1 text-slate-300 leading-relaxed text-sm space-y-4 font-normal">
              {report.summary.split('\n\n').map((paragraph, index) => (
                <p key={index} className="last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
            
            <div className="mt-5 pt-4 border-t border-slate-900 flex justify-between items-center text-xs text-slate-500">
              <span>Gmail AI Engine</span>
              <span>Updated: {new Date(report.generatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-slate-900">
          <nav className="flex space-x-6">
            {[
              {
                id: 'overview' as const,
                label: 'Overview Sections',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                  </svg>
                )
              },
              {
                id: 'tasks' as const,
                label: 'Tasks & Deadlines',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                )
              },
              {
                id: 'recommendations' as const,
                label: 'AI Recommendations',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )
              }
            ].map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
                    active
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Contents */}
        <div className="transition-all duration-300">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* High Priority */}
              <SectionCard
                title="High Priority"
                count={report.highPriority.count}
                summary={report.highPriority.summary}
                items={report.highPriority.items}
                badgeColor="border-rose-500/20 text-rose-400 bg-rose-500/5"
              />

              {/* Pending Replies */}
              <SectionCard
                title="Pending Replies"
                count={report.pendingReplies.count}
                summary={report.pendingReplies.summary}
                items={report.pendingReplies.items}
                badgeColor="border-amber-500/20 text-amber-400 bg-amber-500/5"
              />

              {/* Upcoming Interviews */}
              <SectionCard
                title="Interviews"
                count={report.upcomingInterviews.count}
                summary={report.upcomingInterviews.summary}
                items={report.upcomingInterviews.items}
                badgeColor="border-purple-500/20 text-purple-400 bg-purple-500/5"
              />

              {/* Meetings */}
              <SectionCard
                title="Meetings"
                count={report.meetings.count}
                summary={report.meetings.summary}
                items={report.meetings.items}
                badgeColor="border-blue-500/20 text-blue-400 bg-blue-500/5"
              />

              {/* Invoices */}
              <SectionCard
                title="Bills & Invoices"
                count={report.invoices.count}
                summary={report.invoices.summary}
                items={report.invoices.items}
                badgeColor="border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Urgent Deadlines */}
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <div>
                    <h2 className="text-slate-200 font-semibold text-lg">Urgent Deadlines</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Critical items requiring immediate attention</p>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-bold">
                    {report.urgentDeadlines.count} Tasks
                  </span>
                </div>
                
                <p className="text-slate-400 text-sm mb-6">{report.urgentDeadlines.summary}</p>

                {report.urgentDeadlines.items.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.urgentDeadlines.items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/dashboard?thread=${item.id}`}
                        className="group flex flex-col justify-between p-4 border border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-xl hover:bg-slate-900/40 transition-all cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-400 rounded font-medium">
                              Priority: {item.priority}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {item.timestamp}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-200 text-sm group-hover:text-blue-400 transition-colors line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {item.subtitle}
                          </p>
                        </div>
                        {item.action && (
                          <div className="mt-3 text-xs text-rose-400 bg-rose-500/5 border border-rose-500/10 py-1.5 px-2.5 rounded-lg font-medium flex items-center gap-1.5 self-start">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {item.action}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                    <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-slate-500 text-sm">No urgent deadlines identified.</p>
                  </div>
                )}
              </div>

              {/* Estimated Work Time */}
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="space-y-1">
                  <h3 className="text-slate-200 font-semibold text-lg">Workload Calculator</h3>
                  <p className="text-slate-400 text-sm">Estimated focus time required to process recommendations and backlog</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 px-6 py-4 rounded-2xl flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-blue-400 tracking-tight">
                    {Math.floor(report.estimatedWorkTime / 60)}h{' '}
                    {report.estimatedWorkTime % 60}m
                  </span>
                  <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                    Est. Time
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-md animate-fadeIn">
              <div className="border-b border-slate-900 pb-3 mb-6">
                <h2 className="text-slate-200 font-semibold text-lg">AI-Powered Recommendations</h2>
                <p className="text-slate-400 text-xs mt-0.5 font-normal">Prioritized recommendations compiled from your latest messages activity</p>
              </div>

              {report.recommendations.length > 0 ? (
                <div className="space-y-4">
                  {report.recommendations.map((rec, index) => {
                    if (rec.relatedEmailId) {
                      return (
                        <Link
                          key={index}
                          href={`/dashboard?thread=${rec.relatedEmailId}`}
                          className="block p-4 border border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-xl hover:bg-slate-900/40 transition-all cursor-pointer group"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-sm">
                                {rec.priority}
                              </div>
                              <div>
                                <h3 className="font-semibold text-slate-200 text-sm group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                  {rec.action}
                                  <span className="text-[9px] px-1.5 py-0.5 border border-blue-500/20 text-blue-400 bg-blue-500/5 rounded uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                    View Email
                                  </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">{rec.reason}</p>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 py-1 px-2.5 rounded-lg self-start sm:self-auto font-medium">
                              ~{rec.estimatedMinutes} mins
                            </span>
                          </div>
                        </Link>
                      )
                    }
                    return (
                      <div
                        key={index}
                        className="block p-4 border border-slate-800 bg-slate-950/40 rounded-xl"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-sm">
                              {rec.priority}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-200 text-sm">
                                {rec.action}
                              </h3>
                              <p className="text-xs text-slate-400 mt-1">{rec.reason}</p>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 py-1 px-2.5 rounded-lg self-start sm:self-auto font-medium">
                            ~{rec.estimatedMinutes} mins
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                  <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-slate-500 text-sm">All set! No recommendations at this time.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

// Custom Section Card Component
interface SectionCardProps {
  title: string
  count: number
  summary: string
  items: BriefItem[]
  badgeColor: string
}

function SectionCard({ title, count, summary, items, badgeColor }: SectionCardProps) {
  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between h-[360px]">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-200 font-semibold text-[15px]">{title}</h3>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
            {count}
          </span>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed mb-4 line-clamp-3">
          {summary}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-end space-y-2">
        {items.length > 0 ? (
          <>
            {items.slice(0, 2).map((item) => (
              <Link
                key={item.id}
                href={`/dashboard?thread=${item.id}`}
                className="block p-3 border border-slate-900 hover:border-slate-800 bg-slate-950/50 rounded-xl hover:bg-slate-900/50 transition-all cursor-pointer group"
              >
                <div className="font-semibold text-slate-300 text-xs group-hover:text-blue-400 transition-colors truncate">
                  {item.title}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {item.subtitle}
                </div>
              </Link>
            ))}
            {items.length > 2 && (
              <Link
                href="/dashboard"
                className="text-center text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider block py-1 mt-1"
              >
                +{items.length - 2} more items in Inbox
              </Link>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-slate-600 text-xs font-medium border border-dashed border-slate-900 rounded-xl">
            None found
          </div>
        )}
      </div>
    </div>
  )
}

