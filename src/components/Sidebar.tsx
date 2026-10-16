import { monthProfit } from '@/lib/profit';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Receipt,
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  TrendingUp,
  Clock,
  RotateCcw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useApp } from '@/hooks/useAppState';
import type { ViewType } from '@/types';
import type { BillingView } from '@/sections/Billing';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  billingView: BillingView;
  onBillingViewChange: (v: BillingView) => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'billing', label: 'Billing', icon: Receipt, section: 'Studio Lab' },
  { id: 'summary', label: 'Monthly Summary', icon: BarChart3, section: 'Finance' },
  { id: 'capital', label: 'Working Capital', icon: Wallet, section: 'Finance' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'Settings' },
];

const BILLING_SUB_NAV: { id: BillingView; label: string; group: 'Sales' | 'Finance' | 'Other' }[] = [
  { id: 'overview',      label: 'Overview',      group: 'Other' },
  { id: 'clients',       label: 'Clients',       group: 'Sales' },
  { id: 'quotes',        label: 'Quotes',        group: 'Sales' },
  { id: 'invoices',      label: 'Invoices',      group: 'Sales' },
  { id: 'receipts',      label: 'Receipts',      group: 'Sales' },
  { id: 'expenses',      label: 'Project Costs', group: 'Finance' },
  { id: 'retainer',      label: 'Retainers',     group: 'Finance' },
  { id: 'recurring',     label: 'Recurring',     group: 'Finance' },
  { id: 'tax',           label: 'Tax Report',    group: 'Finance' },
  { id: 'bill-settings', label: 'Settings',      group: 'Other' },
];

export function Sidebar({ currentView, onViewChange, collapsed, onToggleCollapse, billingView, onBillingViewChange }: SidebarProps) {
  const { state } = useApp();
  const [billingOpen, setBillingOpen] = useState(true);

  const groupedItems = navItems.reduce((acc, item) => {
    const section = item.section || 'Overview';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo + collapse button */}
      <div className="p-4 border-b border-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-bold text-sm">IX</span>
          </div>
          {!collapsed && (
            <>
              <div className="overflow-hidden flex-1">
                <div className="font-semibold text-foreground text-sm tracking-wide">INSPIREX</div>
                <div className="text-xs text-muted-foreground">OS v2.0</div>
              </div>
              <button onClick={onToggleCollapse} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="Collapse sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          {collapsed && (
            <button onClick={onToggleCollapse} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors" title="Expand sidebar">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {Object.entries(groupedItems).map(([section, items]) => (
          <div key={section} className="mb-4">
            {!collapsed && (
              <div className="px-4 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {section}
              </div>
            )}
            {items.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isBilling = item.id === 'billing';

              return (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      if (isBilling && isActive) {
                        setBillingOpen(o => !o);
                      } else {
                        onViewChange(item.id);
                        if (isBilling) setBillingOpen(true);
                      }
                    }}
                    className={cn(
                      "relative w-full flex items-center gap-3 mx-2 px-3 py-2.5 text-sm text-left rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-primary/12 text-primary font-medium"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && !collapsed && (
                      <motion.span
                        layoutId="active-pill"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!collapsed && isBilling && (
                      <ChevronDown className={cn(
                        "w-3 h-3 flex-shrink-0 transition-transform duration-200",
                        billingOpen && isActive ? "rotate-180" : ""
                      )} />
                    )}
                  </button>

                  {/* Billing sub-nav — shown when billing is active, expanded, and open */}
                  {isBilling && isActive && !collapsed && billingOpen && (
                    <div className="ml-4 border-l border-border pl-2 mt-0.5 mb-1 space-y-0.5">
                      {/* Overview */}
                      {BILLING_SUB_NAV.filter(s => s.group === 'Other' && s.id === 'overview').map(s => (
                        <button key={s.id} onClick={() => onBillingViewChange(s.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                            billingView === s.id ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          )}>
                          {s.label}
                        </button>
                      ))}
                      {/* Sales group */}
                      <div className="pt-1 pb-0.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">Sales</div>
                      {BILLING_SUB_NAV.filter(s => s.group === 'Sales').map(s => (
                        <button key={s.id} onClick={() => onBillingViewChange(s.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                            billingView === s.id ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          )}>
                          {s.label}
                        </button>
                      ))}
                      {/* Finance group */}
                      <div className="pt-1 pb-0.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">Finance</div>
                      {BILLING_SUB_NAV.filter(s => s.group === 'Finance').map(s => (
                        <button key={s.id} onClick={() => onBillingViewChange(s.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                            billingView === s.id ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          )}>
                          {s.label}
                        </button>
                      ))}
                      {/* Settings */}
                      <div className="border-t border-border mt-1 pt-1">
                        {BILLING_SUB_NAV.filter(s => s.id === 'bill-settings').map(s => (
                          <button key={s.id} onClick={() => onBillingViewChange(s.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                              billingView === s.id ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            )}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-[10px] text-muted-foreground space-y-1">
            <div>{state.settings.companyName}</div>
            {state.settings.autoSave && <div className="text-[9px] opacity-60">Auto-save enabled</div>}
          </div>
        </div>
      )}
    </aside>
  );
}


// ─── Notification Panel ────────────────────────────────────────────────────────

export function NotificationPanel({ collapsed }: { collapsed: boolean }) {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);

  const notifications = (state.notifications || []).filter(n => !n.dismissed);
  const unread = notifications.filter(n => !n.read).length;

  // Auto-generate notifications on mount and when state changes
  useEffect(() => {
    const existing = state.notifications || [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - today.getDate();

    // 1. Month-end auto-transfer
    const autoEnabled = state.settings.workingCapital?.autoTransferEnabled;
    const autoPercent = state.settings.workingCapital?.autoTransferPercent ?? 0;
    const lastHandled = state.lastAutoTransferMonth || '';
    if (daysLeft <= 2 && autoEnabled && autoPercent > 0 && lastHandled !== currentMonth) {
      const hasTransferNotif = existing.some(n => n.type === 'auto_transfer' && n.actionData?.month === currentMonth && !n.dismissed);
      if (!hasTransferNotif) {
        const fund = Math.max(0, monthProfit(state, currentMonth));
        const amount = Math.round(fund * autoPercent / 100);
        if (amount > 0) {
          dispatch({ type: 'ADD_NOTIFICATION', payload: {
            id: 'auto-transfer-' + currentMonth,
            type: 'auto_transfer',
            title: 'Month-end transfer ready',
            message: `${autoPercent}% of this month's retained profit — MK ${amount.toLocaleString()} available to transfer to Working Capital.`,
            createdAt: new Date().toISOString(),
            read: false, dismissed: false,
            actionData: { amount, month: currentMonth, fund, percent: autoPercent },
            reversible: false,
          }});
        }
      }
    }

    // 2. Overdue invoices
    const invoices = state.billing?.documents?.filter((d: any) => d.type === 'invoice') || [];
    const overdue = invoices.filter((inv: any) => inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < today);
    if (overdue.length > 0) {
      // Always normalize to MWK using each invoice's exchangeRate
      const totalOD = overdue.reduce((s: number, inv: any) => {
        const rate = inv.exchangeRate || 1;
        const paidMwk = (inv.payments || []).reduce((ps: number, p: any) =>
          ps + (p.mwkEquivalent || p.amount * rate), 0);
        return s + Math.max(0, inv.total * rate - paidMwk);
      }, 0);
      const todayId = 'overdue-' + today.toISOString().slice(0, 10);
      const alreadyToday = existing.some(n => n.id === todayId);
      if (!alreadyToday) {
        dispatch({ type: 'ADD_NOTIFICATION', payload: {
          id: todayId,
          type: 'invoice_overdue',
          title: `${overdue.length} overdue invoice${overdue.length !== 1 ? 's' : ''}`,
          message: `MK ${Math.round(totalOD).toLocaleString()} outstanding past due date. Follow up with clients.`,
          createdAt: new Date().toISOString(),
          read: false, dismissed: false,
          actionData: { count: overdue.length, total: Math.round(totalOD) },
        }});
      }
    }

    // 3. Recurring schedules overdue
    const schedules = state.billing?.recurringSchedules || [];
    const overdueSchedules = schedules.filter((s: any) => s.active && s.nextDueDate <= today.toISOString().slice(0,10));
    if (overdueSchedules.length > 0) {
      const hasRec = existing.some(n => n.type === 'recurring_due' && !n.dismissed);
      if (!hasRec) {
        dispatch({ type: 'ADD_NOTIFICATION', payload: {
          id: 'recurring-due-' + today.toISOString().slice(0,10),
          type: 'recurring_due',
          title: `${overdueSchedules.length} recurring invoice${overdueSchedules.length !== 1 ? 's' : ''} due`,
          message: `Generate invoices from Billing → Recurring to keep schedules on track.`,
          createdAt: new Date().toISOString(),
          read: false, dismissed: false,
          actionData: { count: overdueSchedules.length },
        }});
      }
    }
  }, [state, state.wcTransactions, state.billing?.documents, state.lastAutoTransferMonth]);

  const handleApproveTransfer = (n: any) => {
    const { amount, month } = n.actionData;
    const newBal = (state.wcBalance || 0) + amount;
    const txId = 'auto-transfer-notif-' + Date.now();
    dispatch({ type: 'ADD_WC_TRANSACTION', payload: {
      id: txId, date: new Date().toISOString().slice(0,10),
      type: 'inflow', category: 'profit_to_wc_operations',
      amount, description: 'Month-end auto-transfer — ' + n.actionData.percent + '% of retained profit',
      balanceAfter: newBal, autoGenerated: true,
    }});
    dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: month });
    dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id });
    // Add a completed notification with reverse capability
    dispatch({ type: 'ADD_NOTIFICATION', payload: {
      id: 'transfer-done-' + Date.now(),
      type: 'transfer_completed',
      title: 'Transfer completed',
      message: `MK ${amount.toLocaleString()} transferred to Working Capital. You can reverse this within 24 hours if needed.`,
      createdAt: new Date().toISOString(),
      read: false, dismissed: false,
      actionData: { amount, txId, month },
      reversible: true,
    }});
  };

  const handleReverseTransfer = (n: any) => {
    const { txId } = n.actionData;
    dispatch({ type: 'DELETE_WC_TRANSACTION', payload: txId });
    dispatch({ type: 'MARK_AUTO_TRANSFER_HANDLED', payload: '' });
    dispatch({ type: 'REVERSE_NOTIFICATION', payload: n.id });
    dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id });
  };

  const TYPE_ICON: Record<string, any> = {
    auto_transfer: TrendingUp,
    transfer_completed: CheckCheck,
    bonus_ready: TrendingUp,
    invoice_overdue: AlertTriangle,
    wc_low: AlertTriangle,
    quote_approved: CheckCheck,
    quote_declined: X,
    recurring_due: Clock,
    record_deleted: X,
  };

  const TYPE_COLOR: Record<string, string> = {
    auto_transfer: 'text-blue-400',
    transfer_completed: 'text-primary',
    bonus_ready: 'text-primary',
    invoice_overdue: 'text-destructive',
    wc_low: 'text-amber-400',
    quote_approved: 'text-primary',
    quote_declined: 'text-destructive',
    recurring_due: 'text-amber-400',
    record_deleted: 'text-muted-foreground',
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  const actionRequired = notifications.filter(n => ['auto_transfer', 'bonus_ready', 'invoice_overdue', 'wc_low', 'recurring_due'].includes(n.type));
  const recent = notifications.filter(n => ['transfer_completed', 'quote_approved', 'quote_declined', 'record_deleted'].includes(n.type));

  return (
    <>
      {/* Compact bell trigger for topbar */}
      <button onClick={() => { setOpen(true); dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' }); }}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary/40 text-foreground hover:bg-secondary hover:border-primary/30 transition-all">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {void collapsed}
      </button>

      {/* Drawer overlay with slide-in animation */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex"
          >
            <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="w-96 bg-card border-l border-border flex flex-col h-full overflow-hidden shadow-2xl"
            >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{notifications.length} active · {unread} unread</p>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={() => notifications.forEach(n => dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id }))}
                    className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                  <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No notifications</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Action Required */}
                  {actionRequired.length > 0 && (
                    <div>
                      <div className="px-5 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-secondary/20">
                        Action Required
                      </div>
                      {actionRequired.map(n => {
                        const Icon = TYPE_ICON[n.type] || Bell;
                        const color = TYPE_COLOR[n.type] || 'text-muted-foreground';
                        return (
                          <div key={n.id} className={`px-5 py-4 ${!n.read ? 'bg-primary/3' : ''}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                n.type === 'invoice_overdue' || n.type === 'wc_low' ? 'bg-destructive/10' :
                                n.type === 'auto_transfer' ? 'bg-blue-500/10' : 'bg-primary/10'
                              }`}>
                                <Icon className={`w-4 h-4 ${color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{relativeTime(n.createdAt)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>

                                {/* Auto-transfer action */}
                                {n.type === 'auto_transfer' && n.actionData && (
                                  <div className="mt-3 space-y-2">
                                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-1.5">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Company fund this month</span>
                                        <span>MK {(n.actionData.fund || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Transfer rate</span>
                                        <span>{n.actionData.percent}%</span>
                                      </div>
                                      <div className="flex justify-between text-xs font-medium border-t border-border pt-1.5">
                                        <span className="text-blue-400">Transfer amount</span>
                                        <span className="text-blue-400">MK {(n.actionData.amount || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">WC after transfer</span>
                                        <span className="text-primary">MK {((state.wcBalance || 0) + (n.actionData.amount || 0)).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Retained profit after</span>
                                        <span>MK {Math.max(0, (state.retainedProfit || 0) - (n.actionData.amount || 0)).toLocaleString()}</span>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id })}
                                        className="flex-1 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-md hover:bg-secondary/50">
                                        Skip this month
                                      </button>
                                      <button onClick={() => handleApproveTransfer(n)}
                                        className="flex-1 px-3 py-1.5 text-xs text-blue-400 font-medium border border-blue-500/30 bg-blue-500/10 rounded-md hover:bg-blue-500/20">
                                        Transfer MK {(n.actionData.amount || 0).toLocaleString()}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Other action types */}
                                {n.type !== 'auto_transfer' && (
                                  <button onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id })}
                                    className="mt-2 text-xs text-muted-foreground hover:text-foreground">
                                    Dismiss
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent */}
                  {recent.length > 0 && (
                    <div>
                      <div className="px-5 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-secondary/20">
                        Recent
                      </div>
                      {recent.map(n => {
                        const Icon = TYPE_ICON[n.type] || Bell;
                        const color = TYPE_COLOR[n.type] || 'text-muted-foreground';
                        const isReversible = n.reversible && !n.reversedAt &&
                          (Date.now() - new Date(n.createdAt).getTime()) < 86400000;
                        return (
                          <div key={n.id} className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Icon className={`w-4 h-4 ${color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{relativeTime(n.createdAt)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                                <div className="flex gap-2 mt-2">
                                  {isReversible && (
                                    <button onClick={() => handleReverseTransfer(n)}
                                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                                      <RotateCcw className="w-3 h-3" />Reverse transfer
                                    </button>
                                  )}
                                  <button onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id })}
                                    className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
