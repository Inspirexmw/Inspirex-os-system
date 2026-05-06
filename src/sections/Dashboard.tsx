import { useMemo, useState } from 'react';
import {
  TrendingUp,
  Award,
  Wallet,
  PiggyBank,
  Briefcase,
  Shield,
  Bell,
  Activity,
  Users,
  ArrowRight,
  Receipt,
  Calculator,
  ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/hooks/useAppState';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/stat-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { CashFlowChart } from '@/components/ui/cash-flow-chart';
import { BrandedTooltip } from '@/components/ui/branded-tooltip';
import { ActivityFeed } from '@/components/ui/activity-feed';
import { TeamRailItem } from '@/components/ui/team-rail';
import { NextStepsCard } from '@/components/ui/next-steps-card';
import { OperationsPulse } from '@/components/ui/operations-pulse';
import { StatusBadge, type StatusTone } from '@/components/ui/status-pill';
import { buildActivityFeed, buildCashFlowSeries } from '@/lib/activity-builder';

const fadeUpItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] as const } },
};
const staggerGrid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export function Dashboard({ onViewChange }: { onViewChange?: (view: import('@/types').ViewType) => void }) {
  const { state, dispatch, formatCurrency, getActiveMembers } = useApp();
  const [dashTab, setDashTab] = useState<'operations' | 'billing'>('operations');

  const activeMembers = getActiveMembers();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // ── METRICS ──────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const billingInvoices = (state.billing?.documents || []).filter((d: any) => d.type === 'invoice');
    const totalReceivedThisMonth = billingInvoices.reduce((sum: number, inv: any) =>
      sum + inv.payments.filter((p: any) => p.date?.startsWith(currentMonth))
                       .reduce((ps: number, p: any) => ps + p.mwkEquivalent, 0), 0);

    const totalRevenue = state.projects.filter(p => p.type === 'client' && p.month === currentMonth)
      .reduce((sum, p) => sum + p.revenue, 0);
    const totalBonusPool = state.projects.filter(p => p.month === currentMonth)
      .reduce((sum, p) => sum + p.bonusPool, 0);
    const totalCompanyContribution = state.projects.filter(p => p.month === currentMonth)
      .reduce((sum, p) => sum + p.companyContribution, 0);

    // ── Month-over-month deltas ──
    const prev = new Date();
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    const prevMonth = prev.toISOString().slice(0, 7);
    const prevRevenue = state.projects.filter(p => p.type === 'client' && p.month === prevMonth).reduce((s, p) => s + p.revenue, 0);
    const prevReceived = billingInvoices.reduce((sum: number, inv: any) =>
      sum + inv.payments.filter((p: any) => p.date?.startsWith(prevMonth)).reduce((ps: number, p: any) => ps + p.mwkEquivalent, 0), 0);
    const prevBonusPool = state.projects.filter(p => p.month === prevMonth).reduce((s, p) => s + p.bonusPool, 0);
    const prevCompanyContribution = state.projects.filter(p => p.month === prevMonth).reduce((s, p) => s + p.companyContribution, 0);
    const pctDelta = (curr: number, p: number): number | null => {
      if (p === 0) return curr === 0 ? 0 : null;
      return ((curr - p) / p) * 100;
    };

    const clientProjects = state.projects.filter(p => p.type === 'client' && p.month === currentMonth).length;
    const internalProjects = state.projects.filter(p => p.type === 'internal' && p.month === currentMonth).length;
    const impressionProjects = state.projects.filter(p => p.type === 'impression' && p.month === currentMonth).length;
    const retainedProfit = state.retainedProfit || 0;
    const totalDeferred = activeMembers.reduce((s, m) => s + (m.deferredStipendBalance || 0), 0);
    const totalStipends = activeMembers.reduce((s, m) => s + m.stipend, 0);

    // Auto-transfer prompt
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysToMonthEnd = lastDay - today.getDate();
    const isMonthEnd = daysToMonthEnd <= 2;
    const autoEnabled = state.settings.workingCapital?.autoTransferEnabled ?? false;
    const autoPct = state.settings.workingCapital?.autoTransferPercent ?? 0;
    const lastHandled = state.lastAutoTransferMonth || '';
    const autoTransferPending = isMonthEnd && autoEnabled && autoPct > 0 && lastHandled !== currentMonth;
    const confirmedThisMonth = state.projects.filter(p => p.month === currentMonth && p.type === 'client' && p.paymentStatus === 'confirmed');
    const monthCompanyFund = confirmedThisMonth.reduce((s, p) => s + p.companyContribution, 0);
    const suggestedTransfer = Math.round(monthCompanyFund * autoPct / 100);

    // Confirmed unpaid bonuses
    const confirmedUnpaidProjects = state.projects.filter(p => p.type === 'client' && p.paymentStatus === 'confirmed' && p.bonusPool > 0);
    const confirmedUnpaidBonuses = confirmedUnpaidProjects.reduce((s, p) => s + p.bonusPool, 0);

    return {
      totalRevenue, totalReceivedThisMonth, totalBonusPool, totalCompanyContribution,
      revenueDelta: pctDelta(totalRevenue, prevRevenue),
      receivedDelta: pctDelta(totalReceivedThisMonth, prevReceived),
      bonusPoolDelta: pctDelta(totalBonusPool, prevBonusPool),
      companyDelta: pctDelta(totalCompanyContribution, prevCompanyContribution),
      retainedProfit, totalDeferred, totalStipends,
      clientProjects, internalProjects, impressionProjects,
      autoTransferPending, suggestedTransfer, autoTransferPercent: autoPct,
      confirmedUnpaidBonuses, confirmedUnpaidProjects,
    };
  }, [state.projects, state.workLog, state.billing, state.retainedProfit, state.lastAutoTransferMonth, state.settings.workingCapital, activeMembers, currentMonth]);

  // ── WORK TYPE PIE ──────────────────────────────────────────────────
  const workTypeData = useMemo(() => [
    { name: 'Client', value: state.workLog.filter(e => e.type === 'client').reduce((s, e) => s + e.totalPoints, 0), color: '#73F764' },
    { name: 'Internal', value: state.workLog.filter(e => e.type === 'internal').reduce((s, e) => s + e.totalPoints, 0), color: '#4a9edd' },
    { name: 'Impression', value: state.workLog.filter(e => e.type === 'impression').reduce((s, e) => s + e.totalPoints, 0), color: '#e0a840' },
  ].filter(d => d.value > 0), [state.workLog]);

  // ── CASH FLOW SERIES ──────────────────────────────────────────────
  const cashFlow = useMemo(() => buildCashFlowSeries(state, 6), [state]);

  // ── ACTIVITY FEED ─────────────────────────────────────────────────
  const activity = useMemo(() => buildActivityFeed(state, 8), [state]);

  // ── RECENT PROJECTS ───────────────────────────────────────────────
  const recentProjects = useMemo(() =>
    [...state.projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [state.projects]);

  // ── NEXT STEPS ────────────────────────────────────────────────────
  const nextSteps = useMemo(() => {
    const steps: Array<{ id: string; label: string; detail?: string; icon: any; onClick: () => void }> = [];
    const overdue = (state.billing?.documents || []).filter((d: any) =>
      d.type === 'invoice' && d.status !== 'paid' && d.dueDate && new Date(d.dueDate) < new Date());
    if (overdue.length > 0) steps.push({
      id: 'overdue', label: `${overdue.length} overdue invoice${overdue.length !== 1 ? 's' : ''}`,
      detail: 'Follow up with clients', icon: Receipt, onClick: () => onViewChange?.('billing'),
    });
    if (metrics.confirmedUnpaidBonuses > 0) steps.push({
      id: 'bonuses', label: 'Pay team bonuses',
      detail: `${formatCurrency(metrics.confirmedUnpaidBonuses)} ready to distribute`,
      icon: Users, onClick: () => onViewChange?.('capital'),
    });
    const projectsWithoutScores = state.projects.filter(p => p.type === 'client' && p.distribution.length === 0).length;
    if (projectsWithoutScores > 0) steps.push({
      id: 'score', label: `${projectsWithoutScores} project${projectsWithoutScores !== 1 ? 's' : ''} need scoring`,
      detail: 'Assign team scores', icon: ListChecks, onClick: () => onViewChange?.('tasks'),
    });
    if (metrics.autoTransferPending && metrics.suggestedTransfer > 0) steps.push({
      id: 'transfer', label: 'Month-end transfer ready',
      detail: `${formatCurrency(metrics.suggestedTransfer)} from Company Fund`,
      icon: Wallet, onClick: () => onViewChange?.('capital'),
    });
    if (steps.length === 0) steps.push({
      id: 'create', label: 'Create a new project', detail: 'Run the calculator', icon: Calculator,
      onClick: () => onViewChange?.('calculator'),
    });
    return steps;
  }, [state.billing, state.projects, metrics, formatCurrency, onViewChange]);

  // ── BILLING DATA (for Billing tab) ───────────────────────────────
  const billing = state.billing;
  const invoices = billing.documents.filter(d => d.type === 'invoice');
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const overdueInvoices = unpaidInvoices.filter(i => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'paid');
  const pendingQuotes = billing.documents.filter(d => d.type === 'quote' && d.status === 'sent');
  const collectedThisMonth = invoices.reduce((s, inv) => {
    const m = new Date().toISOString().slice(0, 7);
    return s + inv.payments.filter(p => p.date.startsWith(m)).reduce((ps, p) => ps + p.mwkEquivalent, 0);
  }, 0);
  const totalOutstanding = unpaidInvoices.reduce((s, inv) => {
    const paid = inv.payments.reduce((ps, p) => ps + p.mwkEquivalent, 0);
    return s + Math.max(0, inv.total * ((inv as any).exchangeRate || 1) - paid);
  }, 0);

  // ── PROJECT STATUS TONE ──────────────────────────────────────────
  const projectStatusTone = (p: any): StatusTone =>
    p.paymentStatus === 'confirmed' ? 'lime'
    : p.paymentStatus === 'partial' ? 'amber'
    : 'blue';

  return (
    <div className="space-y-6">
      {/* HERO GREETING */}
      {(() => {
        const founder = (state.members || []).find(m => m.type === 'Founder' && m.isActive);
        const firstName = founder?.name?.split(' ')[0] || state.settings.companyName?.split(' ')[0] || 'there';
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return (
          <div className="relative overflow-hidden rounded-2xl px-7 py-7 bg-gradient-to-br from-primary/[0.07] via-card to-card">
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative flex items-start justify-between flex-wrap gap-6">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {greeting}, <span className="text-primary">{firstName}</span> 👋
                </h1>
                <p className="text-muted-foreground text-sm mt-2">{dateStr}</p>
              </div>
              <div className="flex gap-1 bg-secondary/40 p-1 rounded-xl">
                {(['operations', 'billing'] as const).map(tab => (
                  <button key={tab} onClick={() => setDashTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      dashTab === tab
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {tab === 'operations' ? '⚙ Operations' : '💼 Billing'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* AUTO-TRANSFER PROMPT */}
      {dashTab === 'operations' && metrics.autoTransferPending && metrics.suggestedTransfer > 0 && (() => {
        const handleApprove = () => {
          const wcBalance = state.wcBalance || 0;
          const newBalance = wcBalance + metrics.suggestedTransfer;
          dispatch({ type: 'ADD_WC_TRANSACTION', payload: {
            id: 'auto-transfer-' + Date.now(),
            date: new Date().toISOString().slice(0, 10),
            type: 'inflow',
            category: 'profit_to_wc_operations',
            amount: metrics.suggestedTransfer,
            description: 'Month-end auto-transfer — ' + metrics.autoTransferPercent + '% of company fund',
            balanceAfter: newBalance,
            autoGenerated: true,
          }});
          dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: new Date().toISOString().slice(0, 7) });
        };
        const handleSkip = () => dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: new Date().toISOString().slice(0, 7) });
        return (
          <div className="flex items-center justify-between gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0 animate-pulse" />
              <div>
                <div className="text-sm font-medium text-blue-400">Month-end transfer ready</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {metrics.autoTransferPercent}% of this month's company fund — {formatCurrency(metrics.suggestedTransfer)} suggested to transfer to Working Capital
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleSkip} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border">Skip</button>
              <button onClick={handleApprove} className="text-xs text-blue-400 font-medium hover:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10">
                Transfer {formatCurrency(metrics.suggestedTransfer)} →
              </button>
            </div>
          </div>
        );
      })()}

      {/* MAIN GRID — main column + right rail */}
      {dashTab === 'operations' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          {/* MAIN COLUMN */}
          <div className="space-y-6 min-w-0">
            {/* STAT ROW */}
            <motion.div variants={staggerGrid} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <motion.div variants={fadeUpItem}>
                <StatCard
                  title="Invoiced (Month)"
                  numericValue={metrics.totalRevenue}
                  format={formatCurrency}
                  delta={metrics.revenueDelta}
                  subtitle={`${metrics.clientProjects} project${metrics.clientProjects !== 1 ? 's' : ''} · projected`}
                  icon={TrendingUp}
                />
              </motion.div>
              <motion.div variants={fadeUpItem}>
                <StatCard
                  title="Received (Month)"
                  numericValue={metrics.totalReceivedThisMonth}
                  format={formatCurrency}
                  delta={metrics.receivedDelta}
                  subtitle="Cash received via Billing"
                  icon={Wallet}
                  accent
                />
              </motion.div>
              <motion.div variants={fadeUpItem}>
                <StatCard
                  title="Bonus Pool"
                  numericValue={metrics.totalBonusPool}
                  format={formatCurrency}
                  delta={metrics.bonusPoolDelta}
                  subtitle={`${state.settings.revenueSplit.bonusPercent}% of net profit`}
                  icon={Award}
                />
              </motion.div>
              <motion.div variants={fadeUpItem}>
                <StatCard
                  title="Company Fund"
                  numericValue={metrics.totalCompanyContribution}
                  format={formatCurrency}
                  delta={metrics.companyDelta}
                  subtitle={`${state.settings.revenueSplit.companyPercent}% of net profit`}
                  icon={Briefcase}
                />
              </motion.div>
            </motion.div>

            {/* OPERATIONS PULSE — compact strip, not 4 separate cards */}
            {(() => {
              const wc = state.wcBalance || 0;
              const runway = metrics.totalStipends > 0 ? Math.floor(wc / metrics.totalStipends) : 0;
              const amber = state.settings.workingCapital?.runwayAmberThreshold ?? 6;
              const red = state.settings.workingCapital?.runwayRedThreshold ?? 3;
              const burdenPct = wc > 0 && metrics.totalStipends > 0 ? Math.round((metrics.totalStipends / wc) * 100) : 0;
              const runwayLabel = metrics.totalStipends === 0 ? 'No stipends'
                : wc < metrics.totalStipends ? '< 1 mo'
                : `${runway} mo`;
              const runwayTone: 'lime' | 'amber' | 'red' = runway >= amber ? 'lime' : runway >= red ? 'amber' : 'red';
              const runwayProgressColor = runwayTone === 'lime' ? 'hsl(var(--primary))' : runwayTone === 'amber' ? '#fbbf24' : '#ef4444';
              const runwayProgress = metrics.totalStipends === 0 ? 100 : Math.min(100, (runway / Math.max(amber, 1)) * 100);

              return (
                <OperationsPulse
                  formatCurrency={formatCurrency}
                  stats={[
                    {
                      key: 'wc',
                      label: 'Working Capital',
                      value: wc,
                      icon: Wallet,
                      tone: 'lime',
                      hint: 'Operations account',
                      onClick: () => onViewChange?.('capital'),
                    },
                    {
                      key: 'runway',
                      label: 'Stipend Runway',
                      // Render the textual runway label using the format hook trick
                      value: runway,
                      format: () => runwayLabel,
                      icon: Shield,
                      tone: runwayTone,
                      hint: metrics.totalStipends === 0 ? 'No stipends configured' : `${burdenPct}% of WC for next payroll`,
                      progress: runwayProgress,
                      progressColor: runwayProgressColor,
                      onClick: () => onViewChange?.('capital'),
                    },
                    {
                      key: 'retained',
                      label: 'Retained Profit',
                      value: metrics.retainedProfit,
                      icon: PiggyBank,
                      tone: 'purple',
                      hint: 'Accumulated earnings',
                    },
                    {
                      key: 'deferred',
                      label: 'Deferred to Team',
                      value: metrics.totalDeferred,
                      icon: Users,
                      tone: metrics.totalDeferred > 0 ? 'red' : 'neutral',
                      hint: metrics.totalDeferred > 0 ? 'Owed — pay when WC allows' : 'No deferred ✓',
                    },
                  ]}
                />
              );
            })()}

            {/* CHARTS ROW: Cash Flow + Work Type Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cash Flow — spans 2 cols */}
              <Card className="bg-card border-border lg:col-span-2">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Last 6 months · WC, Bonus Bank, Company Fund</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-primary" /> WC</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-blue-400" /> Bonus Bank</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-purple-400" /> Co. Fund</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <CashFlowChart data={cashFlow} format={formatCurrency} height={260} />
                </CardContent>
              </Card>

              {/* Work Type Donut */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Work Distribution</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Points by work type</p>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const totalPts = workTypeData.reduce((s, w) => s + w.value, 0);
                    return (
                      <div className="h-[260px] flex flex-col items-center justify-center">
                        <div className="relative w-40 h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <defs>
                                {workTypeData.map((w, i) => (
                                  <linearGradient key={i} id={`pie-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor={w.color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={w.color} stopOpacity={0.55} />
                                  </linearGradient>
                                ))}
                              </defs>
                              <Pie data={workTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                                   paddingAngle={4} cornerRadius={4} dataKey="value" stroke="none" animationDuration={900}>
                                {workTypeData.map((_, i) => <Cell key={`c-${i}`} fill={`url(#pie-grad-${i})`} />)}
                              </Pie>
                              <Tooltip content={<BrandedTooltip format={(v) => `${v} pts`} />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="text-2xl font-semibold tabular"><AnimatedNumber value={totalPts} /></div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">total pts</div>
                          </div>
                        </div>
                        <div className="mt-4 w-full space-y-2">
                          {workTypeData.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center">No work logged yet</div>
                          ) : workTypeData.map(item => {
                            const pct = totalPts > 0 ? Math.round((item.value / totalPts) * 100) : 0;
                            return (
                              <div key={item.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="text-foreground/80">{item.name}</span>
                                </div>
                                <span className="font-semibold tabular">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* RECENT PROJECTS */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Recent Projects</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{recentProjects.length} most recent</p>
                </div>
                <button onClick={() => onViewChange?.('calculator')} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  See all <ArrowRight className="w-3 h-3" />
                </button>
              </CardHeader>
              <CardContent>
                {recentProjects.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8 italic">
                    No projects yet. Use the Project Calculator to create your first project.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {recentProjects.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.04 }}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{p.name}</span>
                              {p.type === 'client' && <StatusBadge tone={projectStatusTone(p)}>{p.paymentStatus || 'projected'}</StatusBadge>}
                              {p.type !== 'client' && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p.type}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {p.month} {p.type === 'client' ? `· ${formatCurrency(p.netProfit)} profit` : `· ${p.distribution.filter(d => d.totalScore > 0).length} scored`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold tabular text-primary">
                            {p.type === 'client' ? formatCurrency(p.bonusPool) : `${p.distribution.reduce((s, d) => s + d.totalScore, 0)} pts`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{p.type === 'client' ? 'bonus pool' : 'team points'}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT RAIL */}
          <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <NextStepsCard steps={nextSteps} subtitle="Smart suggestions based on your data" />

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {(() => {
                  const notes = (state.notifications || []).filter(n => !n.dismissed && !n.read).slice(0, 4);
                  if (notes.length === 0) {
                    return <div className="text-xs text-muted-foreground text-center py-4">No new notifications</div>;
                  }
                  return (
                    <ul className="space-y-2.5">
                      {notes.map(n => (
                        <li key={n.id} className="flex items-start gap-2.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground leading-tight">{n.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ActivityFeed items={activity} format={formatCurrency} emptyText="No financial activity yet" />
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  Team
                </CardTitle>
                <span className="text-[11px] text-muted-foreground tabular">{activeMembers.length}</span>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {activeMembers.slice(0, 6).map(m => (
                    <TeamRailItem
                      key={m.id}
                      member={m}
                      earnings={m.stipend}
                      format={formatCurrency}
                      onClick={() => onViewChange?.('team')}
                    />
                  ))}
                  {activeMembers.length > 6 && (
                    <button onClick={() => onViewChange?.('team')}
                      className="w-full text-xs text-muted-foreground hover:text-foreground py-2 mt-1">
                      + {activeMembers.length - 6} more →
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* BILLING TAB */}
      {dashTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Outstanding', value: `MK ${totalOutstanding.toLocaleString()}`, color: 'text-amber-400', sub: `${unpaidInvoices.length} unpaid` },
              { label: 'Overdue', value: overdueInvoices.length, color: overdueInvoices.length > 0 ? 'text-destructive' : 'text-primary', sub: overdueInvoices.length > 0 ? 'Needs attention' : 'All on time ✓' },
              { label: 'Collected (Month)', value: `MK ${collectedThisMonth.toLocaleString()}`, color: 'text-primary', sub: 'This month' },
              { label: 'Pending Quotes', value: pendingQuotes.length, color: 'text-blue-400', sub: 'Awaiting response' },
            ].map(({ label, value, color, sub }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</div>
                  <div className={`text-2xl font-semibold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <button onClick={() => onViewChange?.('billing')} className="text-xs text-primary hover:underline">Go to Billing →</button>
            </CardHeader>
            <CardContent>
              {unpaidInvoices.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-4 text-center">All invoices paid ✓</div>
              ) : (
                <div className="space-y-2">
                  {unpaidInvoices.slice(0, 5).map(inv => {
                    const client = billing.clients.find(c => c.id === inv.clientId);
                    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                    const remaining = inv.total - paid;
                    const overdue = inv.dueDate && new Date(inv.dueDate) < new Date();
                    const overdueDays = overdue && inv.dueDate ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000) : 0;
                    return (
                      <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg ${overdue ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary/30'}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{inv.number}</span>
                            {overdue && <StatusBadge tone="red">{overdueDays}d overdue</StatusBadge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{client?.name || '—'} · Due {inv.dueDate || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{inv.currency} {remaining.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">of {inv.currency} {inv.total.toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {pendingQuotes.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending Quotes</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingQuotes.map(q => {
                    const client = billing.clients.find(c => c.id === q.clientId);
                    return (
                      <div key={q.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">{q.number}</div>
                          <div className="text-xs text-muted-foreground">{client?.name || '—'} · Valid until {q.validUntil || '—'}</div>
                        </div>
                        <div className="text-sm font-semibold text-primary">{q.currency} {q.total.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
