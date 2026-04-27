import { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  Clock, 
  Award,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Wallet,
  PiggyBank,
  Briefcase
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/hooks/useAppState';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { TrendData } from '@/types';
import { motion } from 'framer-motion';

const fadeUpItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] as const } },
};
const staggerGrid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export function Dashboard({ onViewChange }: { onViewChange?: (view: import('@/types').ViewType) => void }) {
  const { state, dispatch, formatCurrency, getActiveMembers, getCommitmentData } = useApp();
  const [dashTab, setDashTab] = useState<'operations' | 'billing'>('operations');
  
  const activeMembers = getActiveMembers();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Calculate metrics
  const metrics = useMemo(() => {
    // ── Revenue from Billing (source of truth) ──
    // Invoiced = total invoice amounts for projects this month (projected)
    // Received = actual payments received in Billing this month (confirmed)
    const billingInvoices = (state.billing?.documents || []).filter((d: any) => d.type === 'invoice');
    const totalReceivedThisMonth = billingInvoices
      .reduce((sum: number, inv: any) =>
        sum + inv.payments
          .filter((p: any) => p.date?.startsWith(currentMonth))
          .reduce((ps: number, p: any) => ps + p.mwkEquivalent, 0), 0);

    // Outstanding = unpaid invoice balances across all time (in MWK equivalent)
    const totalOutstandingFromBilling = billingInvoices
      .filter((inv: any) => inv.status !== 'paid')
      .reduce((sum: number, inv: any) => {
        const paid = inv.payments.reduce((ps: number, p: any) => ps + p.mwkEquivalent, 0);
        return sum + Math.max(0, inv.total * (inv.exchangeRate || 1) - paid);
      }, 0);

    // Project-level metrics still from Calculator (projected figures)
    const totalRevenue = state.projects
      .filter(p => p.type === 'client' && p.month === currentMonth)
      .reduce((sum, p) => sum + p.revenue, 0);
    const totalNetProfit = state.projects
      .filter(p => p.type === 'client' && p.month === currentMonth)
      .reduce((sum, p) => sum + p.netProfit, 0);
    const totalBonusPool = state.projects
      .filter(p => p.month === currentMonth)
      .reduce((sum, p) => sum + p.bonusPool, 0);
    const totalCompanyContribution = state.projects
      .filter(p => p.month === currentMonth)
      .reduce((sum, p) => sum + p.companyContribution, 0);

    const totalPoints = state.workLog
      .filter(e => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.totalPoints, 0);
    
    const clientProjects = state.projects.filter(p => p.type === 'client' && p.month === currentMonth).length;
    // Retained profit
    // retainedProfit — single source of truth, driven by Billing payments only
    const retainedProfit = state.retainedProfit || 0;

    // Months of runway — requires at least 2 months of outflow data
    const last3Months = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      return d.toISOString().slice(0, 7);
    });
    const burnByMonth = last3Months.map(m => ({
      month: m,
      burn: (state.wcTransactions || [])
        .filter(t => t.type === 'outflow' && t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0),
    }));
    const monthsWithData = burnByMonth.filter(b => b.burn > 0).length;
    const totalBurn = burnByMonth.reduce((s, b) => s + b.burn, 0);
    const avgMonthlyBurn = monthsWithData > 0 ? totalBurn / monthsWithData : 0;
    const hasEnoughRunwayData = monthsWithData >= 2;
    const monthsOfRunway = hasEnoughRunwayData && avgMonthlyBurn > 0 ? retainedProfit / avgMonthlyBurn : 0;

    // Total deferred
    const totalDeferred = activeMembers.reduce((s, m) => s + (m.deferredStipendBalance || 0), 0);

    // ── Month-end auto-transfer prompt ──
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysUntilMonthEnd = lastDayOfMonth - today.getDate();
    const isMonthEndWindow = daysUntilMonthEnd <= 2; // within last 3 days (0,1,2 days remaining)
    const autoTransferEnabled = state.settings.workingCapital?.autoTransferEnabled ?? false;
    const autoTransferPercent = state.settings.workingCapital?.autoTransferPercent ?? 0;
    const lastHandled = state.lastAutoTransferMonth || '';
    const autoTransferPending = (
      isMonthEndWindow &&
      autoTransferEnabled &&
      autoTransferPercent > 0 &&
      lastHandled !== currentMonth
    );
    // Calculate suggested transfer: X% of this month's confirmed company contributions
    const confirmedMonthProjects = state.projects.filter(p =>
      p.month === currentMonth && p.type === 'client' && p.paymentStatus === 'confirmed'
    );
    const monthCompanyFund = confirmedMonthProjects.reduce((s, p) => s + p.companyContribution, 0);
    const suggestedTransfer = Math.round(monthCompanyFund * autoTransferPercent / 100);

    // Confirmed projects with unpaid bonuses
    // A project is "bonus unpaid" if paymentStatus=confirmed but no WC payroll tx covers its period
    const confirmedUnpaidProjects = state.projects.filter(p =>
      p.type === 'client' &&
      p.paymentStatus === 'confirmed' &&
      p.bonusPool > 0
    );
    const confirmedUnpaidBonuses = confirmedUnpaidProjects.reduce((s, p) => s + p.bonusPool, 0);

    const totalOutstanding = totalOutstandingFromBilling;
    const internalProjects = state.projects.filter(p => p.type === 'internal' && p.month === currentMonth).length;
    const totalStipends = activeMembers.reduce((s, m) => s + m.stipend, 0);
    const impressionProjects = state.projects.filter(p => p.type === 'impression' && p.month === currentMonth).length;
    
    return {
      totalRevenue,
      totalNetProfit,
      totalBonusPool,
      totalCompanyContribution,
      totalStipends,
      totalOutstanding,
      totalReceivedThisMonth,
      retainedProfit,
      monthsOfRunway,
      totalDeferred,
      avgMonthlyBurn,
      totalPoints,
      clientProjects,
      internalProjects,
      impressionProjects,
      confirmedUnpaidBonuses,
      confirmedUnpaidProjects,
      autoTransferPending,
      suggestedTransfer,
      autoTransferPercent,
      hasEnoughRunwayData,
      monthsWithData,
    };
  }, [state.projects, state.workLog, activeMembers, currentMonth]);

  // Working Capital health
  const wcHealth = useMemo(() => {
    const balance = state.wcBalance || 0;
    const lowBalanceAlert = state.settings.workingCapital?.lowBalanceAlert ?? 300000;
    const hasTransactions = state.wcTransactions && state.wcTransactions.length > 0;

    // No transactions yet — not set up
    if (balance === 0 && !hasTransactions) {
      return { status: 'setup', color: 'text-muted-foreground', bg: 'bg-secondary/50', border: 'border-border', icon: <Wallet className="w-5 h-5" />, message: 'Working Capital not set up yet — add your first top-up in the Working Capital Bank' };
    }
    // Below alert threshold — critical
    if (balance < lowBalanceAlert && hasTransactions) {
      return { status: 'alert', color: 'text-destructive', bg: 'bg-destructive/20', border: 'border-destructive/30', icon: <AlertTriangle className="w-5 h-5" />, message: `Low Working Capital — ${formatCurrency(balance)} available. Top up needed.` };
    }
    // Healthy — balance is at or above the alert threshold
    return { status: 'healthy', color: 'text-primary', bg: 'bg-primary/20', border: 'border-primary/30', icon: <Wallet className="w-5 h-5" />, message: `Working Capital healthy — ${formatCurrency(balance)} available` };
  }, [state.wcBalance, state.wcTransactions, state.settings.workingCapital, formatCurrency]);

  // Monthly trend data
  const trendData: TrendData[] = useMemo(() => {
    const months = Array.from(new Set(state.projects.map(p => p.month))).sort().slice(-6);
    return months.map(month => {
      const monthProjects = state.projects.filter(p => p.month === month && p.type === 'client');
      return {
        month: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        netProfit: monthProjects.reduce((sum, p) => sum + p.netProfit, 0),
        bonusPool: state.projects.filter(p => p.month === month).reduce((sum, p) => sum + p.bonusPool, 0),
        companyFund: state.projects.filter(p => p.month === month).reduce((sum, p) => sum + p.companyContribution, 0),
      };
    });
  }, [state.projects]);

  // Work type distribution
  const workTypeData = useMemo(() => [
    { name: 'Client', value: state.workLog.filter(e => e.type === 'client').reduce((s, e) => s + e.totalPoints, 0), color: '#73F764' },
    { name: 'Internal', value: state.workLog.filter(e => e.type === 'internal').reduce((s, e) => s + e.totalPoints, 0), color: '#4a9edd' },
    { name: 'Impression', value: state.workLog.filter(e => e.type === 'impression').reduce((s, e) => s + e.totalPoints, 0), color: '#e0a840' },
  ].filter(d => d.value > 0), [state.workLog]);

  // Top performers by commitment score
  const topPerformers = useMemo(() => {
    return activeMembers
      .map(m => ({ 
        ...m, 
        commitment: getCommitmentData(m.id)
      }))
      .sort((a, b) => b.commitment.contributionBankPoints - a.commitment.contributionBankPoints)
      .slice(0, 6);
  }, [activeMembers, getCommitmentData]);

  // Recent projects
  const recentProjects = useMemo(() => {
    return [...state.projects]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [state.projects]);

  // Total contribution bank points
  const totalContributionBank = useMemo(() => {
    return activeMembers.reduce((sum, m) => sum + m.contributionBank.currentQuarterPoints, 0);
  }, [activeMembers]);

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendUp,
    accent = false,
    onClick,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    trend?: string;
    trendUp?: boolean;
    accent?: boolean;
    onClick?: () => void;
  }) => (
    <motion.div variants={fadeUpItem} whileHover={{ y: -2, transition: { duration: 0.15 } }} className="h-full">
      <Card
        className={`bg-card border transition-all h-full ${
          accent ? 'border-primary/25 relative overflow-hidden accent-top' : 'border-border hover:border-primary/20'
        } ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{title}</p>
              <p className={`text-xl font-semibold leading-tight mt-2 tracking-tight whitespace-nowrap ${accent ? 'text-primary' : 'text-foreground'}`}>
                {value}
              </p>
              {subtitle && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>}
              {trend && (
                <div className={`inline-flex items-center gap-1 mt-2 text-xs font-medium px-1.5 py-0.5 rounded ${
                  trendUp ? 'text-primary bg-primary/10' : 'text-destructive bg-destructive/10'
                }`}>
                  {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {trend}
                </div>
              )}
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              accent ? 'bg-primary/15' : 'bg-secondary'
            }`}>
              <Icon className={`w-4 h-4 ${accent ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Billing health data
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Month-end auto-transfer prompt */}
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
        const handleSkip = () => {
          dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: new Date().toISOString().slice(0, 7) });
        };
        return (
          <div className="flex items-center justify-between gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0 animate-pulse" />
              <div>
                <div className="text-sm font-medium text-blue-400">Month-end transfer ready</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {metrics.autoTransferPercent}% of this month's company fund — {formatCurrency(metrics.suggestedTransfer)} suggested to transfer to Working Capital
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleSkip} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">Skip</button>
              <button onClick={handleApprove} className="text-xs text-blue-400 font-medium hover:text-blue-300 px-3 py-1 rounded border border-blue-500/30 bg-blue-500/10">
                Transfer {formatCurrency(metrics.suggestedTransfer)} →
              </button>
            </div>
          </div>
        );
      })()}

      {/* Confirmed unpaid bonuses alert */}
      {dashTab === 'operations' && metrics.confirmedUnpaidBonuses > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-primary">{metrics.confirmedUnpaidProjects.length} project{metrics.confirmedUnpaidProjects.length !== 1 ? 's' : ''} fully paid</span>
              <span className="text-muted-foreground ml-1">— {formatCurrency(metrics.confirmedUnpaidBonuses)} in team bonuses ready to distribute</span>
            </div>
          </div>
          <button onClick={() => onViewChange?.('capital')}
            className="text-xs text-primary font-medium hover:underline whitespace-nowrap">
            Pay via WC →
          </button>
        </div>
      )}

      {/* Header + tabs */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your system performance</p>
        </div>
        <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
          {(['operations', 'billing'] as const).map(tab => (
            <button key={tab} onClick={() => setDashTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                dashTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab === 'operations' ? '⚙ Operations' : '💼 Billing'}
            </button>
          ))}
        </div>
      </div>

      {/* Billing health view */}
      {dashTab === 'billing' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Outstanding', value: `MK ${totalOutstanding.toLocaleString()}`, color: 'text-amber-400', sub: `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length !== 1 ? 's' : ''}` },
              { label: 'Overdue', value: overdueInvoices.length, color: overdueInvoices.length > 0 ? 'text-destructive' : 'text-primary', sub: overdueInvoices.length > 0 ? 'Needs attention' : 'All on time ✓' },
              { label: 'Collected (Month)', value: `MK ${collectedThisMonth.toLocaleString()}`, color: 'text-primary', sub: 'This month' },
              { label: 'Pending Quotes', value: pendingQuotes.length, color: 'text-blue-400', sub: 'Awaiting response' },
            ].map(({ label, value, color, sub }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                  <div className={`text-2xl font-semibold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Unpaid invoices list */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
                <button onClick={() => onViewChange?.('billing')} className="text-xs text-primary hover:underline">Go to Billing →</button>
              </div>
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
                            {overdue && <span className="text-[10px] text-destructive font-medium">{overdueDays}d overdue</span>}
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

          {/* Pending quotes */}
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

      {/* Operations view — original dashboard */}
      {dashTab === 'operations' && <>

      {/* Stipend Health Indicator */}
      <Card className={`bg-card ${wcHealth.border} border-2`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${wcHealth.bg} flex items-center justify-center ${wcHealth.color}`}>
              {wcHealth.icon}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${wcHealth.color}`}>
                Working Capital: {wcHealth.status === 'healthy' ? 'Healthy' : wcHealth.status === 'caution' ? 'Caution' : 'Alert'}
              </div>
              <div className="text-sm text-muted-foreground">
                {wcHealth.message}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                Received this month (Billing)
              </div>
              <div className="text-lg font-semibold">{formatCurrency(metrics.totalReceivedThisMonth)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <motion.div variants={staggerGrid} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Invoiced (Month)"
          value={formatCurrency(metrics.totalRevenue)}
          subtitle={`${metrics.clientProjects} project${metrics.clientProjects !== 1 ? 's' : ''} · projected`}
          icon={TrendingUp}
        />
        <StatCard
          title="Received (Month)"
          value={formatCurrency(metrics.totalReceivedThisMonth)}
          subtitle="Cash received via Billing"
          icon={Wallet}
          accent
        />
        <StatCard
          title="Bonus Pool"
          value={formatCurrency(metrics.totalBonusPool)}
          subtitle={`${state.settings.revenueSplit.bonusPercent}% of net profit · projected`}
          icon={Award}
        />
        <StatCard
          title="Company Fund"
          value={formatCurrency(metrics.totalCompanyContribution)}
          subtitle={`${state.settings.revenueSplit.companyPercent}% of net profit · projected`}
          icon={Briefcase}
        />
      </motion.div>

      {/* Secondary Metrics */}
      <motion.div variants={staggerGrid} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Working Capital"
          value={formatCurrency(state.wcBalance || 0)}
          subtitle="Click to manage → Working Capital Bank"
          icon={Wallet}
          onClick={() => onViewChange?.('capital')}
        />
        <StatCard
          title="Monthly Stipends"
          value={formatCurrency(activeMembers.reduce((s, m) => s + m.stipend, 0))}
          subtitle="Pay from Working Capital"
          icon={PiggyBank}
        />
        <StatCard
          title="Contribution Bank"
          value={`${totalContributionBank} pts`}
          subtitle="Team points this quarter"
          icon={Clock}
        />
      </motion.div>

      {/* Project Counts */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">{metrics.clientProjects}</div>
              <div className="text-xs text-muted-foreground">Client Projects</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{metrics.internalProjects}</div>
              <div className="text-xs text-muted-foreground">Internal Projects</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{metrics.impressionProjects}</div>
              <div className="text-xs text-muted-foreground">Impression Projects</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retained Profit / Runway / Deferred Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Retained Profit */}
        <Card className="bg-card border-border border-primary/20">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Retained Profit</div>
            <div className="text-2xl font-semibold text-primary">{formatCurrency(metrics.retainedProfit)}</div>
            <div className="text-xs text-muted-foreground mt-1">Accumulated company earnings</div>
          </CardContent>
        </Card>

        {/* Months of Runway */}
        <Card className={`bg-card border ${
          !metrics.hasEnoughRunwayData
            ? 'border-border'
            : metrics.monthsOfRunway < (state.settings.workingCapital?.runwayRedThreshold ?? 3)
            ? 'border-destructive/50'
            : metrics.monthsOfRunway < (state.settings.workingCapital?.runwayAmberThreshold ?? 6)
            ? 'border-amber-500/50'
            : 'border-primary/30'
        }`}>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Months of Runway</div>
            <div className={`text-2xl font-semibold ${
              !metrics.hasEnoughRunwayData
                ? 'text-muted-foreground'
                : metrics.monthsOfRunway < (state.settings.workingCapital?.runwayRedThreshold ?? 3)
                ? 'text-destructive'
                : metrics.monthsOfRunway < (state.settings.workingCapital?.runwayAmberThreshold ?? 6)
                ? 'text-amber-400'
                : 'text-primary'
            }`}>
              {metrics.hasEnoughRunwayData && metrics.monthsOfRunway > 0
                ? `${metrics.monthsOfRunway.toFixed(1)} mo`
                : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {!metrics.hasEnoughRunwayData
                ? `Need 2+ months of expense data (${metrics.monthsWithData} recorded)`
                : `Avg burn: ${formatCurrency(Math.round(metrics.avgMonthlyBurn))}/mo`}
            </div>
          </CardContent>
        </Card>

        {/* Deferred to Team */}
        <Card className={`bg-card border ${metrics.totalDeferred > 0 ? 'border-red-500/40' : 'border-border'}`}>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Deferred to Team</div>
            <div className={`text-2xl font-semibold ${metrics.totalDeferred > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {metrics.totalDeferred > 0 ? formatCurrency(metrics.totalDeferred) : 'MK 0'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.totalDeferred > 0 ? 'Owed to team — pay when WC allows' : 'No deferred stipends ✓'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Financial Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#9a9490" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#9a9490" 
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `${v/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#1e1e1e', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px'
                    }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Bar dataKey="netProfit" name="Net Profit" fill="#73F764" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="bonusPool" name="Bonus Pool" fill="#4a9edd" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Work Distribution */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Work Type Distribution (Points)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={workTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {workTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: '#1e1e1e', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px'
                    }}
                    formatter={(v: number) => `${v} pts`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {workTypeData.map(item => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-medium">{item.value} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Pulse */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Team Pulse</CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">{topPerformers.length} active</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerformers.map((member, i) => {
                const maxPts = Math.max(...topPerformers.map(m => m.commitment.contributionBankPoints), 1);
                const pct = maxPts > 0 ? (member.commitment.contributionBankPoints / maxPts) * 100 : 0;
                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.28 }}
                    className="flex items-center gap-3"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-primary">
                        {member.name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="min-w-0">
                          <span className="text-sm font-medium leading-none block truncate">{member.name}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5 block">{member.role}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary tabular-nums ml-3 flex-shrink-0">
                          {member.commitment.contributionBankPoints}
                        </span>
                      </div>
                      <div className="h-[3px] bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.55, delay: i * 0.05 + 0.2, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {topPerformers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No team data yet. Log work entries to see pulse.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProjects.map(project => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{project.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        project.type === 'client' ? 'bg-green-500/20 text-green-400' :
                        project.type === 'internal' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {project.type}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {project.month}{project.type === 'client' ? ` · Net Profit: ${formatCurrency(project.netProfit)}` : ` · ${project.distribution.filter(d => d.totalScore > 0).length} members scored`}
                    </div>
                  </div>
                  <div className="text-right">
                    {project.type === 'client' ? (
                      <>
                        <div className="text-sm font-semibold text-primary">{formatCurrency(project.bonusPool)}</div>
                        <div className="text-xs text-muted-foreground">bonus pool</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-amber-400">
                          {project.distribution.reduce((s, d) => s + d.totalScore, 0)} pts
                        </div>
                        <div className="text-xs text-muted-foreground">team points</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {recentProjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No projects yet. Use the Project Calculator to create your first project.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </> }
    </div>
  );

  
}
