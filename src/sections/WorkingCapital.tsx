import { useState, useMemo, useCallback } from 'react';
import { Plus, Download, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight,
         TrendingUp, Edit2, Trash2, Check, X, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import type { WCTransaction, WCCategory } from '@/types';

// ─── Category Config ──────────────────────────────────────────────────────────

const INFLOW_CATS: { value: WCCategory; label: string }[] = [
  { value: 'client_payment',          label: '💼 Client Payment' },
  { value: 'profit_to_wc_operations', label: '🔄 From Profit — Operations' },
  { value: 'profit_to_wc_capital',    label: '📈 From Profit — Capital Investment' },
  { value: 'manual_topup',            label: '💰 Manual Top-up' },
  { value: 'other',                   label: '📝 Other Inflow' },
];

const OUTFLOW_CATS: { value: WCCategory; label: string }[] = [
  { value: 'salary',          label: '👤 Salary / Stipend' },
  { value: 'bonus',           label: '🎯 Team Bonus' },
  { value: 'bill',            label: '🧾 Bill / Utility / Internet' },
  { value: 'subscription',    label: '💻 Subscription (monthly)' },
  { value: 'project_expense', label: '📦 Project Expense' },
  { value: 'transport',       label: '🚗 Transport / Travel' },
  { value: 'marketing',       label: '📣 Marketing / Promotions' },
  { value: 'equipment',       label: '🖥 Equipment Purchase' },
  { value: 'software',        label: '💿 Software (one-time)' },
  { value: 'training',        label: '🎓 Training / Conference' },
  { value: 'other',           label: '📝 Other Expense' },
];

const CAPITAL_CATS: WCCategory[] = ['equipment', 'software', 'training', 'profit_to_wc_capital'];

const CAT_LABEL: Partial<Record<WCCategory, string>> = {
  client_payment:          '💼 Client Payment',
  client_to_retained:      '📊 Auto: → Retained Profit',
  profit_to_wc_operations: '🔄 Profit Transfer (Ops)',
  profit_to_wc_capital:    '📈 Profit Transfer (Capital)',
  manual_topup:            '💰 Top-up',
  payroll:                 '💵 Payroll',
  salary:                  '👤 Salary / Stipend',
  bonus:                   '🎯 Bonus',
  bill:                    '🧾 Bill',
  subscription:            '💻 Subscription',
  project_expense:         '📦 Project Expense',
  transport:               '🚗 Transport',
  marketing:               '📣 Marketing',
  equipment:               '🖥 Equipment',
  software:                '💿 Software',
  training:                '🎓 Training',
  wc_transfer:             '🔄 Transfer',
  other:                   '📝 Other',
};

const CAT_COLOR: Partial<Record<WCCategory, string>> = {
  client_payment:          'text-green-400',
  client_to_retained:      'text-amber-400',
  profit_to_wc_operations: 'text-primary',
  payroll:                 'text-blue-400',
  profit_to_wc_capital:    'text-blue-400',
  manual_topup:            'text-emerald-400',
  salary:                  'text-blue-400',
  bonus:                   'text-primary',
  bill:                    'text-red-400',
  subscription:            'text-purple-400',
  project_expense:         'text-amber-400',
  transport:               'text-orange-400',
  marketing:               'text-pink-400',
  equipment:               'text-cyan-400',
  software:                'text-indigo-400',
  training:                'text-teal-400',
  other:                   'text-muted-foreground',
};

export function WorkingCapital() {
  const { state, dispatch, formatCurrency, getActiveMembers, getContributionBankReward } = useApp();
  const { toast } = useToast();
  const activeMembers = getActiveMembers();

  // Form state
  const [txType, setTxType] = useState<'inflow' | 'outflow'>('inflow');
  const [txCat, setTxCat] = useState<WCCategory>('client_payment');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txAsset, setTxAsset] = useState('');

  // Filter state
  const [filterMonth, setFilterMonth] = useState('all-months');
  const [filterCat, setFilterCat] = useState('all');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [expandedPayrollGroups, setExpandedPayrollGroups] = useState<Set<string>>(new Set());
  const [editCat, setEditCat] = useState<WCCategory>('other');
  const [editDate, setEditDate] = useState('');

  // Pay stipends panel
  const [showStipendPanel, setShowStipendPanel] = useState(false);
  const [stipendAmounts, setStipendAmounts] = useState<Record<string, string>>({});

  const currentMonth = new Date().toISOString().slice(0, 7);
  const wcBalance = state.wcBalance || 0;
  const wcTransactions = state.wcTransactions || [];
  const retainedProfit = state.retainedProfit || 0;
  const lowBalanceAlert = state.settings.workingCapital?.lowBalanceAlert ?? 300000;

  // Month-end auto-transfer prompt
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysUntilMonthEnd = lastDayOfMonth - today.getDate();
  const autoTransferEnabled = state.settings.workingCapital?.autoTransferEnabled ?? false;
  const autoTransferPercent = state.settings.workingCapital?.autoTransferPercent ?? 0;
  const lastHandled = state.lastAutoTransferMonth || '';
  const autoTransferPending = daysUntilMonthEnd <= 2 && autoTransferEnabled && autoTransferPercent > 0 && lastHandled !== currentMonth;
  // Derive confirmed status from billing data directly — fixes stale paymentStatus in localStorage
  const confirmedProjectIds = useMemo(() => {
    const ids = new Set<string>();
    state.projects.forEach((p: any) => {
      if (p.paymentStatus === 'confirmed') { ids.add(p.id); return; }
      if (!p.billingInvoiceId) return;
      const inv = (state.billing.documents || []).find((d: any) => d.id === p.billingInvoiceId);
      if (!inv) return;
      const totalPaid = (inv.payments || []).reduce((s: number, pay: any) => s + (pay.mwkEquivalent || pay.amount || 0), 0);
      if (totalPaid >= inv.total * (inv.exchangeRate || 1)) ids.add(p.id);
    });
    return ids;
  }, [state.projects, state.billing.documents]);

  const confirmedMonthProjects = state.projects.filter(p => p.month === currentMonth && p.type === 'client' && confirmedProjectIds.has(p.id));
  const monthCompanyFund = confirmedMonthProjects.reduce((s, p) => s + p.companyContribution, 0);
  const suggestedTransfer = Math.round(monthCompanyFund * autoTransferPercent / 100);

  const handleAutoTransferApprove = () => {
    if (suggestedTransfer <= 0) return;
    const newBalance = wcBalance + suggestedTransfer;
    dispatch({ type: 'ADD_WC_TRANSACTION', payload: {
      id: 'auto-transfer-' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      type: 'inflow',
      category: 'profit_to_wc_operations',
      amount: suggestedTransfer,
      description: 'Month-end auto-transfer — ' + autoTransferPercent + '% of company fund',
      balanceAfter: newBalance,
      autoGenerated: true,
    }});
    dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: currentMonth });
    toast({ title: '✓ Transfer complete', description: formatCurrency(suggestedTransfer) + ' moved to Working Capital' });
  };
  const handleAutoTransferSkip = () => {
    dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: currentMonth });
    toast({ title: 'Transfer skipped', description: 'Will not prompt again this month' });
  };
  const isLowBalance = wcBalance < lowBalanceAlert && wcTransactions.length > 0;
  const isCapital = CAPITAL_CATS.includes(txCat);

  // Monthly stats
  const stats = useMemo(() => {
    const txs = wcTransactions.filter(t => t.date.startsWith(currentMonth));
    return {
      inflows:        txs.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0),
      outflows:       txs.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0),
      clientPayments: txs.filter(t => t.category === 'client_payment').reduce((s, t) => s + t.amount, 0),
      profitDrawn:    txs.filter(t => t.category?.startsWith('profit_to_wc')).reduce((s, t) => s + t.amount, 0),
      salaries:       txs.filter(t => t.category === 'salary').reduce((s, t) => s + t.amount, 0),
    };
  }, [wcTransactions, currentMonth]);

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    return wcTransactions.filter(t => {
      if (filterMonth !== 'all-months' && !t.date.startsWith(filterMonth)) return false;
      if (filterCat !== 'all' && t.category !== filterCat) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wcTransactions, filterMonth, filterCat]);

  // Group payroll transactions by month into collapsible rows
  const groupedLedgerRows = useMemo(() => {
    type LedgerRow =
      | { kind: 'tx'; tx: WCTransaction }
      | { kind: 'payroll-group'; month: string; txs: WCTransaction[]; total: number; balanceAfter: number };

    const rows: LedgerRow[] = [];
    const seenPayrollMonths = new Set<string>();

    for (const tx of filteredTxs) {
      if (tx.category === 'payroll') {
        const month = tx.date.slice(0, 7);
        if (!seenPayrollMonths.has(month)) {
          seenPayrollMonths.add(month);
          const monthPayrolls = filteredTxs.filter(t => t.category === 'payroll' && t.date.startsWith(month));
          const total = monthPayrolls.reduce((s, t) => s + t.amount, 0);
          // balanceAfter = the last payroll tx in chronological order for that month
          const sorted = [...monthPayrolls].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const balanceAfter = sorted[sorted.length - 1].balanceAfter;
          rows.push({ kind: 'payroll-group', month, txs: monthPayrolls, total, balanceAfter });
        }
      } else {
        rows.push({ kind: 'tx', tx });
      }
    }
    return rows;
  }, [filteredTxs]);

  // Expense breakdown
  const expBreakdown = useMemo(() => {
    const month = filterMonth !== 'all-months' ? filterMonth : currentMonth;
    const txs = wcTransactions.filter(t => t.date.startsWith(month) && t.type === 'outflow');
    const map: Record<string, number> = {};
    txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [wcTransactions, filterMonth, currentMonth]);

  const availableMonths = useMemo(() =>
    Array.from(new Set(wcTransactions.map(t => t.date.slice(0, 7)))).sort().reverse(),
  [wcTransactions]);

  // Total deferred
  const totalDeferred = useMemo(() =>
    activeMembers.reduce((s, m) => s + (m.deferredStipendBalance || 0), 0),
  [activeMembers]);

  // Init stipend amounts when panel opens
  const openStipendPanel = useCallback(() => {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    // Only CONFIRMED projects — bonuses from projected projects are not payable yet
    const confirmedProjects = state.projects.filter(p =>
      p.month === currentMonthStr && p.type === 'client' && confirmedProjectIds.has(p.id)
    );
    const initial: Record<string, string> = {};
    activeMembers.forEach(m => {
      const hasConfirmedBonus = confirmedProjects.some(p =>
        p.distribution.find(d => d.memberId === m.id && d.finalBonus > 0)
      );
      if (m.stipend > 0 || hasConfirmedBonus) {
        initial[m.id] = String(m.stipend + (m.deferredStipendBalance || 0));
      }
    });
    setStipendAmounts(initial);
    setShowStipendPanel(true);
  }, [activeMembers, state.projects]);

  const totalPaying = useMemo(() =>
    Object.values(stipendAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0),
  [stipendAmounts]);

  const totalBonusesPreview = useMemo(() => {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    // Only CONFIRMED — projected bonuses not payable yet
    const confirmedProjects = state.projects.filter(p =>
      p.month === currentMonthStr && p.type === 'client' && confirmedProjectIds.has(p.id)
    );
    return activeMembers.reduce((sum, m) => {
      const bonus = confirmedProjects.reduce((s, p) => {
        const dist = p.distribution.find(d => d.memberId === m.id);
        return s + (dist?.finalBonus || 0);
      }, 0);
      return sum + Math.round(bonus);
    }, 0);
  }, [activeMembers, state.projects, confirmedProjectIds]);

  // Projected bonuses — visible but NOT payable
  const totalProjectedBonuses = useMemo(() => {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const projectedProjects = state.projects.filter(p =>
      p.month === currentMonthStr && p.type === 'client' && !confirmedProjectIds.has(p.id)
    );
    return activeMembers.reduce((sum, m) => {
      const bonus = projectedProjects.reduce((s, p) => {
        const dist = p.distribution.find(d => d.memberId === m.id);
        return s + (dist?.finalBonus || 0);
      }, 0);
      return sum + Math.round(bonus);
    }, 0);
  }, [activeMembers, state.projects, confirmedProjectIds]);

  // Quarter-end detection: March(2), June(5), September(8), December(11)
  const isQuarterEnd = useMemo(() => {
    const month = new Date().getMonth();
    return [2, 5, 8, 11].includes(month);
  }, []);

  // Per-member contribution bank rewards (only shown/paid on quarter-end months)
  const memberBankRewards = useMemo(() => {
    if (!isQuarterEnd) return {} as Record<string, number>;
    const rewards: Record<string, number> = {};
    activeMembers.forEach(m => {
      const points = m.contributionBank.currentQuarterPoints;
      const tiers = state.settings.contributionBank.tiers;
      const tier = tiers.find(t => points >= t.minPoints && points <= t.maxPoints);
      const reward = tier && tier.rewardPercent > 0 ? Math.round(m.stipend * tier.rewardPercent / 100) : 0;
      if (reward > 0) rewards[m.id] = reward;
    });
    return rewards;
  }, [isQuarterEnd, activeMembers, state.settings.contributionBank.tiers]);

  const totalBankRewards = useMemo(() =>
    Object.values(memberBankRewards).reduce((s, v) => s + v, 0),
  [memberBankRewards]);

  // Add transaction
  const addTransaction = useCallback(() => {
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    if (!txDesc.trim()) { toast({ title: 'Enter a description', variant: 'destructive' }); return; }
    if (isCapital && txType === 'inflow' && !txAsset.trim() && txCat === 'profit_to_wc_capital') {
      toast({ title: 'Enter asset name for capital purchase', variant: 'destructive' }); return;
    }

    const newBalance = txType === 'inflow' ? wcBalance + amount : wcBalance - amount;
    const tx: WCTransaction = {
      id: `wc-${Date.now()}`,
      date: txDate,
      type: txType,
      category: txCat,
      amount,
      description: txDesc.trim(),
      balanceAfter: newBalance,
      autoGenerated: false,
      assetName: txAsset.trim() || undefined,
    };
    dispatch({ type: 'ADD_WC_TRANSACTION', payload: tx });
    setTxAmount(''); setTxDesc(''); setTxAsset('');
    toast({
      title: txType === 'inflow' ? '↑ Inflow recorded' : '↓ Outflow recorded',
      description: `${formatCurrency(amount)} — ${txDesc}`,
    });
  }, [txType, txCat, txAmount, txDesc, txDate, txAsset, wcBalance, dispatch, toast, formatCurrency, isCapital]);

  // Pay stipends
  const payStipends = useCallback(() => {
    const entries = Object.entries(stipendAmounts).filter(([, v]) => parseFloat(v) > 0);
    if (!entries.length) { toast({ title: 'No amounts entered', variant: 'destructive' }); return; }

    // Detect quarter-end month (March=2, June=5, September=8, December=11)
    const now = new Date();
    const isQuarterEnd = [2, 5, 8, 11].includes(now.getMonth());

    // Calculate project bonuses — CONFIRMED ONLY (projected not payable)
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const confirmedMonthProjects = state.projects.filter(p =>
      p.month === currentMonthStr && p.type === 'client' && confirmedProjectIds.has(p.id)
    );
    const memberBonuses: Record<string, number> = {};
    activeMembers.forEach(m => {
      let bonus = 0;
      confirmedMonthProjects.forEach(p => {
        const dist = p.distribution.find(d => d.memberId === m.id);
        if (dist) bonus += dist.finalBonus;
      });
      if (bonus > 0) memberBonuses[m.id] = Math.round(bonus);
    });

    // Calculate contribution bank rewards if quarter end
    const memberBankRewards: Record<string, number> = {};
    if (isQuarterEnd) {
      activeMembers.forEach(m => {
        const reward = getContributionBankReward(m.id);
        if (reward.rewardAmount > 0) memberBankRewards[m.id] = Math.round(reward.rewardAmount);
      });
    }

    const totalBonuses = Object.values(memberBonuses).reduce((s, v) => s + v, 0);
    const totalBankRewards = Object.values(memberBankRewards).reduce((s, v) => s + v, 0);
    const totalRequired = totalPaying + totalBonuses + totalBankRewards;

    if (totalRequired > wcBalance) {
      toast({ title: 'Insufficient WC balance', description: `Need ${formatCurrency(totalRequired)} (stipends + bonuses${totalBankRewards > 0 ? ' + Q-rewards' : ''}), have ${formatCurrency(wcBalance)}`, variant: 'destructive' });
      return;
    }
    const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const today = new Date().toISOString().slice(0, 10);
    let runningBalance = wcBalance;

    entries.forEach(([memberId, amtStr], i) => {
      const stipendAmount = parseFloat(amtStr) || 0;
      const bonus = memberBonuses[memberId] || 0;
      const bankReward = memberBankRewards[memberId] || 0;
      const totalPayout = stipendAmount + bonus + bankReward;
      if (totalPayout === 0) return;
      const member = activeMembers.find(m => m.id === memberId);

      // Single combined payroll transaction per member
      runningBalance -= totalPayout;
      const breakdown = [
        stipendAmount > 0 ? `Stipend: ${stipendAmount.toLocaleString()}` : null,
        bonus > 0 ? `Bonus: ${bonus.toLocaleString()}` : null,
        bankReward > 0 ? `Q-Reward: ${bankReward.toLocaleString()}` : null,
      ].filter(Boolean).join(' · ');
      const txPayroll: WCTransaction = {
        id: `pay-${memberId}-${Date.now() + i}`,
        date: today,
        type: 'outflow',
        category: 'payroll',
        amount: totalPayout,
        description: `${member?.name} — ${monthLabel} (${breakdown})`,
        reference: memberId,
        balanceAfter: runningBalance,
        autoGenerated: true,
      };
      dispatch({ type: 'ADD_WC_TRANSACTION', payload: txPayroll });
      if (stipendAmount > 0) {
        dispatch({ type: 'PAY_MEMBER_STIPEND', payload: { memberId, amount: stipendAmount, wcTransactionId: txPayroll.id } });
      }
    });

    // Reset contribution bank points after quarter-end payout
    if (isQuarterEnd && totalBankRewards > 0) {
      dispatch({ type: 'RESET_QUARTER_POINTS' });
    }
    setShowStipendPanel(false);
    toast({
      title: '✓ Payroll complete',
      description: [
        `${formatCurrency(totalPaying)} stipends`,
        totalBonuses > 0 ? `${formatCurrency(totalBonuses)} bonuses` : null,
        totalBankRewards > 0 ? `${formatCurrency(totalBankRewards)} Q-rewards` : null,
        `paid to ${entries.length} members`,
      ].filter(Boolean).join(' + '),
    });

    // Auto-send email receipts to members who have email addresses
    const monthStr = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    entries.forEach(([memberId, amtStr], i) => {
      const amount = parseFloat(amtStr);
      if (!amount) return;
      const member = activeMembers.find(m => m.id === memberId);
      if (!member?.email) return;
      const bonus = memberBonuses[memberId] || 0;
      const subject = encodeURIComponent(`${state.settings.companyName} — Earnings Receipt · ${monthStr}`);
      const body = encodeURIComponent(
        `Hi ${member.name.split(' ')[0]},

` +
        `Your earnings for ${monthStr} have been processed.

` +
        `EARNINGS SUMMARY
` +
        `───────────────────
` +
        `Stipend Paid:    ${state.settings.currencySymbol} ${amount.toLocaleString()}
` +
        (bonus > 0 ? `Project Bonus:   ${state.settings.currencySymbol} ${bonus.toLocaleString()}
` : '') +
        `───────────────────
` +
        `Total:           ${state.settings.currencySymbol} ${(amount + bonus + (memberBankRewards[memberId] || 0)).toLocaleString()}

` +
        (memberBankRewards[memberId] ? `Q-Bank Reward included: ${state.settings.currencySymbol} ${memberBankRewards[memberId].toLocaleString()}
` : '') +
        `InspireX OS · ${state.settings.companyName}`
      );
      setTimeout(() => {
        window.open(`mailto:${member.email}?subject=${subject}&body=${body}`, '_blank');
      }, 600 + i * 400);
    });
  }, [stipendAmounts, totalPaying, wcBalance, activeMembers, state.projects, state.settings, memberBankRewards, totalBankRewards, isQuarterEnd, dispatch, toast, formatCurrency]);

  // Delete transaction
  const deleteTransaction = useCallback((tx: WCTransaction) => {
    const isAuto = tx.autoGenerated;
    const msg = isAuto
      ? `Delete this auto-generated transaction?\n\nWarning: This will not reverse the linked project action. The WC balance will be recalculated.`
      : `Delete this transaction?\n\nThe WC balance will be recalculated for all subsequent transactions.`;
    if (!confirm(msg)) return;
    dispatch({ type: 'DELETE_WC_TRANSACTION', payload: tx.id });
    toast({ title: 'Transaction deleted', description: 'Balance recalculated' });
  }, [dispatch, toast]);

  // Start editing
  const startEdit = useCallback((tx: WCTransaction) => {
    setEditingId(tx.id);
    setEditDesc(tx.description);
    setEditCat(tx.category);
    setEditDate(tx.date);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    dispatch({ type: 'EDIT_WC_TRANSACTION', payload: { id: editingId, description: editDesc, category: editCat, date: editDate } });
    setEditingId(null);
    toast({ title: 'Transaction updated' });
  }, [editingId, editDesc, editCat, editDate, dispatch, toast]);

  // Export
  const exportCSV = useCallback(() => {
    if (!wcTransactions.length) { toast({ title: 'No transactions', variant: 'destructive' }); return; }
    const headers = ['Date', 'Type', 'Category', 'Description', 'Asset', 'Amount', 'Balance After', 'Auto'];
    const rows = filteredTxs.map(t => [t.date, t.type, t.category, t.description, t.assetName || '', t.amount, t.balanceAfter, t.autoGenerated ? 'Yes' : 'No']);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `inspirex-wc-${currentMonth}.csv`;
    a.click();
    toast({ title: 'Exported' });
  }, [filteredTxs, wcTransactions.length, currentMonth, toast]);

  const handleTypeChange = (type: 'inflow' | 'outflow') => {
    setTxType(type);
    setTxCat(type === 'inflow' ? 'client_payment' : 'salary');
    setTxAsset('');
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Working Capital Bank</h1>
          <p className="text-muted-foreground text-sm mt-1">Operations account — all cash in and out</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="no-print">
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Month-end auto-transfer prompt */}
      {autoTransferPending && suggestedTransfer > 0 && (
        <div className="flex items-center justify-between gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0 animate-pulse" />
            <div>
              <div className="text-sm font-medium text-blue-400">Month-end transfer ready</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {autoTransferPercent}% of this month's confirmed company fund — <span className="text-foreground font-medium">{formatCurrency(suggestedTransfer)}</span> available to transfer to Working Capital to fund stipends and operations.
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Retained Profit available: {formatCurrency(retainedProfit)} · WC balance after transfer: {formatCurrency(wcBalance + suggestedTransfer)}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleAutoTransferSkip} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded border border-border">
              Skip this month
            </button>
            <button onClick={handleAutoTransferApprove} className="text-xs text-blue-400 font-medium hover:text-blue-300 px-4 py-1.5 rounded border border-blue-500/30 bg-blue-500/10">
              Transfer {formatCurrency(suggestedTransfer)} →
            </button>
          </div>
        </div>
      )}

      {/* Low balance alert */}
      {isLowBalance && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="text-amber-400 font-medium">Working Capital balance is low — {formatCurrency(wcBalance)}.</span>{' '}
            Consider transferring from Retained Profit ({formatCurrency(retainedProfit)} available).
          </div>
        </div>
      )}

      {/* Empty state */}
      {wcTransactions.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
          <Wallet className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <span>Start by recording a <strong className="text-foreground">top-up</strong> or a <strong className="text-foreground">transfer from Retained Profit</strong> to fund your Working Capital Bank.</span>
        </div>
      )}

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`bg-card col-span-2 md:col-span-1 border ${isLowBalance ? 'border-amber-500/50' : 'border-primary/30'}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className={`w-4 h-4 ${isLowBalance ? 'text-amber-400' : 'text-primary'}`} />
              <div className="text-xs text-muted-foreground uppercase tracking-wider">WC Balance</div>
            </div>
            <div className={`text-2xl font-bold ${isLowBalance ? 'text-amber-400' : 'text-primary'}`}>
              {formatCurrency(wcBalance)}
            </div>
            {totalDeferred > 0 && (
              <div className="text-xs text-red-400 mt-1">Deferred owed: {formatCurrency(totalDeferred)}</div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-green-400" />
              <div className="text-xs text-muted-foreground uppercase">Month In</div>
            </div>
            <div className="text-xl font-semibold text-green-400">{formatCurrency(stats.inflows)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Client: {formatCurrency(stats.clientPayments)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-4 h-4 text-red-400" />
              <div className="text-xs text-muted-foreground uppercase">Month Out</div>
            </div>
            <div className="text-xl font-semibold text-red-400">{formatCurrency(stats.outflows)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Salaries: {formatCurrency(stats.salaries)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <div className="text-xs text-muted-foreground uppercase">Profit Drawn</div>
            </div>
            <div className="text-xl font-semibold text-primary">{formatCurrency(stats.profitDrawn)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">This month</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={openStipendPanel} className="bg-blue-600 hover:bg-blue-500 text-white text-sm">
          <Users className="w-4 h-4 mr-2" />Pay Stipends
        </Button>
      </div>

      {/* Pay Stipends Panel */}
      {showStipendPanel && (
        <Card className="bg-card border-blue-500/30 border animate-fadeIn">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Pay Stipends — {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                {[2,5,8,11].includes(new Date().getMonth()) && (
                  <span className="ml-2 text-xs text-amber-400 font-normal">★ Quarter-end — Bank rewards included</span>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowStipendPanel(false)} className="h-7 w-7 p-0">
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Projected bonus warning */}
            {totalProjectedBonuses > 0 && (
              <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">⟳</span>
                <span>
                  <span className="font-medium">{formatCurrency(totalProjectedBonuses)}</span> in bonuses are still <span className="font-medium">PROJECTED</span> — client payment hasn't landed yet. These are shown below but cannot be paid until the invoice is confirmed.
                </span>
              </div>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-7 gap-2 pb-2 mb-1 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <div>Member</div>
              <div>Stipend</div>
              <div className="text-primary">Confirmed bonus</div>
              <div className="text-amber-400">Projected bonus</div>
              <div className="text-amber-400">{isQuarterEnd ? 'Q-Reward' : 'Q-Reward'}</div>
              <div>Pay amount</div>
              <div>Status</div>
            </div>
            <div className="space-y-2 mb-4">
              {activeMembers.filter(m => {
                const currentMonthStr = new Date().toISOString().slice(0, 7);
                const allClientProjects = state.projects.filter(p => p.month === currentMonthStr && p.type === 'client');
                const hasAnyBonus = allClientProjects.some(p => p.distribution.find(d => d.memberId === m.id && d.finalBonus > 0));
                return m.stipend > 0 || hasAnyBonus;
              }).map(m => {
                const deferred = m.deferredStipendBalance || 0;
                const totalOwed = m.stipend + deferred;
                const currentMonthStr = new Date().toISOString().slice(0, 7);
                // Split bonuses: confirmed vs projected
                const confirmedProjects = state.projects.filter(p => p.month === currentMonthStr && p.type === 'client' && confirmedProjectIds.has(p.id));
                const projectedProjects = state.projects.filter(p => p.month === currentMonthStr && p.type === 'client' && !confirmedProjectIds.has(p.id));
                const confirmedBonus = Math.round(confirmedProjects.reduce((s, p) => {
                  const dist = p.distribution.find(d => d.memberId === m.id);
                  return s + (dist?.finalBonus || 0);
                }, 0));
                const projectedBonus = Math.round(projectedProjects.reduce((s, p) => {
                  const dist = p.distribution.find(d => d.memberId === m.id);
                  return s + (dist?.finalBonus || 0);
                }, 0));
                const isBonusOnly = m.stipend === 0;
                const bankReward = Math.round(getContributionBankReward(m.id).rewardAmount);
                return (
                  <div key={m.id} className="grid grid-cols-7 gap-2 items-center py-2 border-b border-border/50 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{m.name.split(' ')[0]}</div>
                      <div className="text-xs text-muted-foreground">{m.role.split(' ')[0]}</div>
                      {isBonusOnly && <div className="text-xs text-amber-400">Bonus only</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isBonusOnly
                        ? <span className="text-muted-foreground">—</span>
                        : <><div>{formatCurrency(m.stipend)}</div>
                          {deferred > 0 && <div className="text-red-400">+{formatCurrency(deferred)} deferred</div>}</>}
                    </div>
                    <div className="text-xs">
                      {confirmedBonus > 0
                        ? <span className="text-primary font-medium">{formatCurrency(confirmedBonus)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-xs">
                      {projectedBonus > 0
                        ? <span className="text-amber-400">{formatCurrency(projectedBonus)} ⟳</span>
                        : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-xs">
                      {bankReward > 0
                        ? <span className={isQuarterEnd ? 'text-amber-400 font-medium' : 'text-amber-400/50'}>{formatCurrency(bankReward)}{!isQuarterEnd && ' *'}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div>
                      {isBonusOnly
                        ? <div className="text-xs text-muted-foreground italic">Auto from bonus pool</div>
                        : <Input
                            type="number"
                            value={stipendAmounts[m.id] || ''}
                            onChange={e => setStipendAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder={String(totalOwed)}
                            className="h-8 text-sm bg-secondary border-input"
                          />}
                    </div>
                    <div className="text-xs">
                      {isBonusOnly
                        ? (confirmedBonus > 0 ? <span className="text-primary">✓ Confirmed bonus</span> : projectedBonus > 0 ? <span className="text-amber-400">⟳ Awaiting payment</span> : <span className="text-muted-foreground">—</span>)
                        : (() => {
                            const paying = parseFloat(stipendAmounts[m.id]) || 0;
                            const shortfall = totalOwed - paying;
                            if (shortfall > 0 && paying > 0) return <span className="text-amber-400">Deferring {formatCurrency(shortfall)}</span>;
                            if (paying >= totalOwed && paying > 0) return <span className="text-primary">✓ Paid</span>;
                            return <span className="text-muted-foreground">—</span>;
                          })()}
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
                const totalBankPreview = isQuarterEnd ? totalBankRewards : 0;
                const grandTotal = totalPaying + totalBonusesPreview + totalBankPreview;
                return (
                  <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-border">
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">WC Balance: </span>
                        <span className="text-foreground">{formatCurrency(wcBalance)}</span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className={(wcBalance - grandTotal) < 0 ? 'text-destructive' : 'text-primary'}>
                          {formatCurrency(wcBalance - grandTotal)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Stipends: {formatCurrency(totalPaying)}
                        {totalBonusesPreview > 0 && <span className="text-primary"> + Confirmed bonuses: {formatCurrency(totalBonusesPreview)}</span>}
                        {totalBankPreview > 0 && <span className="text-amber-400"> + Q-Rewards: {formatCurrency(totalBankPreview)}</span>}
                        {!isQuarterEnd && totalBankRewards > 0 && <span className="text-muted-foreground text-xs"> (* Q-Rewards paid in Mar/Jun/Sep/Dec)</span>}
                        <span className="font-medium text-foreground"> = {formatCurrency(grandTotal)}</span>
                      </div>
                      {totalProjectedBonuses > 0 && (
                        <div className="text-xs text-amber-400">
                          + {formatCurrency(totalProjectedBonuses)} projected bonuses excluded — awaiting client payment
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowStipendPanel(false)}>Cancel</Button>
                      <Button size="sm" onClick={payStipends}
                        disabled={grandTotal > wcBalance || totalPaying === 0}
                        className="bg-blue-600 hover:bg-blue-500 text-white">
                        Pay {formatCurrency(grandTotal)}
                      </Button>
                    </div>
                  </div>
                );
              })()}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Add Transaction form */}
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Record Transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['inflow', 'outflow'] as const).map(t => (
                <button key={t} onClick={() => handleTypeChange(t)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    txType === t
                      ? t === 'inflow'
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-secondary border-border text-muted-foreground'
                  }`}>
                  {t === 'inflow' ? '↑ Inflow' : '↓ Outflow'}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={txCat} onValueChange={v => { setTxCat(v as WCCategory); setTxAsset(''); }}>
                <SelectTrigger className="bg-secondary border-input"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(txType === 'inflow' ? INFLOW_CATS : OUTFLOW_CATS).map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Capital purchase info */}
            {isCapital && (
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                📈 Capital purchase — this builds long-term value for InspireX.
              </div>
            )}

            {/* Asset name for capital */}
            {(txCat === 'profit_to_wc_capital' || (txType === 'outflow' && CAPITAL_CATS.includes(txCat))) && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Asset Name</Label>
                <Input placeholder="e.g. Sony A7IV Camera, MacBook Pro..."
                  value={txAsset} onChange={e => setTxAsset(e.target.value)}
                  className="bg-secondary border-input" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Amount (MK)</Label>
              <Input type="number" placeholder="0" value={txAmount}
                onChange={e => setTxAmount(e.target.value)} className="bg-secondary border-input" />
            </div>

            {/* Show retained profit for profit transfers */}
            {(txCat === 'profit_to_wc_operations' || txCat === 'profit_to_wc_capital') && (
              <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
                Retained Profit available: <span className="text-primary font-medium">{formatCurrency(retainedProfit)}</span>
                {txAmount && (
                  <div className="mt-1">After transfer: <span className="text-foreground">{formatCurrency(Math.max(0, retainedProfit - (parseFloat(txAmount) || 0)))}</span></div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input placeholder="e.g. Airtel internet, Adobe subscription..."
                value={txDesc} onChange={e => setTxDesc(e.target.value)}
                className="bg-secondary border-input" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                className="bg-secondary border-input" />
            </div>

            <Button onClick={addTransaction} className={`w-full text-white ${
              txType === 'inflow' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
            }`}>
              <Plus className="w-4 h-4 mr-2" />
              Record {txType === 'inflow' ? 'Inflow' : 'Outflow'}
            </Button>
          </CardContent>
        </Card>

        {/* Ledger */}
        <div className="lg:col-span-2 space-y-4">

          {/* Expense breakdown */}
          {expBreakdown.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Expense Breakdown — {filterMonth !== 'all-months' ? filterMonth : currentMonth}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {expBreakdown.map(([cat, amount]) => (
                    <div key={cat} className="p-2.5 bg-secondary/30 rounded-lg">
                      <div className={`text-xs mb-1 ${CAT_COLOR[cat as WCCategory] || 'text-muted-foreground'}`}>
                        {CAT_LABEL[cat as WCCategory] || cat}
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(amount)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Ledger */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Transaction Ledger ({filteredTxs.length})
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-secondary border-input">
                      <SelectValue placeholder="All months" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all-months">All months</SelectItem>
                      {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterCat} onValueChange={setFilterCat}>
                    <SelectTrigger className="w-40 h-8 text-xs bg-secondary border-input">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="all">All categories</SelectItem>
                      {[...INFLOW_CATS, ...OUTFLOW_CATS]
                        .filter((c, i, arr) => arr.findIndex(x => x.value === c.value) === i)
                        .map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTxs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Description</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Category</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Balance</th>
                        <th className="py-2 px-3 no-print"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedLedgerRows.map((row) => {
                        if (row.kind === 'payroll-group') {
                          const groupKey = `payroll-${row.month}`;
                          const isExpanded = expandedPayrollGroups.has(groupKey);
                          const monthLabel = new Date(row.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                          return (
                            <>
                              {/* Payroll group header row */}
                              <tr key={groupKey}
                                className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer select-none"
                                onClick={() => setExpandedPayrollGroups(prev => {
                                  const next = new Set(prev);
                                  next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
                                  return next;
                                })}
                              >
                                <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">{row.month}</td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                    <div>
                                      <div className="text-sm font-medium">Payroll — {monthLabel}</div>
                                      <div className="text-xs text-muted-foreground">{row.txs.length} members · click to {isExpanded ? 'collapse' : 'expand'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="text-xs text-blue-400">💵 Payroll</span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <span className="text-sm font-semibold text-red-400">−{formatCurrency(row.total)}</span>
                                </td>
                                <td className="py-3 px-3 text-right text-sm text-muted-foreground">
                                  {formatCurrency(row.balanceAfter)}
                                </td>
                                <td className="py-3 px-3" />
                              </tr>
                              {/* Expanded member rows */}
                              {isExpanded && row.txs.map(tx => (
                                <tr key={tx.id} className="border-b border-border/30 bg-secondary/10 hover:bg-secondary/20">
                                  <td className="py-2 px-3 pl-8 text-xs text-muted-foreground whitespace-nowrap">{tx.date}</td>
                                  <td className="py-2 px-3 pl-8">
                                    <div className="text-xs text-foreground/80">{tx.description}</div>
                                    {tx.autoGenerated && <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mt-0.5 inline-block">auto</span>}
                                  </td>
                                  <td className="py-2 px-3" />
                                  <td className="py-2 px-3 text-right">
                                    <span className="text-xs font-medium text-red-400">−{formatCurrency(tx.amount)}</span>
                                  </td>
                                  <td className="py-2 px-3 text-right text-xs text-muted-foreground">{formatCurrency(tx.balanceAfter)}</td>
                                  <td className="py-2 px-3 no-print">
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => deleteTransaction(tx)}
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </>
                          );
                        }

                        const tx = row.tx;
                        return (
                        <>{editingId === tx.id ? (
                          // Edit row
                          <tr key={tx.id} className="border-b border-border/50 bg-secondary/20">
                            <td className="py-2 px-3">
                              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                className="h-7 text-xs bg-secondary border-input w-32" />
                            </td>
                            <td className="py-2 px-3">
                              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                className="h-7 text-xs bg-secondary border-input" />
                            </td>
                            <td className="py-2 px-3">
                              <Select value={editCat} onValueChange={v => setEditCat(v as WCCategory)}>
                                <SelectTrigger className="h-7 text-xs bg-secondary border-input w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  {[...INFLOW_CATS, ...OUTFLOW_CATS]
                                    .filter((c, i, arr) => arr.findIndex(x => x.value === c.value) === i)
                                    .map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-3 text-right text-xs text-muted-foreground">
                              {formatCurrency(tx.amount)}
                              <div className="text-[10px] text-muted-foreground">(read-only)</div>
                            </td>
                            <td className="py-2 px-3 text-right text-xs text-muted-foreground">
                              {formatCurrency(tx.balanceAfter)}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={saveEdit}
                                  className="h-7 w-7 p-0 text-primary hover:text-primary">
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}
                                  className="h-7 w-7 p-0 text-muted-foreground">
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          // Normal row
                          <tr key={tx.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10">
                            <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">{tx.date}</td>
                            <td className="py-3 px-3">
                              <div className="text-sm">{tx.description}</div>
                              {tx.assetName && (
                                <div className="text-xs text-blue-400 mt-0.5">Asset: {tx.assetName}</div>
                              )}
                              {tx.autoGenerated && (
                                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mt-0.5 inline-block">auto</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-xs ${CAT_COLOR[tx.category] || 'text-muted-foreground'}`}>
                                {CAT_LABEL[tx.category] || tx.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={`text-sm font-semibold ${tx.type === 'inflow' ? 'text-green-400' : 'text-red-400'}`}>
                                {tx.type === 'inflow' ? '+' : '−'}{formatCurrency(tx.amount)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-sm text-muted-foreground">
                              {formatCurrency(tx.balanceAfter)}
                            </td>
                            <td className="py-3 px-3 no-print">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => startEdit(tx)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteTransaction(tx)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}</>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
