import { monthProfit } from '@/lib/profit';
import { Figure } from '@/components/ui/figure';
import { useMemo, useState } from 'react';
import {
  Wallet,
  PiggyBank,
  Briefcase,
  Bell,
  Activity,
  ArrowRight,
  Receipt,
  FilePlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/hooks/useAppState';
import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/stat-card';
import { DeltaPill } from '@/components/ui/delta-pill';
import { CashFlowChart } from '@/components/ui/cash-flow-chart';
import { ActivityFeed } from '@/components/ui/activity-feed';
import { NextStepsCard } from '@/components/ui/next-steps-card';
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
  const { state, dispatch, formatCurrency } = useApp();
  const [dashTab, setDashTab] = useState<'operations' | 'billing'>('operations');

  const currentMonth = new Date().toISOString().slice(0, 7);

  // ── METRICS ──────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const billingInvoices = (state.billing?.documents || []).filter((d: any) => d.type === 'invoice');
    const receivedIn = (month: string) => billingInvoices.reduce((sum: number, inv: any) =>
      sum + (inv.payments || []).filter((p: any) => p.date?.startsWith(month))
                       .reduce((ps: number, p: any) => ps + (p.mwkEquivalent || p.amount || 0), 0), 0);
    const invoicedIn = (month: string) => billingInvoices
      .filter((inv: any) => (inv.issueDate || '').startsWith(month))
      .reduce((sum: number, inv: any) => sum + inv.total * (inv.exchangeRate || 1), 0);
    // Profit in a month = client payments received minus project costs
    const retainedIn = (month: string) => monthProfit(state, month);

    const totalReceivedThisMonth = receivedIn(currentMonth);
    const totalInvoicedThisMonth = invoicedIn(currentMonth);
    const retainedThisMonth = retainedIn(currentMonth);

    // ── Month-over-month deltas ──
    const prev = new Date();
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    const prevMonth = prev.toISOString().slice(0, 7);
    const pctDelta = (curr: number, p: number): number | null => {
      if (p === 0) return curr === 0 ? 0 : null;
      return ((curr - p) / p) * 100;
    };

    const retainedProfit = state.retainedProfit || 0;

    // Auto-transfer prompt
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysToMonthEnd = lastDay - today.getDate();
    const isMonthEnd = daysToMonthEnd <= 2;
    const autoEnabled = state.settings.workingCapital?.autoTransferEnabled ?? false;
    const autoPct = state.settings.workingCapital?.autoTransferPercent ?? 0;
    const lastHandled = state.lastAutoTransferMonth || '';
    const autoTransferPending = isMonthEnd && autoEnabled && autoPct > 0 && lastHandled !== currentMonth;
    const suggestedTransfer = Math.round(Math.max(0, retainedThisMonth) * autoPct / 100);

    return {
      totalReceivedThisMonth, totalInvoicedThisMonth, retainedThisMonth, retainedProfit,
      receivedDelta: pctDelta(totalReceivedThisMonth, receivedIn(prevMonth)),
      invoicedDelta: pctDelta(totalInvoicedThisMonth, invoicedIn(prevMonth)),
      retainedDelta: pctDelta(retainedThisMonth, retainedIn(prevMonth)),
      autoTransferPending, suggestedTransfer, autoTransferPercent: autoPct,
    };
  }, [state, state.billing, state.wcTransactions, state.retainedProfit, state.lastAutoTransferMonth, state.settings.workingCapital, currentMonth]);

  // ── CASH FLOW SERIES ──────────────────────────────────────────────
  const cashFlow = useMemo(() => buildCashFlowSeries(state, 6), [state]);

  // ── ACTIVITY FEED ─────────────────────────────────────────────────
  const activity = useMemo(() => buildActivityFeed(state, 8), [state]);

  // ── RECENT INVOICES ───────────────────────────────────────────────
  const recentInvoices = useMemo(() =>
    [...(state.billing?.documents || [])]
      .filter((d: any) => d.type === 'invoice')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    [state.billing]);

  // ── NEXT STEPS ────────────────────────────────────────────────────
  const nextSteps = useMemo(() => {
    const steps: Array<{ id: string; label: string; detail?: string; icon: any; onClick: () => void }> = [];
    const overdue = (state.billing?.documents || []).filter((d: any) =>
      d.type === 'invoice' && d.status !== 'paid' && d.dueDate && new Date(d.dueDate) < new Date());
    if (overdue.length > 0) steps.push({
      id: 'overdue', label: `${overdue.length} overdue invoice${overdue.length !== 1 ? 's' : ''}`,
      detail: 'Follow up with clients', icon: Receipt, onClick: () => onViewChange?.('billing'),
    });
    if (metrics.autoTransferPending && metrics.suggestedTransfer > 0) steps.push({
      id: 'transfer', label: 'Month-end transfer ready',
      detail: `${formatCurrency(metrics.suggestedTransfer)} from Retained Profit`,
      icon: Wallet, onClick: () => onViewChange?.('capital'),
    });
    if (steps.length === 0) steps.push({
      id: 'create', label: 'Create a new quote', detail: 'Start from Billing', icon: FilePlus,
      onClick: () => onViewChange?.('billing'),
    });
    return steps;
  }, [state.billing, metrics, formatCurrency, onViewChange]);

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

  // ── INVOICE STATUS TONE ──────────────────────────────────────────
  const invoiceTone = (i: any): StatusTone => {
    const isOverdue = i.status !== 'paid' && i.dueDate && new Date(i.dueDate) < new Date();
    return i.status === 'paid' ? 'lime' : isOverdue ? 'red' : i.status === 'partial' ? 'amber' : 'blue';
  };

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
            description: 'Month-end auto-transfer — ' + metrics.autoTransferPercent + '% of retained profit',
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
                  {metrics.autoTransferPercent}% of this month's retained profit — {formatCurrency(metrics.suggestedTransfer)} suggested to transfer to Working Capital
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
            {/* STAT ROW — 4 cards: Income · Profit · Working Capital · Retained Profit */}
            <motion.div variants={staggerGrid} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Income — Received (primary) + Invoiced (secondary) */}
              <motion.div variants={fadeUpItem}>
                <Card className="bg-card border-border h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Received (Month)</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <DeltaPill value={metrics.receivedDelta} size="xs" />
                        <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                          <Wallet className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 min-w-0">
                      <Figure value={metrics.totalReceivedThisMonth} format={formatCurrency} className="text-primary" />
                    </div>
                    <p className="text-[11px] text-blue-400/80 mt-2 whitespace-nowrap truncate" title={'Invoiced this month: ' + formatCurrency(Math.round(metrics.totalInvoicedThisMonth))}>
                      Invoiced <span className="font-semibold tabular">{formatCurrency(Math.round(metrics.totalInvoicedThisMonth))}</span>
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Profit earned this month (100% of payments) */}
              <motion.div variants={fadeUpItem}>
                <Card className="bg-card border-border h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Profit (Month)</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <DeltaPill value={metrics.retainedDelta} size="xs" />
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 min-w-0">
                      <Figure value={metrics.retainedThisMonth} format={formatCurrency} className="text-amber-400" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">Payments received minus project costs</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Working Capital */}
              <motion.div variants={fadeUpItem}>
                <StatCard
                  title="Working Capital"
                  numericValue={state.wcBalance || 0}
                  format={formatCurrency}
                  subtitle="Operations account · click to manage"
                  icon={Wallet}
                  onClick={() => onViewChange?.('capital')}
                />
              </motion.div>

              {/* Retained Profit */}
              <motion.div variants={fadeUpItem}>
                <StatCard
                  title="Retained Profit"
                  numericValue={metrics.retainedProfit}
                  format={formatCurrency}
                  subtitle="Accumulated earnings"
                  icon={PiggyBank}
                />
              </motion.div>
            </motion.div>

            {/* CASH FLOW */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Last 6 months · Working Capital and Retained Profit</p>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-primary" /> WC</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-purple-400" /> Retained Profit</span>
                </div>
              </CardHeader>
              <CardContent>
                <CashFlowChart data={cashFlow} format={formatCurrency} height={260} />
              </CardContent>
            </Card>

            {/* RECENT INVOICES */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Recent Invoices</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{recentInvoices.length} most recent</p>
                </div>
                <button onClick={() => onViewChange?.('billing')} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  See all <ArrowRight className="w-3 h-3" />
                </button>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8 italic">
                    No invoices yet. Create a quote or invoice in Billing to get started.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {recentInvoices.map((inv: any, i: number) => {
                      const client = state.billing.clients.find((c: any) => c.id === inv.clientId);
                      const isOverdue = inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
                      return (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {(client?.name || inv.number).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{inv.number}</span>
                                <StatusBadge tone={invoiceTone(inv)}>{isOverdue ? 'overdue' : inv.status}</StatusBadge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{client?.name || '—'}{inv.projectName ? ` · ${inv.projectName}` : ''}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold tabular text-primary">{inv.currency} {inv.total.toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">{inv.dueDate ? `due ${inv.dueDate}` : 'no due date'}</div>
                          </div>
                        </motion.div>
                      );
                    })}
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
