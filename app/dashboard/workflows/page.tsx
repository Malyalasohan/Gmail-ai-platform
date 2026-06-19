'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  executionCount: number;
}

interface Reminder {
  id: string;
  title: string;
  description?: string;
  reminderDate: string;
  type: string;
  status: string;
}

interface WorkflowExecution {
  id: string;
  workflowName: string;
  status: string;
  startedAt: string;
  completedAt: string;
  duration: number;
}

export default function WorkflowsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'run' | 'templates' | 'rules' | 'reminders' | 'history'>('run');
  
  // Run workflow state
  const [workflowRequest, setWorkflowRequest] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Templates state
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);

  // Rules state
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [newRule, setNewRule] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);

  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderStats, setReminderStats] = useState<any>(null);

  // History state
  const [history, setHistory] = useState<WorkflowExecution[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Auth Guard
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [authStatus, router]);

  // Load data
  useEffect(() => {
    if (session) {
      loadTemplates();
      loadRules();
      loadReminders();
      loadHistory();
    }
  }, [session]);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/workflow/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadRules = async () => {
    try {
      const res = await fetch('/api/workflow/rules');
      const data = await res.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const [remindersRes, statsRes] = await Promise.all([
        fetch('/api/workflow/reminders'),
        fetch('/api/workflow/reminders?type=stats')
      ]);
      
      const remindersData = await remindersRes.json();
      const statsData = await statsRes.json();
      
      setReminders(remindersData.reminders || []);
      setReminderStats(statsData.stats);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([
        fetch('/api/workflow/history'),
        fetch('/api/workflow/history?stats=true')
      ]);
      
      const historyData = await historyRes.json();
      const statsData = await statsRes.json();
      
      setHistory(historyData.history || []);
      setStats(statsData.stats);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const executeWorkflow = async () => {
    if (!workflowRequest.trim()) return;

    setExecuting(true);
    setExecutionResult(null);

    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'natural_language',
          request: workflowRequest
        })
      });

      const result = await res.json();
      setExecutionResult(result);

      if (result.success) {
        loadHistory();
      }
    } catch (error: any) {
      setExecutionResult({ error: error.message });
    } finally {
      setExecuting(false);
    }
  };

  const executeTemplate = async (templateId: string) => {
    setExecuting(true);
    setExecutionResult(null);

    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'template',
          request: `Execute template: ${templateId}`,
          templateId,
          params: {}
        })
      });

      const result = await res.json();
      setExecutionResult(result);

      if (result.success) {
        loadHistory();
      }
    } catch (error: any) {
      setExecutionResult({ error: error.message });
    } finally {
      setExecuting(false);
    }
  };

  const createRule = async () => {
    if (!newRule.trim()) return;

    setCreatingRule(true);

    try {
      const res = await fetch('/api/workflow/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: newRule })
      });

      if (res.ok) {
        setNewRule('');
        loadRules();
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    } finally {
      setCreatingRule(false);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch('/api/workflow/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, enabled })
      });

      loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const recommendedPrompts = [
    'Archive all promotional and newsletter emails from today',
    'Find and list all billing invoices and payment due dates',
    'Star all urgent emails from my team members or clients',
    'Draft standard response drafts to recruiter messages'
  ];

  if (authStatus === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-[#030712]">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full animate-pulse opacity-20"></div>
            <div className="absolute inset-2 bg-[#090d16] rounded-full flex items-center justify-center border border-slate-800">
              <svg className="w-6 h-6 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing Workflow Dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 bg-[#030712] min-h-full">
        {/* Header */}
        <div className="border-b border-slate-900 pb-6">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent tracking-tight">
            Autonomous Workflows
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Build, execute, and monitor AI-powered background automation for your Gmail inbox
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-900">
          <nav className="flex space-x-6">
            {[
              { id: 'run' as const, label: 'Run Workflow', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { id: 'templates' as const, label: 'Templates', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )},
              { id: 'rules' as const, label: 'Automation Rules', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              )},
              { id: 'reminders' as const, label: 'Reminders', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { id: 'history' as const, label: 'History', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m9-.3V12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setExecutionResult(null);
                }}
                className={`flex items-center gap-2 pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content Areas */}
        <div className="transition-all duration-300">
          
          {/* 1. Run Workflow Tab */}
          {activeTab === 'run' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <h2 className="text-slate-200 font-semibold text-lg mb-1">Execute Instant Automation</h2>
                <p className="text-slate-400 text-xs mb-6">Describe what you want to automate in plain English, and the AI agent will map tasks</p>
                
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={workflowRequest}
                      onChange={(e) => setWorkflowRequest(e.target.value)}
                      placeholder="E.g. Analyze my inbox for urgent requests and schedule calendar briefings..."
                      className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 hover:border-slate-700/80 focus:border-purple-500/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:ring-1 focus:ring-purple-500/30 resize-none transition-all outline-none"
                      rows={4}
                    />
                  </div>

                  {/* Recommendations prompts */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">
                      Recommended Prompts
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {recommendedPrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => setWorkflowRequest(prompt)}
                          className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={executeWorkflow}
                      disabled={executing || !workflowRequest.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-purple-500 text-white rounded-xl font-semibold text-sm shadow-md shadow-purple-500/10 hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
                    >
                      {executing ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Executing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Execute Workflow
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Execution Result Modal / Widget */}
              {executionResult && (
                <div className={`rounded-2xl p-5 border animate-fadeIn flex flex-col sm:flex-row items-start gap-4 ${
                  executionResult.success 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                    : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                }`}>
                  <div className={`p-2 rounded-xl border flex-shrink-0 ${
                    executionResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'
                  }`}>
                    {executionResult.success ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200 mb-1">
                      {executionResult.success ? 'Workflow Run Succeeded' : 'Workflow Execution Failed'}
                    </h3>
                    <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {executionResult.summary || executionResult.error}
                    </p>
                    
                    {executionResult.requiresApproval && (
                      <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-400 max-w-xl">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Pending Approval Needed
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-normal">
                          This action touches external calendar assets and requires explicit approval to apply. Check your workflows settings for permission.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Templates Tab */}
          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
              {templates.length > 0 ? (
                templates.map(template => (
                  <div 
                    key={template.id} 
                    className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between h-[240px] group hover:shadow-[0_0_15px_rgba(139,92,246,0.05)] relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[9px] px-2 py-0.5 border border-purple-500/20 text-purple-400 bg-purple-500/5 rounded font-bold uppercase tracking-wider">
                          {template.category}
                        </span>
                        <div className="flex gap-1.5">
                          {template.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] text-slate-500">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <h3 className="font-semibold text-slate-200 group-hover:text-purple-400 transition-colors text-sm mb-1.5">
                        {template.name}
                      </h3>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                        {template.description}
                      </p>
                    </div>

                    <button
                      onClick={() => executeTemplate(template.id)}
                      disabled={executing}
                      className="w-full mt-4 py-2 px-4 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold hover:bg-slate-900 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                      Run Template
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-16 border border-dashed border-slate-800 rounded-2xl">
                  <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                  </svg>
                  <p className="text-slate-500 text-sm">No workflow templates loaded.</p>
                </div>
              )}
            </div>
          )}

          {/* 3. Automation Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Create Rule */}
              <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <h2 className="text-slate-200 font-semibold text-lg mb-1">Create Automatic Rule</h2>
                <p className="text-slate-400 text-xs mb-4">Set up a recurring automation rule that executes automatically on inbox updates</p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder="E.g., Star any emails originating from client.com and containing 'urgent'..."
                    className="flex-1 px-4 py-2.5 bg-slate-950/50 border border-slate-800 hover:border-slate-700/80 focus:border-purple-500/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:ring-1 focus:ring-purple-500/30 transition-all outline-none"
                  />
                  <button
                    onClick={createRule}
                    disabled={creatingRule || !newRule.trim()}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {creatingRule ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Rule
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Rules List */}
              <div className="space-y-4">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">
                  Active Automation Rules
                </span>
                
                {rules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rules.map(rule => (
                      <div 
                        key={rule.id} 
                        className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4 hover:border-slate-700/80 transition-all"
                      >
                        <div className="flex-1 space-y-1">
                          <h3 className="font-semibold text-slate-200 text-sm leading-tight">{rule.name}</h3>
                          <p className="text-slate-400 text-xs leading-relaxed">{rule.description}</p>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1">
                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Executed {rule.executionCount} times
                          </div>
                        </div>

                        {/* Slide Switch toggle */}
                        <button
                          onClick={() => toggleRule(rule.id, !rule.enabled)}
                          className="relative flex items-center cursor-pointer focus:outline-none mt-1"
                        >
                          <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 border ${
                            rule.enabled ? 'bg-purple-600/30 border-purple-500/30' : 'bg-slate-950 border-slate-850'
                          }`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 transform ${
                              rule.enabled ? 'translate-x-5 bg-purple-400' : 'translate-x-0.5 bg-slate-600'
                            } mt-0.5`} />
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                    <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2" />
                    </svg>
                    <p className="text-slate-500 text-sm">No automation rules configured.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Reminders Tab */}
          {activeTab === 'reminders' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Stats */}
              {reminderStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total backlog</p>
                    <p className="text-2xl font-bold text-slate-200 mt-1">{reminderStats.total}</p>
                  </div>
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Pending</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{reminderStats.pending}</p>
                  </div>
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Overdue</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">{reminderStats.overdue}</p>
                  </div>
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Upcoming (7d)</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{reminderStats.upcoming}</p>
                  </div>
                </div>
              )}

              {/* Reminders List */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">
                  Calendar Reminders
                </span>

                {reminders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reminders.map(reminder => (
                      <div 
                        key={reminder.id} 
                        className="bg-slate-900/30 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex items-start gap-4 transition-all"
                      >
                        <div className={`p-2 rounded-xl border flex-shrink-0 ${
                          reminder.status === 'overdue' 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 space-y-1">
                          <h3 className="font-semibold text-slate-200 text-sm leading-tight">{reminder.title}</h3>
                          {reminder.description && (
                            <p className="text-slate-400 text-xs leading-relaxed">{reminder.description}</p>
                          )}
                          <div className="flex items-center gap-3 pt-2">
                            <span className="text-[9px] px-2 py-0.5 border border-purple-500/20 text-purple-400 bg-purple-500/5 rounded font-bold uppercase tracking-wider">
                              {reminder.type}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(reminder.reminderDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                    <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-slate-500 text-sm">No scheduled calendar events or inbox reminders.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total Runs</p>
                    <p className="text-2xl font-bold text-slate-200 mt-1">{stats.totalExecutions}</p>
                  </div>
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Success Rate</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                      {stats.totalExecutions > 0 
                        ? `${((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(0)}%`
                        : '0%'
                      }
                    </p>
                  </div>
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Failed Runs</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">{stats.failedExecutions}</p>
                  </div>
                  <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Avg Run Time</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                      {(stats.averageDuration / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              )}

              {/* History List */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">
                  Workflow Execution Logs
                </span>

                {history.length > 0 ? (
                  <div className="space-y-2.5">
                    {history.map(execution => {
                      const wasSuccess = execution.status === 'completed';
                      return (
                        <div 
                          key={execution.id} 
                          className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            {/* Pulse indicator */}
                            <div className="relative flex items-center justify-center w-6 h-6 flex-shrink-0">
                              <span className={`absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping ${
                                wasSuccess ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                wasSuccess ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}></span>
                            </div>
                            
                            <div>
                              <h4 className="font-semibold text-slate-200 text-xs sm:text-sm">{execution.workflowName}</h4>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                                <span>Duration: {(execution.duration / 1000).toFixed(1)}s</span>
                                <span>•</span>
                                <span>{new Date(execution.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase border ${
                            wasSuccess 
                              ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' 
                              : 'border-rose-500/20 text-rose-400 bg-rose-500/5'
                          }`}>
                            {execution.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                    <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m9-.3V12a9 9 0 11-18 0" />
                    </svg>
                    <p className="text-slate-500 text-sm">No executions logged yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
