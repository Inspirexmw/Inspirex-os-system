import { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import {
  Plus, FileText, Users, Settings, LayoutDashboard,
  ChevronRight, Trash2, Edit2, Check, X, Send,
  DollarSign, AlertTriangle, Clock, CheckCircle, Copy, Mail,
  Upload, Image, Eye, TrendingDown, BarChart2, RefreshCw, Link,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import type {
  BillingClient, BillingDocument, BillingCurrency,
  LineItem, BillingPayment, BillingSettings, Expense, ExpenseCategory, RecurringSchedule, RecurringFrequency,
} from '@/types';

type BillingView = 'overview' | 'clients' | 'quotes' | 'invoices' | 'receipts' | 'expenses' | 'retainer' | 'recurring' | 'tax' | 'bill-settings';
type DocType = 'quote' | 'invoice' | 'proforma';

const CURRENCIES: BillingCurrency[] = ['MWK', 'USD', 'ZAR'];

const fmtAmt = (amount: number, currency: BillingCurrency) => {
  const sym = currency === 'MWK' ? 'MK' : currency === 'USD' ? '$' : 'R';
  return `${sym} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'draft':    return 'text-muted-foreground bg-secondary/50';
    case 'sent':     return 'text-blue-400 bg-blue-500/10';
    case 'accepted': return 'text-primary bg-primary/10';
    case 'rejected': return 'text-destructive bg-destructive/10';
    case 'expired':  return 'text-amber-400 bg-amber-500/10';
    case 'paid':     return 'text-primary bg-primary/10';
    case 'partial':  return 'text-amber-400 bg-amber-500/10';
    case 'overdue':  return 'text-destructive bg-destructive/10';
    default:         return 'text-muted-foreground bg-secondary/50';
  }
};

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

const nextNumber = (type: DocType | 'receipt', counter: number, settings?: { invoicePrefix?: string; quotePrefix?: string; receiptPrefix?: string; companyCode?: string; invoiceStartNumber?: number }) => {
  const code = settings?.companyCode ? `-${settings.companyCode}` : '';
  const invPrefix = settings?.invoicePrefix || 'INV';
  const qtPrefix = settings?.quotePrefix || 'QT';
  const rcpPrefix = settings?.receiptPrefix || 'RCP';
  const prefix = type === 'quote' || type === 'proforma' ? qtPrefix : type === 'receipt' ? rcpPrefix : invPrefix;
  const startNum = (settings?.invoiceStartNumber || 1) - 1;
  const num = counter + 1 + (type === 'invoice' || type === 'proforma' ? startNum : 0);
  return `${prefix}${code}-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`;
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const isOverdue = (doc: BillingDocument) =>
  doc.type === 'invoice' && doc.status !== 'paid' && doc.dueDate && new Date(doc.dueDate) < new Date();

const isExpired = (doc: BillingDocument) =>
  doc.type === 'quote' && doc.status === 'sent' && doc.validUntil && new Date(doc.validUntil) < new Date();

const getDisplayStatus = (doc: BillingDocument) => {
  if (isOverdue(doc)) return 'overdue';
  if (isExpired(doc)) return 'expired';
  return doc.status;
};

const fmtDateFull = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Billing() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();
  const [view, setView] = useState<BillingView>('overview');
  const [previewDoc, setPreviewDoc] = useState<{ doc: BillingDocument; client: BillingClient | undefined } | null>(null);
  const billing = state.billing;
  const quotes   = billing.documents.filter(d => d.type === 'quote' || d.type === 'proforma');
  const invoices = billing.documents.filter(d => d.type === 'invoice');
  const receipts = billing.documents.filter(d => d.type === 'receipt');
  const expenses = billing.expenses || [];
  const recurringSchedules = billing.recurringSchedules || [];

  // Two-tier navigation groups
  const NAV_GROUPS = [
    { id: 'overview',   label: 'Overview',   icon: LayoutDashboard, children: null },
    { id: 'documents',  label: 'Documents',  icon: FileText, children: [
      { id: 'clients',   label: 'Clients',   icon: Users },
      { id: 'quotes',    label: 'Quotes',    icon: FileText },
      { id: 'invoices',  label: 'Invoices',  icon: DollarSign },
      { id: 'receipts',  label: 'Receipts',  icon: CheckCircle },
    ]},
    { id: 'finance',    label: 'Finance',    icon: BarChart2, children: [
      { id: 'expenses',  label: 'Project Costs', icon: TrendingDown },
      { id: 'retainer',  label: 'Retainers',     icon: DollarSign },
      { id: 'recurring', label: 'Recurring',     icon: RefreshCw },
      { id: 'tax',       label: 'Tax Report',    icon: BarChart2 },
    ]},
    { id: 'bill-settings', label: 'Settings', icon: Settings, children: null },
  ];

  const activeGroup = NAV_GROUPS.find(g =>
    g.children ? g.children.some(c => c.id === view) : g.id === view
  );

  const openPreview = (doc: BillingDocument) => {
    const client = billing.clients.find(c => c.id === doc.clientId);
    setPreviewDoc({ doc, client });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">Quotes, invoices and client records</p>
      </div>
      {/* Primary navigation */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
        {NAV_GROUPS.map(g => {
          const isActive = g.children ? g.children.some(c => c.id === view) : g.id === view;
          return (
            <button key={g.id}
              onClick={() => {
                if (!g.children) { setView(g.id as BillingView); }
                else if (!isActive) { setView(g.children[0].id as BillingView); }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <g.icon className="w-3.5 h-3.5" />
              {g.label}
              {g.children && <ChevronRight className={`w-3 h-3 transition-transform ${isActive ? 'rotate-90' : ''}`} />}
            </button>
          );
        })}
      </div>

      {/* Secondary navigation — shown when a group with children is active */}
      {activeGroup?.children && (
        <div className="flex gap-1 border-b border-border pb-1">
          {activeGroup.children.map(c => (
            <button key={c.id} onClick={() => setView(c.id as BillingView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === c.id ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <c.icon className="w-3 h-3" />
              {c.label}
              {c.id === 'receipts' && receipts.length > 0 && (
                <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">{receipts.length}</span>
              )}
              {c.id === 'expenses' && expenses.length > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">{expenses.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-4" onClick={() => setPreviewDoc(null)}>
          <div className="relative w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white">{previewDoc.doc.number} — Preview</div>
              <div className="flex gap-2">
                <button onClick={() => { generatePDF(previewDoc.doc, previewDoc.client, billing.settings); }}
                  className="px-3 py-1.5 bg-primary text-black text-xs font-medium rounded-md hover:bg-primary/90">
                  Download PDF
                </button>
                <button onClick={() => setPreviewDoc(null)} className="p-1.5 text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <DocumentPreview doc={previewDoc.doc} client={previewDoc.client} settings={billing.settings} />
          </div>
        </div>
      )}

      {view === 'overview'      && <BillingOverview quotes={quotes} invoices={invoices} clients={billing.clients} billing={billing} setView={setView} />}
      {view === 'clients'       && <ClientsView clients={billing.clients} documents={billing.documents} dispatch={dispatch} toast={toast} />}
      {view === 'quotes'        && <QuotesView quotes={quotes} clients={billing.clients} billing={billing} dispatch={dispatch} toast={toast} setView={setView} openPreview={openPreview} />}
      {view === 'invoices'      && <InvoicesView invoices={invoices} clients={billing.clients} billing={billing} state={state} dispatch={dispatch} toast={toast} openPreview={openPreview} />}
      {view === 'receipts'      && <ReceiptsView receipts={receipts} clients={billing.clients} billing={billing} dispatch={dispatch} toast={toast} openPreview={openPreview} />}
      {view === 'expenses'      && <ExpensesView expenses={expenses} clients={billing.clients} billing={billing} state={state} dispatch={dispatch} toast={toast} />}
      {view === 'retainer'      && <RetainerView invoices={invoices} clients={billing.clients} billing={billing} dispatch={dispatch} toast={toast} />}
      {view === 'recurring'      && <RecurringView schedules={recurringSchedules} clients={billing.clients} billing={billing} dispatch={dispatch} toast={toast} />}
      {view === 'tax'             && <TaxReportView invoices={invoices} clients={billing.clients} billing={{ ...billing, wcTransactions: state.wcTransactions || [] }} expenses={expenses} />}
      {view === 'bill-settings' && <BillSettingsView settings={billing.settings} dispatch={dispatch} toast={toast} />}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function BillingOverview({ quotes, invoices, clients, billing, setView }: any) {
  const unpaid = invoices.filter((i: BillingDocument) => i.status !== 'paid');
  const overdue = unpaid.filter((i: BillingDocument) => isOverdue(i));
  const thisMonth = new Date().toISOString().slice(0, 7);
  const collectedThisMonth = invoices.reduce((s: number, i: BillingDocument) =>
    s + i.payments.filter((p: BillingPayment) => p.date.startsWith(thisMonth)).reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0), 0);
  const totalOutstanding = unpaid.reduce((s: number, i: BillingDocument) =>
    s + Math.max(0, i.total - i.payments.reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0)), 0);
  const pendingQuotes = quotes.filter((q: BillingDocument) => q.status === 'sent');

  // Reminder groups
  const today = new Date(); today.setHours(0,0,0,0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const critical = unpaid.filter((i: BillingDocument) => {
    if (!i.dueDate) return false;
    const due = new Date(i.dueDate); due.setHours(0,0,0,0);
    return due < today;
  }).sort((a: BillingDocument, b: BillingDocument) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  const upcoming = unpaid.filter((i: BillingDocument) => {
    if (!i.dueDate) return false;
    const due = new Date(i.dueDate); due.setHours(0,0,0,0);
    return due >= today && due <= in7;
  });
  const sendReminder = (inv: BillingDocument) => {
    const client = clients.find((c: BillingClient) => c.id === inv.clientId);
    if (!client?.email) return;
    const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
    const remaining = inv.total - paid;
    const daysOverdue = inv.dueDate ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000) : 0;
    const daysLeft = inv.dueDate ? Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000) : 0;
    const isOd = daysOverdue > 0;
    const subject = encodeURIComponent((isOd ? 'Overdue Invoice — ' : 'Payment Reminder — ') + inv.number + ' · ' + billing.settings.companyName);
    const nl = '\n';
    const overdueMsg = 'We hope this finds you well. We wanted to follow up on Invoice ' + inv.number + ', which was due on ' + inv.dueDate + ' and is now ' + daysOverdue + ' day' + (daysOverdue !== 1 ? 's' : '') + ' overdue.' + nl + nl + 'Outstanding balance: ' + fmtAmt(remaining, inv.currency);
    const upcomingMsg = 'We hope this finds you well. This is a friendly reminder that Invoice ' + inv.number + ' is due in ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' on ' + inv.dueDate + '.' + nl + nl + 'Amount due: ' + fmtAmt(remaining, inv.currency);
    const body = encodeURIComponent('Hi ' + client.name + ',' + nl + nl + (isOd ? overdueMsg : upcomingMsg) + nl + nl + 'Please arrange payment at your earliest convenience. If you have any questions, do not hesitate to reach out.' + nl + nl + 'Thank you,' + nl + billing.settings.companyName + nl + billing.settings.email);
    window.open('mailto:' + client.email + '?subject=' + subject + '&body=' + body);
  };

  const [reminderSettings, setReminderSettings] = useState({
    before7: billing.settings.reminderBefore7 ?? true,
    onDue: billing.settings.reminderOnDue ?? true,
    after7: billing.settings.reminderAfter7 ?? true,
    after14: billing.settings.reminderAfter14 ?? false,
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Outstanding', value: 'MK ' + totalOutstanding.toLocaleString(), color: 'text-amber-400', icon: Clock },
          { label: 'Overdue', value: overdue.length, color: overdue.length > 0 ? 'text-destructive' : 'text-primary', icon: AlertTriangle },
          { label: 'Collected (Month)', value: 'MK ' + collectedThisMonth.toLocaleString(), color: 'text-primary', icon: CheckCircle },
          { label: 'Pending Quotes', value: pendingQuotes.length, color: 'text-blue-400', icon: FileText },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2"><Icon className={`w-4 h-4 ${color}`} /><div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div></div>
              <div className={`text-xl font-semibold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unpaid invoices */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setView('invoices')}>View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {unpaid.length === 0 ? <div className="text-sm text-muted-foreground italic py-4 text-center">All invoices paid ✓</div> : (
              <div className="space-y-2">
                {unpaid.slice(0, 5).map((inv: BillingDocument) => {
                  const client = clients.find((c: BillingClient) => c.id === inv.clientId);
                  const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                  const remaining = inv.total - paid;
                  const od = isOverdue(inv);
                  const days = od && inv.dueDate ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000) : 0;
                  return (
                    <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg ${od ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary/30'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{inv.number}</span>
                          {od && <span className="text-[10px] text-destructive font-medium">{days}d overdue</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{client?.name || '—'} · Due {inv.dueDate || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{fmtAmt(remaining, inv.currency)}</div>
                        <div className="text-xs text-muted-foreground">of {fmtAmt(inv.total, inv.currency)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Reminders */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue Reminders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {critical.length === 0 && upcoming.length === 0 ? (
              <div className="text-sm text-muted-foreground italic py-6 text-center px-4">No overdue or upcoming invoices ✓</div>
            ) : (
              <div>
                {critical.length > 0 && (
                  <div className="px-4 pt-3 pb-2">
                    <div className="text-[10px] font-medium text-destructive uppercase tracking-wider mb-2">Overdue</div>
                    <div className="space-y-2">
                      {critical.map((inv: BillingDocument) => {
                        const client = clients.find((c: BillingClient) => c.id === inv.clientId);
                        const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                        const remaining = inv.total - paid;
                        const days = inv.dueDate ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000) : 0;
                        return (
                          <div key={inv.id} className="flex items-center justify-between p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <div>
                              <div className="text-xs font-medium">{client?.name || '—'}</div>
                              <div className="text-[10px] text-muted-foreground">{inv.number} · {days}d overdue</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-semibold text-destructive">{fmtAmt(remaining, inv.currency)}</div>
                              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 gap-1 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => sendReminder(inv)}>
                                <Mail className="w-2.5 h-2.5" />Remind
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {upcoming.length > 0 && (
                  <div className="px-4 pt-3 pb-2">
                    <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2">Due within 7 days</div>
                    <div className="space-y-2">
                      {upcoming.map((inv: BillingDocument) => {
                        const client = clients.find((c: BillingClient) => c.id === inv.clientId);
                        const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                        const remaining = inv.total - paid;
                        const daysLeft = inv.dueDate ? Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000) : 0;
                        return (
                          <div key={inv.id} className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <div>
                              <div className="text-xs font-medium">{client?.name || '—'}</div>
                              <div className="text-[10px] text-muted-foreground">{inv.number} · {daysLeft}d left</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-semibold text-amber-400">{fmtAmt(remaining, inv.currency)}</div>
                              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/5" onClick={() => sendReminder(inv)}>
                                <Mail className="w-2.5 h-2.5" />Remind
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Reminder settings */}
            <div className="border-t border-border mt-2 px-4 py-3 bg-secondary/20">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Auto-reminder triggers</div>
              <div className="space-y-1.5">
                {[
                  { key: 'before7', label: '7 days before due date' },
                  { key: 'onDue', label: 'On due date' },
                  { key: 'after7', label: '7 days after due date' },
                  { key: 'after14', label: '14 days after due date' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <button
                      onClick={() => setReminderSettings(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                      className={`relative w-8 h-4 rounded-full transition-colors ${reminderSettings[key as keyof typeof reminderSettings] ? 'bg-primary' : 'bg-secondary'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${reminderSettings[key as keyof typeof reminderSettings] ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retainer & Deposit Tracking */}
      {invoices.filter((i: BillingDocument) => (i as any).depositPercent > 0 && i.status !== 'paid').length > 0 && (
        <div>
          <div className="text-sm font-medium mb-3">Retainer & Deposit Tracking</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoices
              .filter((i: BillingDocument) => (i as any).depositPercent > 0 && i.status !== 'paid')
              .map((inv: BillingDocument) => {
                const client = clients.find((c: BillingClient) => c.id === inv.clientId);
                const depositPct = (inv as any).depositPercent || 50;
                const depositAmt = Math.round(inv.total * depositPct / 100);
                const totalPaid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                const remaining = inv.total - totalPaid;
                const depositReceived = totalPaid >= depositAmt;
                const progressPct = inv.total > 0 ? Math.min(100, Math.round((totalPaid / inv.total) * 100)) : 0;
                return (
                  <Card key={inv.id} className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-sm">{client?.name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{(inv as any).projectName || inv.number}</div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${depositReceived ? 'text-primary bg-primary/10' : 'text-amber-400 bg-amber-500/10'}`}>
                          {depositReceived ? 'DEPOSIT RECEIVED' : 'DEPOSIT PENDING'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Invoice Total</span><span className="font-medium">{fmtAmt(inv.total, inv.currency)}</span></div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Deposit ({depositPct}%)</span>
                          <span className={`font-medium ${depositReceived ? 'text-primary' : 'text-amber-400'}`}>{fmtAmt(depositAmt, inv.currency)} {depositReceived ? '✓ received' : '— pending'}</span>
                        </div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Balance Remaining</span><span className="font-medium text-muted-foreground">{fmtAmt(remaining, inv.currency)}</span></div>
                      </div>
                      <div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} /></div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{progressPct}% paid</span><span>{100 - progressPct}% remaining</span></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => setView('invoices')}>View Invoice</Button>
                        {inv.dueDate && <div className="text-xs text-muted-foreground self-center">Due {inv.dueDate}</div>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Clients ──────────────────────────────────────────────────────────────────

function ClientsView({ clients, documents, dispatch, toast }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BillingClient | null>(null);
  const [selected, setSelected] = useState<BillingClient | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', currency: 'MWK' as BillingCurrency });

  const reset = () => { setForm({ name: '', email: '', phone: '', address: '', currency: 'MWK' }); setEditing(null); setShowForm(false); };
  const save = () => {
    if (!form.name.trim()) { toast({ title: 'Client name required', variant: 'destructive' }); return; }
    if (editing) {
      dispatch({ type: 'BILLING_UPDATE_CLIENT', payload: { ...editing, ...form } });
      if (selected?.id === editing.id) setSelected({ ...editing, ...form });
      toast({ title: 'Client updated' });
    } else {
      dispatch({ type: 'BILLING_ADD_CLIENT', payload: { id: genId(), ...form, createdAt: new Date().toISOString() } });
      toast({ title: 'Client added' });
    }
    reset();
  };
  const startEdit = (c: BillingClient) => { setEditing(c); setForm({ name: c.name, email: c.email, phone: c.phone || '', address: c.address || '', currency: c.currency }); setShowForm(true); };
  const del = (id: string) => { if (confirm('Delete client?')) { dispatch({ type: 'BILLING_DELETE_CLIENT', payload: id }); if (selected?.id === id) setSelected(null); toast({ title: 'Client deleted' }); }};

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const avatarColors = ['bg-primary/20 text-primary','bg-blue-500/20 text-blue-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
  const avatarColor = (id: string) => avatarColors[id.charCodeAt(0) % avatarColors.length];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{clients.length} client{clients.length !== 1 ? 's' : ''}</div>
        <Button size="sm" onClick={() => { reset(); setShowForm(true); }} className="gap-1"><Plus className="w-3.5 h-3.5" />Add Client</Button>
      </div>

      {showForm && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">{editing ? 'Edit Client' : 'New Client'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Client Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Default Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({...p, currency: v as BillingCurrency}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
              <Button size="sm" onClick={save}>{editing ? 'Update' : 'Add Client'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`flex gap-4 ${selected ? '' : ''}`}>
        {/* Table */}
        <div className="flex-1 min-w-0">
          <Card className="bg-card border-border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Currency</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: BillingClient) => (
                  <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/30 ${selected?.id === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${avatarColor(c.id)}`}>{initials(c.name)}</div>
                        <span className="font-medium text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.phone || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs text-primary font-medium">{c.currency}</span></td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No clients yet — add your first client above</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-72 flex-shrink-0">
            <ClientSidePanel
              client={selected}
              documents={documents}
              onEdit={() => startEdit(selected)}
              onDelete={() => del(selected.id)}
              onClose={() => setSelected(null)}
              initials={initials}
              avatarColor={avatarColor}
            />
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Quotes ───────────────────────────────────────────────────────────────────

function QuotesView({ quotes, clients, billing, dispatch, toast, setView, openPreview }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<BillingDocument | null>(null);
  const [selected, setSelected] = useState<BillingDocument | null>(null);

  const getClient = (id: string) => clients.find((c: BillingClient) => c.id === id);
  const initials = (name: string) => name?.split(' ').map((w:string) => w[0]).join('').slice(0,2).toUpperCase() || '?';
  const avatarColors = ['bg-primary/20 text-primary','bg-blue-500/20 text-blue-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
  const avatarColor = (id: string) => avatarColors[id?.charCodeAt(0) % avatarColors.length] || avatarColors[0];

  const convertToInvoice = (quote: BillingDocument) => {
    if (!confirm('Convert this quote to an invoice?')) return;
    const invNumber = nextNumber('invoice', billing.counters.invoice, billing.settings);
    const invoice: BillingDocument = { ...quote, id: genId(), type: 'invoice', number: invNumber, status: 'draft', issueDate: new Date().toISOString().slice(0,10), dueDate: new Date(Date.now() + billing.settings.defaultPaymentTerms * 86400000).toISOString().slice(0,10), payments: [], convertedFromQuoteId: quote.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...quote, status: 'accepted', convertedToInvoiceId: invoice.id, updatedAt: new Date().toISOString() } });
    dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: invoice });
    toast({ title: '✓ Invoice created', description: invNumber });
    setView('invoices');
  };
  const duplicate = (q: BillingDocument) => {
    const num = nextNumber(q.type as DocType, billing.counters[q.type === 'proforma' ? 'invoice' : 'quote']);
    dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: { ...q, id: genId(), number: num, status: 'draft', payments: [], convertedToInvoiceId: undefined, convertedFromQuoteId: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    toast({ title: 'Duplicated', description: num });
  };
  const sendEmail = (q: BillingDocument) => {
    const client = getClient(q.clientId);
    if (!client?.email) { toast({ title: 'No client email set', variant: 'destructive' }); return; }
    const qSubj = encodeURIComponent(billing.settings.companyName + ' — ' + q.number);
    const qBody = encodeURIComponent('Hi ' + client.name + ',\n\nPlease find attached our ' + (q.type === 'proforma' ? 'Proforma Invoice' : 'Quote') + ' ' + q.number + ' for ' + fmtAmt(q.total, q.currency) + '.\n\n' + billing.settings.companyName);
    window.open('mailto:' + client.email + '?subject=' + qSubj + '&body=' + qBody);
    toast({ title: 'Email draft opened' });
  };
  const updateStatus = (doc: BillingDocument, status: string) => { dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...doc, status, updatedAt: new Date().toISOString() } }); if (selected?.id === doc.id) setSelected({ ...doc, status } as any); toast({ title: 'Status updated' }); };
  const del = (id: string) => { if (confirm('Delete?')) { dispatch({ type: 'BILLING_DELETE_DOCUMENT', payload: id }); if (selected?.id === id) setSelected(null); toast({ title: 'Deleted' }); }};


  const selClient = selected ? getClient(selected.clientId) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{quotes.length} document{quotes.length !== 1 ? 's' : ''}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditingDoc(null); setShowForm(true); }} className="gap-1" disabled={clients.length === 0}><Plus className="w-3.5 h-3.5" />New Quote</Button>
          <Button size="sm" onClick={() => { setEditingDoc(null); setShowForm(true); }} className="gap-1" disabled={clients.length === 0}><Plus className="w-3.5 h-3.5" />Proforma</Button>
        </div>
      </div>
      {clients.length === 0 && <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">Add a client first.</div>}
      {(showForm || editingDoc) && <DocumentForm type="quote" clients={clients} billing={billing} dispatch={dispatch} toast={toast} editingDoc={editingDoc} onClose={() => { setShowForm(false); setEditingDoc(null); }} />}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Card className="bg-card border-border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Valid Until</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q: BillingDocument) => {
                  const client = getClient(q.clientId);
                  const ds = getDisplayStatus(q);
                  return (
                    <tr key={q.id} onClick={() => setSelected(selected?.id === q.id ? null : q)}
                      className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/30 ${selected?.id === q.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{q.issueDate}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{q.number}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${avatarColor(q.clientId)}`}>{initials(client?.name || '?')}</div>
                          <span className="text-sm font-medium truncate max-w-[120px]">{client?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{q.type === 'proforma' ? 'Proforma' : 'Quote'}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(ds)}`}>{ds.toUpperCase()}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{q.validUntil || '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-primary">{fmtAmt(q.total, q.currency)}</td>
                    </tr>
                  );
                })}
                {quotes.length === 0 && !showForm && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No quotes yet</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-64 flex-shrink-0">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{selected.number}</div>
                    <div className="font-medium text-sm mt-0.5">{selClient?.name || '—'}</div>
                    {(selected as any).projectName && <div className="text-xs text-muted-foreground mt-0.5">{(selected as any).projectName}</div>}
                    <div className="mt-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(getDisplayStatus(selected))}`}>{getDisplayStatus(selected).toUpperCase()}</span></div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total</span><span className="font-semibold text-primary">{fmtAmt(selected.total, selected.currency)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Issued</span><span>{selected.issueDate}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Valid until</span><span>{selected.validUntil || '—'}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Line items</span><span>{selected.lineItems.length}</span></div>
                  {selected.convertedToInvoiceId && <div className="text-[10px] text-primary">✓ Converted to invoice</div>}
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => { setEditingDoc(selected); setSelected(null); }}><Edit2 className="w-3 h-3" />Edit</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => openPreview(selected)}><Eye className="w-3 h-3" />Preview</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => generatePDF(selected, selClient, billing.settings)}><FileText className="w-3 h-3" />Download PDF</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => sendEmail(selected)}><Mail className="w-3 h-3" />Send Email</Button>
                  {selected.status === 'draft' && <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => updateStatus(selected, 'sent')}><Send className="w-3 h-3" />Mark Sent</Button>}
                  {(selected.status === 'sent' || selected.status === 'draft') && !selected.convertedToInvoiceId && (
                    <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-primary border-primary/40" variant="outline" onClick={() => convertToInvoice(selected)}><ChevronRight className="w-3 h-3" />Convert to Invoice</Button>
                  )}
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => duplicate(selected)}><Copy className="w-3 h-3" />Duplicate</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-blue-400 border-blue-500/30" variant="outline" onClick={() => {
                      const inv = billing.clients.find((c: BillingClient) => c.id === selected.clientId);
                      const projectSlug = slugify((selected as any).projectName || selected.number);
                      const clientSlug = slugify(inv?.name || 'client');
                      const shortId = Math.random().toString(36).slice(2, 7);
                      const token = projectSlug + '-' + clientSlug + '-' + shortId;
                      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...selected, approvalToken: token, approvalOpenedCount: 0, updatedAt: new Date().toISOString() } });
                      setSelected({ ...selected, approvalToken: token, approvalOpenedCount: 0 });
                      toast({ title: '✓ Approval link generated' });
                    }}>
                    <Link className="w-3 h-3" />Generate Approval Link
                  </Button>
                  {selected.approvalToken && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 p-2 bg-secondary/50 rounded text-[10px] font-mono break-all text-muted-foreground">{(billing.settings.customDomain ? 'https://' + billing.settings.customDomain : window.location.origin) + '/#approve/' + selected.approvalToken}</div>
                      <Button size="sm" className="w-full text-xs h-7 gap-1.5 justify-start" variant="outline" onClick={() => { navigator.clipboard.writeText((billing.settings.customDomain ? 'https://' + billing.settings.customDomain : window.location.origin) + '/#approve/' + selected.approvalToken); toast({ title: 'Link copied!' }); }}>Copy Link</Button>
                      {selected.approvalOpenedCount !== undefined && selected.approvalOpenedCount > 0 && <div className="text-[10px] text-muted-foreground text-center">Opened {selected.approvalOpenedCount}×</div>}
                    </div>
                  )}
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-destructive border-destructive/30" variant="outline" onClick={() => del(selected.id)}><Trash2 className="w-3 h-3" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Invoices ─────────────────────────────────────────────────────────────────

function InvoicesView({ invoices, clients, billing, state, dispatch, toast, openPreview }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<BillingDocument | null>(null);
  const [selected, setSelected] = useState<BillingDocument | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<BillingDocument | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', currency: 'MWK' as BillingCurrency, exchangeRate: '1', method: 'Bank Transfer', reference: '', date: new Date().toISOString().slice(0, 10) });

  const getClient = (id: string) => clients.find((c: BillingClient) => c.id === id);
  const initials = (name: string) => name?.split(' ').map((w:string) => w[0]).join('').slice(0,2).toUpperCase() || '?';
  const avatarColors = ['bg-primary/20 text-primary','bg-blue-500/20 text-blue-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
  const avatarColor = (id: string) => avatarColors[id?.charCodeAt(0) % avatarColors.length] || avatarColors[0];

  const thisMonth = new Date().toISOString().slice(0,7);
  const totalOutstanding = invoices.filter((i: BillingDocument) => i.status !== 'paid').reduce((s: number, i: BillingDocument) => s + Math.max(0, i.total - i.payments.reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0)), 0);
  const totalOverdue = invoices.filter((i: BillingDocument) => isOverdue(i)).reduce((s: number, i: BillingDocument) => s + Math.max(0, i.total - i.payments.reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0)), 0);
  const collectedMonth = invoices.reduce((s: number, i: BillingDocument) => s + i.payments.filter((p: BillingPayment) => p.date.startsWith(thisMonth)).reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0), 0);
  const paidInvoices = invoices.filter((i: BillingDocument) => i.status === 'paid' && i.payments.length > 0);
  const avgDaysToPay = paidInvoices.length === 0 ? null : Math.round(
    paidInvoices.reduce((s: number, i: BillingDocument) => {
      const lastPayment = i.payments[i.payments.length - 1];
      const days = Math.max(0, Math.floor((new Date(lastPayment.date).getTime() - new Date(i.issueDate).getTime()) / 86400000));
      return s + days;
    }, 0) / paidInvoices.length
  );

  const del = (id: string) => { if (confirm('Delete invoice?')) { dispatch({ type: 'BILLING_DELETE_DOCUMENT', payload: id }); if (selected?.id === id) setSelected(null); toast({ title: 'Invoice deleted' }); }};
  const updateStatus = (doc: BillingDocument, status: string) => { dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...doc, status, updatedAt: new Date().toISOString() } }); if (selected?.id === doc.id) setSelected({ ...doc, status } as any); toast({ title: 'Status updated' }); };
  const duplicate = (inv: BillingDocument) => { const num = nextNumber('invoice', billing.counters.invoice, billing.settings); dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: { ...inv, id: genId(), number: num, status: 'draft', payments: [], convertedFromQuoteId: undefined, convertedToInvoiceId: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }); toast({ title: 'Duplicated', description: num }); };
  const sendEmail = (inv: BillingDocument) => {
    const client = getClient(inv.clientId);
    if (!client?.email) { toast({ title: 'No client email', variant: 'destructive' }); return; }
    const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
    const invSubj = encodeURIComponent(billing.settings.companyName + ' — Invoice ' + inv.number);
    const invBody = encodeURIComponent('Hi ' + client.name + ',\n\nPlease find attached Invoice ' + inv.number + ' for ' + fmtAmt(inv.total, inv.currency) + '.\n\nAmount Due: ' + fmtAmt(inv.total - paid, inv.currency) + '\nDue Date: ' + (inv.dueDate || '—') + '\n\n' + billing.settings.companyName);
    window.open('mailto:' + client.email + '?subject=' + invSubj + '&body=' + invBody);
    toast({ title: 'Email draft opened' });
  };

  const recordPayment = () => {
    if (!payingInvoice) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const rate = parseFloat(payForm.exchangeRate) || 1;
    const payment: BillingPayment = { id: genId(), date: payForm.date, amount, currency: payForm.currency, mwkEquivalent: payForm.currency === 'MWK' ? amount : Math.round(amount * rate), exchangeRate: rate, method: payForm.method, reference: payForm.reference || undefined };
    dispatch({ type: 'BILLING_ADD_PAYMENT', payload: { documentId: payingInvoice.id, payment } });
    const allPayments = [...payingInvoice.payments, payment];
    const totalPaidNow = allPayments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
    const isFullyPaid = totalPaidNow >= payingInvoice.total;
    const paymentStatus = isFullyPaid ? 'Paid in full' : 'Partial payment';

    // ── Auto WC inflow ──
    const wcClient = billing.clients.find((c: BillingClient) => c.id === payingInvoice.clientId);
    dispatch({ type: 'ADD_WC_TRANSACTION', payload: { id: 'wc-' + genId(), date: payment.date, type: 'inflow', category: 'client_payment', amount: payment.mwkEquivalent, description: (wcClient?.name || 'Client') + ' — ' + payingInvoice.number + (payment.reference ? ' · ' + payment.reference : ''), reference: payment.reference, balanceAfter: 0, autoGenerated: true } });

    // ── Sync linked project + update retained profit ──
    const allLinkedProjects = state.projects || [];
    const linkedProject = allLinkedProjects.find((p: any) => p.billingInvoiceId === payingInvoice.id);
    if (linkedProject) {
      const newPaid = allPayments.reduce((s: number, p: BillingPayment) => s + p.mwkEquivalent, 0);
      dispatch({ type: 'SYNC_PROJECT_PAYMENT_STATUS', payload: {
        projectId: linkedProject.id,
        paidAmount: newPaid,
        status: newPaid >= linkedProject.revenue ? 'confirmed' : 'partial',
      }});
      // Calculate company fund (60%) portion of this payment net of costs
      const costsRatio = linkedProject.revenue > 0 ? (linkedProject.directExpenses || 0) / linkedProject.revenue : 0;
      const netPortion = payment.mwkEquivalent * (1 - costsRatio);
      const companyPortion = Math.round(netPortion * (state.settings?.revenueSplit?.companyPercent ?? 60) / 100);
      if (companyPortion > 0) {
        dispatch({ type: 'ADD_RETAINED_PROFIT', payload: companyPortion });
      }
    }

    const existingReceipt = billing.documents.find((d: BillingDocument) => d.type === 'receipt' && (d as any).sourceInvoiceId === payingInvoice.id);
    if (existingReceipt) {
      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...existingReceipt, payments: allPayments, status: isFullyPaid ? ('paid' as any) : ('partial' as any), notes: `Receipt for Invoice ${payingInvoice.number} — ${paymentStatus}`, updatedAt: new Date().toISOString() } });
      toast({ title: isFullyPaid ? '✓ Fully paid — receipt updated' : '✓ Payment recorded', description: existingReceipt.number });
    } else {
      const rcpNumber = nextNumber('receipt' as DocType, billing.counters.receipt, billing.settings);
      dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: { id: genId(), type: 'receipt', number: rcpNumber, clientId: payingInvoice.clientId, projectId: payingInvoice.projectId, projectName: (payingInvoice as any).projectName, currency: payingInvoice.currency, lineItems: payingInvoice.lineItems, subtotal: payingInvoice.subtotal, taxRate: payingInvoice.taxRate, taxAmount: payingInvoice.taxAmount, discount: payingInvoice.discount, total: payingInvoice.total, status: isFullyPaid ? ('paid' as any) : ('partial' as any), issueDate: new Date().toISOString().slice(0,10), notes: `Receipt for Invoice ${payingInvoice.number} — ${paymentStatus}`, payments: allPayments, convertedFromQuoteId: payingInvoice.convertedFromQuoteId, sourceInvoiceId: payingInvoice.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
      toast({ title: isFullyPaid ? '✓ Fully paid — receipt generated' : '✓ Payment recorded', description: rcpNumber });
    }
    setPayingInvoice(null);
    setPayForm({ amount: '', currency: 'MWK', exchangeRate: '1', method: 'Bank Transfer', reference: '', date: new Date().toISOString().slice(0,10) });
  };

  const selClient = selected ? getClient(selected.clientId) : null;
  const selPaid = selected ? selected.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0) : 0;
  const selRemaining = selected ? selected.total - selPaid : 0;
  const selPct = selected && selected.total > 0 ? Math.min(100, (selPaid / selected.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Outstanding', value: 'MK ' + totalOutstanding.toLocaleString(), color: 'text-amber-400' },
          { label: 'Overdue', value: 'MK ' + totalOverdue.toLocaleString(), color: totalOverdue > 0 ? 'text-destructive' : 'text-primary' },
          { label: 'Collected (Month)', value: 'MK ' + collectedMonth.toLocaleString(), color: 'text-primary' },
          { label: 'Avg. Days to Pay', value: avgDaysToPay === null ? '—' : avgDaysToPay + ' days', color: avgDaysToPay === null ? 'text-muted-foreground' : avgDaysToPay <= 14 ? 'text-primary' : avgDaysToPay <= 30 ? 'text-amber-400' : 'text-destructive' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-card border-border"><CardContent className="p-3"><div className="text-xs text-muted-foreground mb-1">{label}</div><div className={`text-lg font-semibold ${color}`}>{value}</div></CardContent></Card>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
        <Button size="sm" onClick={() => { setEditingDoc(null); setShowForm(true); }} className="gap-1" disabled={clients.length === 0}><Plus className="w-3.5 h-3.5" />New Invoice</Button>
      </div>
      {clients.length === 0 && <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">Add a client first.</div>}
      {(showForm || editingDoc) && <DocumentForm type="invoice" clients={clients} billing={billing} dispatch={dispatch} toast={toast} editingDoc={editingDoc} onClose={() => { setShowForm(false); setEditingDoc(null); }} />}

      {/* Payment modal */}
      {payingInvoice && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Record Payment — {payingInvoice.number}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Currency</Label><Select value={payForm.currency} onValueChange={v => setPayForm(p => ({...p, currency: v as BillingCurrency}))}><SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              {payForm.currency !== 'MWK' && <div className="space-y-1"><Label className="text-xs">Rate to MWK</Label><Input type="number" value={payForm.exchangeRate} onChange={e => setPayForm(p => ({...p, exchangeRate: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>}
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({...p, date: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Method</Label><Select value={payForm.method} onValueChange={v => setPayForm(p => ({...p, method: v}))}><SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent className="bg-card border-border">{['Bank Transfer','Mobile Money','Cash','Cheque','Other'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={payForm.reference} onChange={e => setPayForm(p => ({...p, reference: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
            </div>
            {payForm.currency !== 'MWK' && payForm.amount && <div className="text-xs text-muted-foreground">MWK equivalent: <span className="text-foreground font-medium">MK {Math.round(parseFloat(payForm.amount||'0') * (parseFloat(payForm.exchangeRate)||1)).toLocaleString()}</span></div>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPayingInvoice(null)}>Cancel</Button>
              <Button size="sm" onClick={recordPayment}>Record Payment</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Card className="bg-card border-border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Due</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: BillingDocument) => {
                  const client = getClient(inv.clientId);
                  const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                  const remaining = inv.total - paid;
                  const ds = getDisplayStatus(inv);
                  return (
                    <tr key={inv.id} onClick={() => setSelected(selected?.id === inv.id ? null : inv)}
                      className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/30 ${selected?.id === inv.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''} ${ds === 'overdue' ? 'bg-destructive/5' : ''}`}>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{inv.issueDate}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.number}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${avatarColor(inv.clientId)}`}>{initials(client?.name || '?')}</div>
                          <span className="text-sm font-medium truncate max-w-[110px]">{client?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(ds)}`}>{ds.toUpperCase()}</span>
                        {ds === 'overdue' && inv.dueDate && <div className="text-[10px] text-destructive mt-0.5">{Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)}d overdue</div>}
                      </td>
                      <td className={`px-4 py-3 text-xs ${ds === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>{inv.dueDate || '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">{fmtAmt(inv.total, inv.currency)}</td>
                      <td className={`px-4 py-3 text-right text-sm font-semibold ${remaining > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{fmtAmt(remaining, inv.currency)}</td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && !showForm && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No invoices yet</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-64 flex-shrink-0">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{selected.number}</div>
                    <div className="font-medium text-sm mt-0.5">{selClient?.name || '—'}</div>
                    {(selected as any).projectName && <div className="text-xs text-muted-foreground mt-0.5">{(selected as any).projectName}</div>}
                    <div className="mt-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(getDisplayStatus(selected))}`}>{getDisplayStatus(selected).toUpperCase()}</span></div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total</span><span className="font-semibold">{fmtAmt(selected.total, selected.currency)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Paid</span><span className="text-primary font-medium">{fmtAmt(selPaid, selected.currency)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Balance Due</span><span className={selRemaining > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>{fmtAmt(selRemaining, selected.currency)}</span></div>
                  {selected.total > 0 && <div className="h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${selPct}%` }} /></div>}
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Issued</span><span>{selected.issueDate}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Due</span><span className={getDisplayStatus(selected) === 'overdue' ? 'text-destructive' : ''}>{selected.dueDate || '—'}</span></div>
                  {selected.payments.length > 0 && (
                    <div className="pt-1 space-y-1">
                      {selected.payments.map((p: BillingPayment) => (
                        <div key={p.id} className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{p.date} · {p.method}</span>
                          <span className="text-primary">{fmtAmt(p.amount, p.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  {selected.status !== 'paid' && <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-primary border-primary/40" variant="outline" onClick={() => setPayingInvoice(selected)}><Check className="w-3 h-3" />Record Payment</Button>}
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => { setEditingDoc(selected); setSelected(null); }}><Edit2 className="w-3 h-3" />Edit</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => openPreview(selected)}><Eye className="w-3 h-3" />Preview</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => generatePDF(selected, selClient, billing.settings)}><FileText className="w-3 h-3" />Download PDF</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => sendEmail(selected)}><Mail className="w-3 h-3" />Send Email</Button>
                  {selected.status === 'draft' && <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => updateStatus(selected, 'sent')}><Send className="w-3 h-3" />Mark Sent</Button>}
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => duplicate(selected)}><Copy className="w-3 h-3" />Duplicate</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-blue-400 border-blue-500/30" variant="outline" onClick={() => {
                      const inv = billing.clients.find((c: BillingClient) => c.id === selected.clientId);
                      const projectSlug = slugify((selected as any).projectName || selected.number);
                      const clientSlug = slugify(inv?.name || 'client');
                      const shortId = Math.random().toString(36).slice(2, 7);
                      const token = projectSlug + '-' + clientSlug + '-' + shortId;
                      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...selected, approvalToken: token, approvalOpenedCount: 0, updatedAt: new Date().toISOString() } });
                      setSelected({ ...selected, approvalToken: token, approvalOpenedCount: 0 });
                      toast({ title: '✓ Approval link generated' });
                    }}>
                    <Link className="w-3 h-3" />Generate Approval Link
                  </Button>
                  {selected.approvalToken && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 p-2 bg-secondary/50 rounded text-[10px] font-mono break-all text-muted-foreground">{(billing.settings.customDomain ? 'https://' + billing.settings.customDomain : window.location.origin) + '/#approve/' + selected.approvalToken}</div>
                      <Button size="sm" className="w-full text-xs h-7 gap-1.5 justify-start" variant="outline" onClick={() => { navigator.clipboard.writeText((billing.settings.customDomain ? 'https://' + billing.settings.customDomain : window.location.origin) + '/#approve/' + selected.approvalToken); toast({ title: 'Link copied!' }); }}>Copy Link</Button>
                      {selected.approvalOpenedCount !== undefined && selected.approvalOpenedCount > 0 && <div className="text-[10px] text-muted-foreground text-center">Opened {selected.approvalOpenedCount}×</div>}
                    </div>
                  )}
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-destructive border-destructive/30" variant="outline" onClick={() => del(selected.id)}><Trash2 className="w-3 h-3" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Document Form (quote + invoice + proforma + edit) ────────────────────────

function DocumentForm({ type, clients, billing, dispatch, toast, onClose, editingDoc }: {
  type: 'quote' | 'invoice'; clients: BillingClient[]; billing: any;
  dispatch: any; toast: any; onClose: () => void; editingDoc?: BillingDocument | null;
}) {
  const ed = editingDoc;
  const today = new Date().toISOString().slice(0, 10);
  const [docType, setDocType] = useState<DocType>(ed ? ed.type as DocType : type === 'invoice' ? 'invoice' : 'quote');
  const [clientId, setClientId] = useState(ed?.clientId || clients[0]?.id || '');
  const [currency, setCurrency] = useState<BillingCurrency>(ed?.currency || billing.settings.defaultCurrency);
  const [issueDate, setIssueDate] = useState(ed?.issueDate || today);
  const [dueDate, setDueDate] = useState(ed?.dueDate || new Date(Date.now() + billing.settings.defaultPaymentTerms * 86400000).toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(ed?.validUntil || new Date(Date.now() + billing.settings.quoteValidityDays * 86400000).toISOString().slice(0, 10));
  const [projectName, setProjectName] = useState(ed?.projectName || '');
  const [taxRate, setTaxRate] = useState(ed?.taxRate ?? billing.settings.defaultTaxRate);
  const [discount, setDiscount] = useState(ed?.discount ?? 0);
  const [notes, setNotes] = useState(ed?.notes || (type === 'quote' ? billing.settings.quoteNotes : billing.settings.invoiceNotes));
  const [depositPercent, setDepositPercent] = useState<number>(ed?.depositPercent ?? 50);
  const [items, setItems] = useState<LineItem[]>(ed?.lineItems || [{ id: genId(), description: '', qty: 1, unitPrice: 0, total: 0 }]);

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.qty * updated.unitPrice;
      return updated;
    }));
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const save = (asDraft = false) => {
    if (!clientId) { toast({ title: 'Select a client', variant: 'destructive' }); return; }
    if (items.every(i => !i.description.trim())) { toast({ title: 'Add at least one line item', variant: 'destructive' }); return; }

    const counterKey = docType === 'proforma' ? 'invoice' : docType;
    const number = ed ? ed.number : nextNumber(docType, billing.counters[counterKey]);
    const status = asDraft ? 'draft' : (ed?.status || 'draft');

    const docData: BillingDocument = {
      id: ed?.id || genId(),
      type: docType,
      number,
      clientId,
      currency,
      lineItems: items.filter(i => i.description.trim()),
      subtotal, taxRate, taxAmount, discount, total,
      status,
      issueDate,
      notes,
      payments: ed?.payments || [],
      projectName: projectName.trim() || undefined,
      depositPercent,
      dueDate: docType === 'invoice' ? dueDate : undefined,
      validUntil: docType !== 'invoice' ? validUntil : undefined,
      createdAt: ed?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (ed) {
      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: docData });
      toast({ title: '✓ Document updated' });
    } else {
      dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: docData });
      toast({ title: `✓ ${docType === 'proforma' ? 'Proforma Invoice' : docType === 'quote' ? 'Quote' : 'Invoice'} created`, description: number });
    }
    onClose();
  };

  return (
    <Card className="bg-card border-primary/30 border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{ed ? 'Edit Document' : 'New Document'}</CardTitle>
          {!ed && type === 'quote' && (
            <div className="flex gap-1 bg-secondary/50 p-0.5 rounded-md">
              {(['quote', 'proforma'] as DocType[]).map(t => (
                <button key={t} onClick={() => setDocType(t)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${docType === t ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
                  {t === 'quote' ? 'Quote' : 'Proforma Invoice'}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">{clients.map((c: BillingClient) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Currency</Label>
            <Select value={currency} onValueChange={v => setCurrency(v as BillingCurrency)}>
              <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Issue Date</Label><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="bg-secondary border-input h-8 text-sm" /></div>
          {docType === 'invoice' && <div className="space-y-1"><Label className="text-xs">Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-secondary border-input h-8 text-sm" /></div>}
          {docType !== 'invoice' && <div className="space-y-1"><Label className="text-xs">Valid Until</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="bg-secondary border-input h-8 text-sm" /></div>}
          <div className="col-span-2 space-y-1"><Label className="text-xs">Project Name (optional)</Label><Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Brand Identity & Signage" className="bg-secondary border-input h-8 text-sm" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Deposit Required (%)</Label>
            <Select value={String(depositPercent)} onValueChange={v => setDepositPercent(parseInt(v))}>
              <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {[0,25,50,60,75,100].map(p => <SelectItem key={p} value={String(p)}>{p === 0 ? 'No deposit' : `${p}% upfront`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Line Items</div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
              <div className="col-span-5">Description</div><div className="col-span-2 text-right">Qty</div><div className="col-span-2 text-right">Unit Price</div><div className="col-span-2 text-right">Total</div><div className="col-span-1"></div>
            </div>
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5"><textarea value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Service description" rows={2} className="w-full bg-secondary border border-input rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" /></div>
                <div className="col-span-2"><Input type="number" value={item.qty} onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value)||0)} className="bg-secondary border-input h-8 text-sm text-right" /></div>
                <div className="col-span-2"><Input type="number" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value)||0)} className="bg-secondary border-input h-8 text-sm text-right" /></div>
                <div className="col-span-2 text-right text-sm font-medium">{item.total.toLocaleString()}</div>
                <div className="col-span-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setItems(p => p.filter(i => i.id !== item.id))}><X className="w-3 h-3" /></Button></div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setItems(p => [...p, { id: genId(), description: '', qty: 1, unitPrice: 0, total: 0 }])}><Plus className="w-3 h-3" />Add Line</Button>
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmtAmt(subtotal, currency)}</span></div>
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Tax %</span><Input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value)||0)} className="bg-secondary border-input h-7 w-20 text-sm text-right" /></div>
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Discount</span><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value)||0)} className="bg-secondary border-input h-7 w-24 text-sm text-right" /></div>
          <div className="flex justify-between text-base font-semibold border-t border-border pt-2"><span>Total</span><span className="text-primary">{fmtAmt(total, currency)}</span></div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes & Terms</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-secondary border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="outline" size="sm" onClick={() => save(true)}>Save as Draft</Button>
          <Button size="sm" onClick={() => save(false)}>{ed ? 'Update' : `Create ${docType === 'proforma' ? 'Proforma' : docType === 'quote' ? 'Quote' : 'Invoice'}`}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Billing Settings ─────────────────────────────────────────────────────────

function BillSettingsView({ settings, dispatch, toast }: { settings: BillingSettings; dispatch: any; toast: any }) {
  const [form, setForm] = useState(settings);
  const logoRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof BillingSettings, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) { toast({ title: 'Logo too large', description: 'Please use an image under 500KB', variant: 'destructive' }); return; }
    const reader = new FileReader();
    reader.onload = () => set('logoBase64', reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = () => {
    dispatch({ type: 'BILLING_UPDATE_SETTINGS', payload: form });
    toast({ title: '✓ Settings saved' });
  };

  const Field = ({ label, k, type = 'text' }: { label: string; k: keyof BillingSettings; type?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={String(form[k] ?? '')} onChange={e => set(k, type === 'number' ? parseFloat(e.target.value)||0 : e.target.value)} className="bg-secondary border-input text-sm" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Logo + Company */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Company & Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo upload + resize */}
          <div className="space-y-4">
            <Label className="text-xs">Company Logo</Label>
            <div className="flex items-start gap-6 flex-wrap">
              {/* Live preview */}
              <div className="flex-shrink-0">
                <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Preview</div>
                <div className="border border-dashed border-border rounded-lg bg-secondary/20 flex items-center justify-center overflow-hidden"
                  style={{ width: '180px', height: '80px' }}>
                  {form.logoBase64
                    ? <img src={form.logoBase64} alt="Logo"
                        style={{
                          width: `${(form.logoWidth || 50) * 2.2}px`,
                          height: (form.logoHeight || 0) > 0 ? `${(form.logoHeight || 0) * 2.2}px` : 'auto',
                          maxWidth: '170px', maxHeight: '72px', objectFit: 'contain'
                        }} />
                    : <div className="text-center"><Image className="w-6 h-6 mx-auto text-muted-foreground mb-1" /><div className="text-[10px] text-muted-foreground">No logo</div></div>}
                </div>
              </div>

              {/* Controls */}
              <div className="flex-1 space-y-4 min-w-[200px]">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => logoRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />Upload Logo
                  </Button>
                  {form.logoBase64 && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => set('logoBase64', '')}>Remove</Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">PNG or JPG · Max 500KB · Transparent background recommended</div>

                {form.logoBase64 && (
                  <div className="space-y-3 pt-1">
                    {/* Width slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">Width</Label>
                        <span className="text-xs text-muted-foreground font-mono">{form.logoWidth || 50}mm</span>
                      </div>
                      <input type="range" min={20} max={80} step={1}
                        value={form.logoWidth || 50}
                        onChange={e => set('logoWidth', parseInt(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>20mm</span><span>80mm</span>
                      </div>
                    </div>

                    {/* Height slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">Height</Label>
                        <span className="text-xs text-muted-foreground font-mono">
                          {(form.logoHeight || 0) > 0 ? `${form.logoHeight}mm` : 'Auto'}
                        </span>
                      </div>
                      <input type="range" min={0} max={40} step={1}
                        value={form.logoHeight || 0}
                        onChange={e => set('logoHeight', parseInt(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Auto</span><span>40mm</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Name" k="companyName" />
            <Field label="Tagline" k="tagline" />
            <Field label="Email" k="email" />
            <Field label="Phone" k="phone" />
            <Field label="Website" k="website" />
            <Field label="Address" k="address" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Bank Account — MWK</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank Name" k="mwkBankName" /><Field label="Account Name" k="mwkAccountName" />
          <Field label="Account Number" k="mwkAccountNumber" /><Field label="Branch" k="mwkBranch" />
          <Field label="Branch Code" k="mwkBranchCode" /><Field label="Swift Code" k="mwkSwift" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Bank Account — USD / ZAR</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank Name" k="usdBankName" /><Field label="Account Name" k="usdAccountName" />
          <Field label="Account Number" k="usdAccountNumber" /><Field label="Sort Code" k="usdSortCode" />
          <Field label="Swift Code" k="usdSwift" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Document Numbering</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Format: PREFIX-COMPANYCODE-YEAR-SEQUENCE</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Company Code</Label>
              <Input value={form.companyCode || 'INSPX'} onChange={e => set('companyCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))} className="bg-secondary border-input text-sm" placeholder="INSPX" />
              <p className="text-[10px] text-muted-foreground">Inserted between prefix and year — e.g. INSPX</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Starting Invoice Number</Label>
              <Input type="number" min={1} value={form.invoiceStartNumber || 1} onChange={e => set('invoiceStartNumber', parseInt(e.target.value)||1)} className="bg-secondary border-input text-sm" />
              <p className="text-[10px] text-muted-foreground">Set higher if migrating from another system.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Invoice Prefix</Label>
              <Input value={form.invoicePrefix || 'INV'} onChange={e => set('invoicePrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} className="bg-secondary border-input text-sm" placeholder="INV" />
              <p className="text-[10px] text-primary font-mono">{form.invoicePrefix || 'INV'}-{form.companyCode || 'INSPX'}-{new Date().getFullYear()}-001</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quote Prefix</Label>
              <Input value={form.quotePrefix || 'QT'} onChange={e => set('quotePrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} className="bg-secondary border-input text-sm" placeholder="QT" />
              <p className="text-[10px] text-primary font-mono">{form.quotePrefix || 'QT'}-{form.companyCode || 'INSPX'}-{new Date().getFullYear()}-001</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Receipt Prefix</Label>
              <Input value={form.receiptPrefix || 'RCP'} onChange={e => set('receiptPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} className="bg-secondary border-input text-sm" placeholder="RCP" />
              <p className="text-[10px] text-primary font-mono">{form.receiptPrefix || 'RCP'}-{form.companyCode || 'INSPX'}-{new Date().getFullYear()}-001</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Invoice Defaults</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Default Currency</Label>
            <Select value={form.defaultCurrency} onValueChange={v => set('defaultCurrency', v)}>
              <SelectTrigger className="bg-secondary border-input text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Field label="Payment Terms (days)" k="defaultPaymentTerms" type="number" />
          <Field label="Default Tax Rate (%)" k="defaultTaxRate" type="number" />
          <Field label="Quote Validity (days)" k="quoteValidityDays" type="number" />
          <div className="col-span-2 space-y-1"><Label className="text-xs">Default Invoice Notes</Label><textarea value={form.invoiceNotes} onChange={e => set('invoiceNotes', e.target.value)} rows={2} className="w-full bg-secondary border border-input rounded-md px-3 py-2 text-sm resize-none" /></div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">Default Quote Notes</Label><textarea value={form.quoteNotes} onChange={e => set('quoteNotes', e.target.value)} rows={2} className="w-full bg-secondary border border-input rounded-md px-3 py-2 text-sm resize-none" /></div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Email Signature (appended to all Billing emails)</Label>
            <textarea value={form.emailSignature || ''} onChange={e => set('emailSignature', e.target.value)} rows={3} placeholder={"e.g.\nEkari Faria\nFounder & CCO · InspireX Studio Lab\n+265 991 013 426"} className="w-full bg-secondary border border-input rounded-md px-3 py-2 text-sm resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* View-only Access */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">View-only Access (PIN)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Set a PIN to give team members read-only access to Billing. They can view quotes, invoices and receipts but cannot edit, delete, or access team compensation data.</p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Enable PIN access</Label>
            <button onClick={() => set('viewPinEnabled', !form.viewPinEnabled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${form.viewPinEnabled ? 'bg-primary' : 'bg-secondary'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.viewPinEnabled ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          {form.viewPinEnabled && (
            <div className="space-y-1">
              <Label className="text-xs">PIN (4–6 digits)</Label>
              <Input type="password" value={form.viewPin || ''} onChange={e => set('viewPin', e.target.value.replace(/[^0-9]/g,'').slice(0,6))}
                placeholder="Enter PIN" maxLength={6} className="bg-secondary border-input text-sm w-32 tracking-widest" />
              <div className="text-[10px] text-muted-foreground">Share this PIN with your team. They enter it when they open InspireX OS.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button onClick={save}>Save Settings</Button></div>
    </div>
  );
}


// ─── Receipts View ────────────────────────────────────────────────────────────

function ReceiptsView({ receipts, clients, billing, dispatch, toast, openPreview }: any) {
  const [selected, setSelected] = useState<BillingDocument | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<BillingDocument | null>(null);
  const [editForm, setEditForm] = useState({ notes: '', projectName: '', issueDate: '' });

  const getClient = (id: string) => clients.find((c: BillingClient) => c.id === id);
  const initials = (name: string) => name?.split(' ').map((w:string) => w[0]).join('').slice(0,2).toUpperCase() || '?';
  const avatarColors = ['bg-primary/20 text-primary','bg-blue-500/20 text-blue-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
  const avatarColor = (id: string) => avatarColors[id?.charCodeAt(0) % avatarColors.length] || avatarColors[0];

  const del = (id: string) => { if (confirm('Delete receipt?')) { dispatch({ type: 'BILLING_DELETE_DOCUMENT', payload: id }); if (selected?.id === id) setSelected(null); toast({ title: 'Receipt deleted' }); }};
  const startEdit = (r: BillingDocument) => { setEditingReceipt(r); setEditForm({ notes: r.notes || '', projectName: (r as any).projectName || '', issueDate: r.issueDate }); };
  const saveEdit = () => {
    if (!editingReceipt) return;
    dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...editingReceipt, notes: editForm.notes, projectName: editForm.projectName, issueDate: editForm.issueDate, updatedAt: new Date().toISOString() } });
    toast({ title: '✓ Receipt updated' });
    setEditingReceipt(null);
  };
  const sendEmail = (r: BillingDocument) => {
    const client = getClient(r.clientId);
    if (!client?.email) { toast({ title: 'No client email', variant: 'destructive' }); return; }
    const totalPaid = r.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
    const rcpSubj = encodeURIComponent(billing.settings.companyName + ' — Receipt ' + r.number);
    const rcpBody = encodeURIComponent('Hi ' + client.name + ',\n\nPlease find attached your receipt ' + r.number + ' confirming payment of ' + fmtAmt(totalPaid, r.currency) + '.\n\nThank you for your business.\n\n' + billing.settings.companyName);
    window.open('mailto:' + client.email + '?subject=' + rcpSubj + '&body=' + rcpBody);
    toast({ title: 'Email draft opened' });
  };

  const selClient = selected ? getClient(selected.clientId) : null;
  const selPaid = selected ? selected.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{receipts.length} receipt{receipts.length !== 1 ? 's' : ''}</div>

      {editingReceipt && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Edit Receipt — {editingReceipt.number}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Receipt Date</Label><Input type="date" value={editForm.issueDate} onChange={e => setEditForm(p => ({...p, issueDate: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Project Name</Label><Input value={editForm.projectName} onChange={e => setEditForm(p => ({...p, projectName: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Notes</Label><textarea value={editForm.notes} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} rows={2} className="w-full bg-secondary border border-input rounded-md px-3 py-2 text-sm resize-none" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditingReceipt(null)}>Cancel</Button>
              <Button size="sm" onClick={saveEdit}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {receipts.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-12"><CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No receipts yet. A receipt is generated automatically on every payment.</p></div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <Card className="bg-card border-border overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Project</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Payments</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r: BillingDocument) => {
                    const client = getClient(r.clientId);
                    const totalPaid = r.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                    const isPartial = totalPaid < r.total;
                    return (
                      <tr key={r.id} onClick={() => setSelected(selected?.id === r.id ? null : r)}
                        className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/30 ${selected?.id === r.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.issueDate}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${avatarColor(r.clientId)}`}>{initials(client?.name || '?')}</div>
                            <span className="text-sm font-medium truncate max-w-[100px]">{client?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{(r as any).projectName || '—'}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isPartial ? 'text-amber-400 bg-amber-500/10' : 'text-primary bg-primary/10'}`}>{isPartial ? 'PARTIAL' : 'PAID'}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.payments.length}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-primary">{fmtAmt(totalPaid, r.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Side panel */}
          {selected && (
            <div className="w-64 flex-shrink-0">
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{selected.number}</div>
                      <div className="font-medium text-sm mt-0.5">{selClient?.name || '—'}</div>
                      {(selected as any).projectName && <div className="text-xs text-muted-foreground mt-0.5">{(selected as any).projectName}</div>}
                      <div className="mt-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selPaid < selected.total ? 'text-amber-400 bg-amber-500/10' : 'text-primary bg-primary/10'}`}>{selPaid < selected.total ? 'PARTIAL' : 'PAID'}</span></div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Received</span><span className="font-semibold text-primary">{fmtAmt(selPaid, selected.currency)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Invoice Total</span><span>{fmtAmt(selected.total, selected.currency)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Date</span><span>{selected.issueDate}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Payments</span><span>{selected.payments.length}</span></div>
                    {selected.payments.length > 0 && (
                      <div className="pt-1 space-y-1">
                        {selected.payments.map((p: BillingPayment) => (
                          <div key={p.id} className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{p.date} · {p.method}{p.reference ? ' · ' + p.reference : ''}</span>
                            <span className="text-primary">{fmtAmt(p.amount, p.currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {selected.notes && <div className="text-[10px] text-muted-foreground italic pt-1">{selected.notes}</div>}
                  </div>
                  <div className="border-t border-border pt-3 space-y-1.5">
                    <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => startEdit(selected)}><Edit2 className="w-3 h-3" />Edit</Button>
                    <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => openPreview(selected)}><Eye className="w-3 h-3" />Preview</Button>
                    <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => generatePDF(selected, selClient, billing.settings)}><FileText className="w-3 h-3" />Download PDF</Button>
                    <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => sendEmail(selected)}><Mail className="w-3 h-3" />Send Email</Button>
                    <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-destructive border-destructive/30" variant="outline" onClick={() => del(selected.id)}><Trash2 className="w-3 h-3" />Delete</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Document Preview (HTML render matching PDF layout) ───────────────────────

function DocumentPreview({ doc, client, settings }: { doc: BillingDocument; client: BillingClient | undefined; settings: BillingSettings }) {
  const sym = doc.currency === 'MWK' ? 'MK' : doc.currency === 'USD' ? '$' : 'R';
  const fmt = (n: number) => sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bank = doc.currency === 'MWK'
    ? [['Bank', settings.mwkBankName], ['Account Name', settings.mwkAccountName], ['Account No', settings.mwkAccountNumber], ['Branch', settings.mwkBranch + ' (' + settings.mwkBranchCode + ')'], ['Swift', settings.mwkSwift]]
    : [['Bank', settings.usdBankName], ['Account Name', settings.usdAccountName], ['Account No', settings.usdAccountNumber], ['Sort Code', settings.usdSortCode], ['Swift', settings.usdSwift]];

  const LogoEl = () => settings.logoBase64
    ? <img src={settings.logoBase64} alt="logo" style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '4px' }} />
    : <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>Inspire<span style={{ color: '#73F764' }}>X</span></div>;

  // ── RECEIPT preview ──
  if (doc.type === 'receipt') {
    const totalPaid = doc.payments.reduce((s, p) => s + p.amount, 0);
    const currFull = doc.currency === 'MWK' ? 'Malawian Kwacha (MWK)' : doc.currency === 'USD' ? 'US Dollar (USD)' : 'South African Rand (ZAR)';
    const lastP = doc.payments[doc.payments.length - 1];
    return (
      <div style={{ background: '#0D0D0D', padding: '32px', borderRadius: '8px', fontFamily: 'sans-serif', color: '#fff', fontSize: '12px', lineHeight: 1.5 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div><LogoEl /><div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{settings.tagline}</div></div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#73F764', letterSpacing: '2px' }}>RECEIPT</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}># {doc.number}</div>
          </div>
        </div>
        <div style={{ height: '0.5px', background: '#73F764', margin: '12px 0' }} />

        {/* Confirmation badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0A1F0A', border: '0.5px solid #73F764', borderRadius: '6px', padding: '10px 14px', marginBottom: '18px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#73F764', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0D0D0D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#73F764' }}>Payment Received</div>
            <div style={{ fontSize: '8.5px', color: '#3A7A3A', marginTop: '1px' }}>This receipt confirms full payment has been received by {settings.companyName}</div>
          </div>
        </div>

        {/* From / Received From */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>From</div>
            <div style={{ fontWeight: 600, marginBottom: '3px' }}>{settings.companyName}</div>
            <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.7 }}>{[settings.email, settings.phone, settings.website, settings.address].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Received From</div>
            <div style={{ fontWeight: 600, marginBottom: '3px' }}>{client?.name || '—'}</div>
            <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.7 }}>{[client?.email, client?.phone, client?.address].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</div>
          </div>
        </div>

        {/* Dates bar */}
        <div style={{ background: '#111', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Receipt Date</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#ccc' }}>{doc.issueDate}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Invoice Reference</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#ccc' }}>{doc.notes?.replace('Receipt for Invoice ', '') || '—'}</div>
          </div>
        </div>

        {/* Amount block */}
        <div style={{ background: '#111', borderRadius: '6px', padding: '18px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Total Amount Received</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#73F764', letterSpacing: '-0.5px' }}>{fmt(totalPaid)}</div>
            <div style={{ fontSize: '9px', color: '#3A7A3A', marginTop: '3px' }}>{currFull}</div>
          </div>
          {(doc as any).projectName && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Project</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#ccc' }}>{(doc as any).projectName}</div>
            </div>
          )}
        </div>

        {/* Payment details */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Payment Details</div>
          {lastP && [
            ['Date', lastP.date],
            ['Method', lastP.method],
            ...(lastP.reference ? [['Reference', lastP.reference]] : []),
            ['Amount', fmt(lastP.amount) + (lastP.currency !== doc.currency ? ' (MK ' + lastP.mwkEquivalent.toLocaleString() + ')' : '')],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '5px 0', borderBottom: '0.5px solid #1a1a1a' }}>
              <span style={{ color: '#666' }}>{k}</span><span style={{ color: '#ccc' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '5px 0' }}>
            <span style={{ color: '#666' }}>Balance Due</span><span style={{ color: '#73F764', fontWeight: 600 }}>{fmt(0)} — Settled</span>
          </div>
        </div>

        {/* Received Into */}
        <div style={{ borderTop: '0.5px solid #1a1a1a', paddingTop: '12px' }}>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Received Into</div>
          {bank.map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', gap: '0', fontSize: '9px', marginBottom: '4px' }}>
              <span style={{ color: '#555', width: '100px', flexShrink: 0 }}>{k}</span>
              <span style={{ color: '#aaa' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '0.5px solid #1a1a1a', marginTop: '20px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#444' }}>
          <span>{settings.companyName} · {settings.website}</span>
          <span>{new Date().toLocaleDateString('en-GB')} · Page 1</span>
        </div>
      </div>
    );
  }

  const docLabel = doc.type === 'proforma' ? 'PROFORMA INVOICE' : doc.type === 'quote' ? 'QUOTE' : 'INVOICE';
  const dateLabel = doc.type === 'invoice' ? 'DUE DATE' : 'VALID UNTIL';
  const dateVal = doc.dueDate || doc.validUntil || '—';
  const subtotal = doc.subtotal;

  return (
    <div style={{ background: '#0D0D0D', padding: '32px', borderRadius: '8px', fontFamily: 'sans-serif', color: '#fff', fontSize: '12px', lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          {settings.logoBase64
            ? <img src={settings.logoBase64} alt="logo" style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '4px' }} />
            : <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>Inspire<span style={{ color: '#73F764' }}>X</span></div>}
          <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{settings.tagline}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#73F764', letterSpacing: '2px' }}>{docLabel}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}># {doc.number}</div>
        </div>
      </div>

      {/* Green divider */}
      <div style={{ height: '0.5px', background: '#73F764', margin: '12px 0' }} />

      {/* FROM / TO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>From</div>
          <div style={{ fontWeight: 600, marginBottom: '3px' }}>{settings.companyName}</div>
          <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.7 }}>
            {[settings.email, settings.phone, settings.website, settings.address].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Bill To</div>
          <div style={{ fontWeight: 600, marginBottom: '3px' }}>{client?.name || '—'}</div>
          <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.7 }}>
            {[client?.email, client?.phone, client?.address].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </div>

      {/* Dates bar */}
      <div style={{ background: '#111', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Issue Date</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#ccc' }}>{doc.issueDate}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>{dateLabel}</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#ccc' }}>{dateVal}</div>
        </div>
      </div>

      {/* Project name */}
      {(doc as any).projectName && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Project</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{(doc as any).projectName}</div>
        </div>
      )}

      {/* Line items table */}
      <div style={{ background: '#1a1a1a', padding: '6px 10px', borderRadius: '4px 4px 0 0', display: 'grid', gridTemplateColumns: '20px 1fr 40px 80px 80px', gap: '8px', marginBottom: '1px' }}>
        {['#', 'SERVICE & DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT'].map((h, i) => (
          <div key={i} style={{ fontSize: '8px', color: '#73F764', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>
      <div style={{ border: '0.5px solid #1e1e1e', borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden', marginBottom: '16px' }}>
        {doc.lineItems.map((item, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 40px 80px 80px', gap: '8px', padding: '8px 10px', background: idx % 2 === 0 ? '#0a0a0a' : '#0D0D0D', borderBottom: '0.5px solid #1a1a1a' }}>
            <div style={{ color: '#444', fontSize: '10px' }}>{idx + 1}</div>
            <div style={{ fontSize: '10px', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {(() => {
                const lines = item.description.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
                const title = lines[0] || '';
                const detail = lines.slice(1).join(' ');
                return (
                  <>
                    <div style={{ color: '#fff', fontWeight: 600, marginBottom: detail ? '3px' : '0' }}>{title}</div>
                    {detail && <div style={{ color: '#999', fontSize: '9px' }}>{detail}</div>}
                  </>
                );
              })()}
            </div>
            <div style={{ color: '#aaa', fontSize: '10px', textAlign: 'right' }}>{item.qty}</div>
            <div style={{ color: '#aaa', fontSize: '10px', textAlign: 'right' }}>{fmt(item.unitPrice)}</div>
            <div style={{ color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: 'right' }}>{fmt(item.total)}</div>
          </div>
        ))}
      </div>

      {/* Notes + Totals side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>
        {doc.notes && (
          <div style={{ background: '#111', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Notes & Terms</div>
            <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.7 }}>{doc.notes}</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span style={{ color: '#666' }}>Subtotal</span><span style={{ color: '#ccc' }}>{fmt(subtotal)}</span></div>
          {doc.taxRate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span style={{ color: '#666' }}>Tax ({doc.taxRate}%)</span><span style={{ color: '#ccc' }}>{fmt(doc.taxAmount)}</span></div>}
          {doc.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span style={{ color: '#666' }}>Discount</span><span style={{ color: '#ccc' }}>-{fmt(doc.discount)}</span></div>}
          <div style={{ height: '0.5px', background: '#73F764', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}><span style={{ color: '#73F764' }}>Total</span><span style={{ color: '#73F764' }}>{fmt(doc.total)}</span></div>
        </div>
      </div>

      {/* Payment history */}
      {doc.payments.length > 0 && (
        <div style={{ borderTop: '0.5px solid #1a1a1a', paddingTop: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Payment History</div>
          {doc.payments.map((p: BillingPayment, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '3px' }}>
              <span style={{ color: '#888' }}>{p.date} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
              <span style={{ color: '#73F764' }}>{fmtAmt(p.amount, p.currency)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Payment details */}
      <div style={{ borderTop: '0.5px solid #1a1a1a', paddingTop: '12px' }}>
        <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Payment Details</div>
        {bank.map(([label, value], i) => (
          <div key={i} style={{ display: 'flex', gap: '24px', fontSize: '9px', marginBottom: '4px' }}>
            <span style={{ color: '#555', minWidth: '90px' }}>{label}</span>
            <span style={{ color: '#aaa' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '0.5px solid #1a1a1a', marginTop: '20px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#444' }}>
        <span>{settings.companyName} · {settings.website}</span>
        <span>{new Date().toLocaleDateString('en-GB')} · Page 1</span>
      </div>
    </div>
  );
}

// ─── PDF Generator — pixel-matched to HTML preview ───────────────────────────

function generatePDF(doc: BillingDocument, client: BillingClient | undefined, settings: BillingSettings) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W  = 210;
  const H  = 297;
  const M  = 18;
  const CW = W - M * 2;
  let y    = 0;
  let pg   = 1;

  // Column positions — matched to HTML grid (20px 1fr 40px 80px 80px / 595px preview)
  const COL_NUM_X  = M + 2;
  const COL_DESC_X = M + 8;
  const COL_AMT_R  = W - M - 4;    // 188mm — matches dates bar indent
  const COL_UP_R   = W - M - 33;   // 159mm
  const COL_QTY_R  = W - M - 62;   // 130mm
  const COL_DESC_W = COL_QTY_R - COL_DESC_X - 5; // ~103mm

  const bg = () => { pdf.setFillColor('#0D0D0D'); pdf.rect(0, 0, W, H, 'F'); };

  const footer = () => {
    pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
    pdf.line(M, H - 12, W - M, H - 12);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#444444');
    pdf.text(settings.companyName + ' · ' + settings.website, M, H - 7);
    pdf.text(new Date().toLocaleDateString('en-GB') + ' · Page ' + pg, W - M, H - 7, { align: 'right' });
  };

  const newPage = () => { footer(); pdf.addPage(); pg++; bg(); y = M; };
  const check = (need: number) => { if (y + need > H - 18) newPage(); };

  bg();
  y = M + 2;

  // ══ RECEIPT — dedicated layout ══════════════════
  if (doc.type === 'receipt') {
    const rHeaderY = y;

    // Logo
    if (settings.logoBase64) {
      try {
        const ext = settings.logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
        const ti = document.createElement('img'); ti.src = settings.logoBase64;
        const nw = ti.naturalWidth || 400; const nh = ti.naturalHeight || 120;
        const lw = Math.min(Math.max(settings.logoWidth || 50, 20), 80);
        const lh = (settings.logoHeight && settings.logoHeight > 0) ? settings.logoHeight : Math.min(Math.max(+(lw*nh/nw).toFixed(1),7),22);
        pdf.addImage(settings.logoBase64, ext, M, y - 2, lw, lh);
        y += lh + 1;
      } catch {
        pdf.setFontSize(21); pdf.setFont('helvetica','bold');
        pdf.setTextColor('#FFFFFF'); pdf.text('Inspire', M, y);
        pdf.setTextColor('#73F764'); pdf.text('X', M + pdf.getTextWidth('Inspire'), y);
        y += 6;
      }
    } else {
      pdf.setFontSize(21); pdf.setFont('helvetica','bold');
      pdf.setTextColor('#FFFFFF'); pdf.text('Inspire', M, y);
      pdf.setTextColor('#73F764'); pdf.text('X', M + pdf.getTextWidth('Inspire'), y);
      y += 6;
    }
    pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor('#555555');
    pdf.text(settings.tagline, M, y);

    // RECEIPT label top right
    pdf.setFontSize(22); pdf.setFont('helvetica','bold'); pdf.setTextColor('#73F764');
    pdf.text('RECEIPT', W - M, rHeaderY + 6, { align: 'right' });
    pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor('#888888');
    pdf.text('# ' + doc.number, W - M, rHeaderY + 12, { align: 'right' });
    y += 5;

    // Green divider
    pdf.setDrawColor('#73F764'); pdf.setLineWidth(0.5);
    pdf.line(M, y, W - M, y); y += 6;

    // ── Payment Received badge ──
    pdf.setFillColor('#0A1F0A');
    pdf.rect(M, y, CW, 14, 'F');
    pdf.setDrawColor('#73F764'); pdf.setLineWidth(0.4);
    pdf.rect(M, y, CW, 14, 'S');
    // Checkmark circle
    pdf.setFillColor('#73F764');
    pdf.circle(M + 8, y + 7, 3.5, 'F');
    pdf.setDrawColor('#0D0D0D'); pdf.setLineWidth(0.8);
    pdf.line(M + 6.2, y + 7, M + 7.5, y + 8.5);
    pdf.line(M + 7.5, y + 8.5, M + 10, y + 5.5);
    // Text
    pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor('#73F764');
    pdf.text('Payment Received', M + 14, y + 6);
    pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor('#3A7A3A');
    pdf.text('This receipt confirms full payment has been received by ' + settings.companyName, M + 14, y + 11);
    y += 20;

    // ── FROM / RECEIVED FROM ──
    pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor('#555555');
    pdf.text('FROM', M, y);
    pdf.text('RECEIVED FROM', W - M, y, { align: 'right' });
    y += 4;

    pdf.setFontSize(10.5); pdf.setFont('helvetica','bold'); pdf.setTextColor('#FFFFFF');
    pdf.text(settings.companyName, M, y);
    const rcpClientLines = pdf.splitTextToSize(client?.name || '—', CW / 2 - 2) as string[];
    rcpClientLines.forEach((ln: string, i: number) => pdf.text(ln, W - M, y + i * 4.5, { align: 'right' }));
    y += Math.max(5, rcpClientLines.length * 4.5 + 1);

    pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor('#888888');
    const rcpFrom = [settings.email, settings.phone, settings.website, settings.address].filter(Boolean) as string[];
    const rcpToRaw = [client?.email || '', client?.phone || '', client?.address || ''].filter(Boolean) as string[];
    const rcpTo: string[] = rcpToRaw.flatMap((l: string) => pdf.splitTextToSize(l, CW / 2 - 4) as string[]);
    const rcpRows = Math.max(rcpFrom.length, rcpTo.length);
    for (let i = 0; i < rcpRows; i++) {
      if (rcpFrom[i]) pdf.text(rcpFrom[i], M, y);
      if (rcpTo[i])   pdf.text(rcpTo[i], W - M, y, { align: 'right' });
      y += 4;
    }
    y += 5;

    // ── Dates bar: Receipt Date + Invoice Ref ──
    pdf.setFillColor('#111111'); pdf.rect(M, y, CW, 13, 'F');
    pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor('#555555');
    pdf.text('RECEIPT DATE', M + 4, y + 4.5);
    pdf.text('INVOICE REFERENCE', W - M - 4, y + 4.5, { align: 'right' });
    pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor('#CCCCCC');
    pdf.text(fmtDateFull(doc.issueDate), M + 4, y + 10);
    pdf.text(doc.convertedFromQuoteId ? 'INV-' + doc.number.split('-').slice(1).join('-') : doc.notes?.replace('Receipt for Invoice ', '') || doc.number, W - M - 4, y + 10, { align: 'right' });
    y += 19;

    // ── Amount block ──
    const totalPaid = doc.payments.reduce((s, p) => s + p.amount, 0);
    const currSym = doc.currency === 'MWK' ? 'MK' : doc.currency === 'USD' ? '$' : 'R';
    const currFull = doc.currency === 'MWK' ? 'Malawian Kwacha (MWK)' : doc.currency === 'USD' ? 'US Dollar (USD)' : 'South African Rand (ZAR)';
    pdf.setFillColor('#111111'); pdf.rect(M, y, CW, 28, 'F');

    // Left: amount
    pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor('#555555');
    pdf.text('TOTAL AMOUNT RECEIVED', M + 6, y + 6);
    pdf.setFontSize(20); pdf.setFont('helvetica','bold'); pdf.setTextColor('#73F764');
    pdf.text(currSym + ' ' + totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), M + 6, y + 18);
    pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor('#3A7A3A');
    pdf.text(currFull, M + 6, y + 24);

    // Right: project
    if ((doc as any).projectName) {
      pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor('#555555');
      pdf.text('PROJECT', W - M - 6, y + 6, { align: 'right' });
      pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor('#CCCCCC');
      pdf.text((doc as any).projectName, W - M - 6, y + 13, { align: 'right' });
    }
    y += 34;

    // ── Payment breakdown ──
    pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor('#555555');
    pdf.text('PAYMENT DETAILS', M, y); y += 6;

    const payRows: [string, string, boolean?][] = [];
    if (doc.payments.length > 0) {
      const p = doc.payments[doc.payments.length - 1];
      payRows.push(['Date', p.date]);
      payRows.push(['Method', p.method]);
      if (p.reference) payRows.push(['Reference', p.reference]);
      payRows.push(['Amount', fmtAmt(p.amount, p.currency) + (p.currency !== 'MWK' ? ' (MK ' + p.mwkEquivalent.toLocaleString() + ')' : '')]);
    }
    payRows.push(['Balance Due', fmtAmt(0, doc.currency) + ' — Settled', true]);

    payRows.forEach(([k, v, green]) => {
      pdf.setFontSize(8); pdf.setFont('helvetica','normal');
      pdf.setTextColor('#666666'); pdf.text(k, M, y);
      pdf.setTextColor(green ? '#73F764' : '#CCCCCC'); pdf.text(v, W - M - 4, y, { align: 'right' });
      pdf.setDrawColor('#1A1A1A'); pdf.setLineWidth(0.2);
      pdf.line(M, y + 2, W - M, y + 2);
      y += 7;
    });
    y += 6;

    // ── Received Into (bank) ──
    pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
    pdf.line(M, y, W - M, y); y += 6;
    pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor('#555555');
    pdf.text('RECEIVED INTO', M, y); y += 6;

    const rcpBank = doc.currency === 'MWK'
      ? [['Bank', settings.mwkBankName], ['Account Name', settings.mwkAccountName], ['Account No', settings.mwkAccountNumber], ['Branch', settings.mwkBranch + ' (' + settings.mwkBranchCode + ')'], ['Swift', settings.mwkSwift]]
      : [['Bank', settings.usdBankName], ['Account Name', settings.usdAccountName], ['Account No', settings.usdAccountNumber], ['Sort Code', settings.usdSortCode], ['Swift', settings.usdSwift]];
    rcpBank.forEach(([k, v]) => {
      pdf.setFontSize(8); pdf.setFont('helvetica','normal');
      pdf.setTextColor('#555555'); pdf.text(k, M, y);
      pdf.setTextColor('#AAAAAA'); pdf.text(v, M + 32, y);
      y += 5;
    });

    footer();
    pdf.save(doc.number + '.pdf');
    return;
  }

  // ── 1. HEADER ──
  const headerBaseY = y;

  if (settings.logoBase64) {
    try {
      const ext = settings.logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
      const tmpImg = document.createElement('img');
      tmpImg.src = settings.logoBase64;
      const nw = tmpImg.naturalWidth  || 400;
      const nh = tmpImg.naturalHeight || 120;
      // Use user-set width (default 50mm), height auto-calculated or user-set
      const logoW = Math.min(Math.max(settings.logoWidth || 50, 20), 80);
      const autoH = +(logoW * nh / nw).toFixed(1);
      const logoH = (settings.logoHeight && settings.logoHeight > 0)
        ? settings.logoHeight
        : Math.min(Math.max(autoH, 7), 22);
      pdf.addImage(settings.logoBase64, ext, M, y - 2, logoW, logoH);
      y += logoH + 1;
    } catch {
      pdf.setFontSize(21); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor('#FFFFFF'); pdf.text('Inspire', M, y);
      pdf.setTextColor('#73F764'); pdf.text('X', M + pdf.getTextWidth('Inspire'), y);
      y += 6;
    }
  } else {
    pdf.setFontSize(21); pdf.setFont('helvetica', 'bold');
    pdf.setTextColor('#FFFFFF'); pdf.text('Inspire', M, y);
    pdf.setTextColor('#73F764'); pdf.text('X', M + pdf.getTextWidth('Inspire'), y);
    y += 6;
  }

  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#555555');
  pdf.text(settings.tagline, M, y);

  // Doc type — top right, anchored to headerBaseY
  const docLabel = doc.type === 'proforma' ? 'PROFORMA INVOICE'
                 : doc.type === 'invoice'  ? 'INVOICE'
                 : 'QUOTE';
  const docFontSize = doc.type === 'proforma' ? 15 : 22;
  pdf.setFontSize(docFontSize); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#73F764');
  pdf.text(docLabel, W - M, headerBaseY + 6, { align: 'right' });
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#888888');
  pdf.text('# ' + doc.number, W - M, headerBaseY + 12, { align: 'right' });

  y += 5;

  // Green divider
  pdf.setDrawColor('#73F764'); pdf.setLineWidth(0.5);
  pdf.line(M, y, W - M, y);
  y += 7;

  // ── 2. FROM / BILL TO ──
  // Labels
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#555555');
  pdf.text('FROM', M, y);
  pdf.text('BILL TO', W - M, y, { align: 'right' });
  y += 4;

  // Names
  pdf.setFontSize(10.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#FFFFFF');
  pdf.text(settings.companyName, M, y);
  const clientNameLines = pdf.splitTextToSize(client?.name || '\u2014', CW / 2 - 2) as string[];
  clientNameLines.forEach((ln: string, i: number) => {
    pdf.text(ln, W - M, y + i * 4.5, { align: 'right' });
  });
  y += Math.max(5, clientNameLines.length * 4.5 + 1);

  // Detail lines
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#888888');
  const fromDetails = [settings.email, settings.phone, settings.website, settings.address].filter(Boolean) as string[];
  const toDetailRaw = [client?.email || '', client?.phone || '', client?.address || ''].filter(Boolean) as string[];
  const toDetailW = CW / 2 - 4;
  const toDetails: string[] = toDetailRaw.flatMap((line: string) =>
    pdf.splitTextToSize(line, toDetailW) as string[]
  );
  const detailRows = Math.max(fromDetails.length, toDetails.length);
  for (let i = 0; i < detailRows; i++) {
    if (fromDetails[i]) pdf.text(fromDetails[i], M, y);
    if (toDetails[i])   pdf.text(toDetails[i], W - M, y, { align: 'right' });
    y += 4;
  }
  y += 5;

  // ── 3. DATES BAR ──
  const datesBarH = 13;
  pdf.setFillColor('#111111');
  pdf.rect(M, y, CW, datesBarH, 'F');
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#555555');
  pdf.text('ISSUE DATE', M + 4, y + 4.5);
  const d2label = doc.type === 'invoice' ? 'DUE DATE' : 'VALID UNTIL';
  pdf.text(d2label, W - M - 4, y + 4.5, { align: 'right' });
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#CCCCCC');
  pdf.text(fmtDateFull(doc.issueDate), M + 4, y + 10);
  const d2val = doc.dueDate || doc.validUntil || '\u2014';
  pdf.text(fmtDateFull(d2val), W - M - 4, y + 10, { align: 'right' });
  y += datesBarH + 5;

  // ── 4. PROJECT NAME ──
  if ((doc as any).projectName) {
    check(14);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#555555');
    pdf.text('PROJECT', M, y); y += 4;
    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#FFFFFF');
    const projLines = pdf.splitTextToSize((doc as any).projectName, CW) as string[];
    pdf.text(projLines, M, y);
    y += projLines.length * 5 + 4;
  }

  // ── 5. LINE ITEMS TABLE ──
  check(20);
  const tHdrH = 9;
  pdf.setFillColor('#1A1A1A');
  pdf.rect(M, y, CW, tHdrH, 'F');
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#73F764');
  pdf.text('#',                    COL_NUM_X,  y + 5.5);
  pdf.text('SERVICE & DESCRIPTION', COL_DESC_X, y + 5.5);
  pdf.text('QTY',        COL_QTY_R, y + 5.5, { align: 'right' });
  pdf.text('UNIT PRICE', COL_UP_R,  y + 5.5, { align: 'right' });
  pdf.text('AMOUNT',     COL_AMT_R, y + 5.5, { align: 'right' });
  y += tHdrH;

  doc.lineItems.forEach((item, idx) => {
    const lineH = 4.6;
    const padV  = 4;

    // Split at first newline: title (bold) + detail (muted)
    // If no newline, entire description is the title — still must wrap
    const rawLines = item.description.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const titleText  = rawLines[0] || '';
    const detailText = rawLines.slice(1).join(' ');

    // Both title and detail must wrap within column width
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold');
    const titleLines  = pdf.splitTextToSize(titleText, COL_DESC_W) as string[];
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    const detailLines = detailText
      ? pdf.splitTextToSize(detailText, COL_DESC_W) as string[]
      : [];

    // Row height = padding + title lines + gap + detail lines + padding
    const titleBlockH  = titleLines.length * lineH;
    const detailBlockH = detailLines.length > 0 ? detailLines.length * lineH + 2 : 0;
    const rowH = Math.max(12, padV + titleBlockH + detailBlockH + padV);

    check(rowH + 2);
    const rowTop = y;

    // Alternating background — full row height
    if (idx % 2 === 0) {
      pdf.setFillColor('#0A0A0A');
      pdf.rect(M, rowTop, CW, rowH, 'F');
    }
    pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.2);
    pdf.line(M, rowTop + rowH, W - M, rowTop + rowH);

    // Title — bold white, top-padded, wrapped
    const titleY = rowTop + padV + lineH;
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#FFFFFF');
    pdf.text(titleLines, COL_DESC_X, titleY);

    // Detail — muted grey, below title, wrapped
    if (detailLines.length > 0) {
      const detailY = titleY + titleBlockH + 1;
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#999999');
      pdf.text(detailLines, COL_DESC_X, detailY);
    }

    // Numerics — vertically centred against full row
    const midY = rowTop + rowH / 2 + 1.2;
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#555555');
    pdf.text(String(idx + 1), COL_NUM_X, midY);

    pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#AAAAAA');
    pdf.text(String(item.qty), COL_QTY_R, midY, { align: 'right' });
    pdf.text(fmtAmt(item.unitPrice, doc.currency), COL_UP_R, midY, { align: 'right' });

    pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold');
    pdf.text(fmtAmt(item.total, doc.currency), COL_AMT_R, midY, { align: 'right' });

    y = rowTop + rowH;
  });
  y += 6;

  // ── 6. NOTES (left charcoal box) + TOTALS (right) ──
  check(40);
  const notesW   = CW * 0.47;
  const totalsW2 = CW * 0.46;
  const totalsX  = W - M - totalsW2;
  const sectionY = y;

  // Notes box
  let notesBoxH = 0;
  if (doc.notes) {
    const noteLines = pdf.splitTextToSize(doc.notes, notesW - 8) as string[];
    notesBoxH = noteLines.length * 4.5 + 14;
    pdf.setFillColor('#111111');
    pdf.rect(M, sectionY, notesW, notesBoxH, 'F');
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#555555');
    pdf.text('NOTES & TERMS', M + 4, sectionY + 5.5);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#888888');
    pdf.text(noteLines, M + 4, sectionY + 11);
  }

  // Totals
  let ty = sectionY + 2;
  const tRow = (label: string, value: string, highlight = false) => {
    pdf.setFontSize(9); pdf.setFont('helvetica', highlight ? 'bold' : 'normal');
    pdf.setTextColor(highlight ? '#73F764' : '#666666');
    pdf.text(label, totalsX, ty);
    pdf.setTextColor(highlight ? '#73F764' : '#CCCCCC');
    pdf.text(value, W - M - 4, ty, { align: 'right' });
    ty += 6;
  };
  tRow('Subtotal', fmtAmt(doc.subtotal, doc.currency));
  if (doc.taxRate > 0) tRow('Tax (' + doc.taxRate + '%)', fmtAmt(doc.taxAmount, doc.currency));
  if (doc.discount > 0) tRow('Discount', '-' + fmtAmt(doc.discount, doc.currency));
  pdf.setDrawColor('#73F764'); pdf.setLineWidth(0.4);
  pdf.line(totalsX, ty, W - M - 4, ty); ty += 4;
  tRow('Total', fmtAmt(doc.total, doc.currency), true);

  y = sectionY + Math.max(notesBoxH, ty - sectionY) + 8;

  // ── 7. PAYMENT HISTORY ──
  if (doc.payments.length > 0) {
    check(doc.payments.length * 5 + 14);
    pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
    pdf.line(M, y, W - M, y); y += 5;
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#555555');
    pdf.text('PAYMENT HISTORY', M, y); y += 5;
    doc.payments.forEach(p => {
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#888888');
      pdf.text(p.date + ' \u00b7 ' + p.method + (p.reference ? ' \u00b7 ' + p.reference : ''), M, y);
      pdf.setTextColor('#73F764');
      pdf.text(fmtAmt(p.amount, p.currency), W - M - 4, y, { align: 'right' });
      y += 5;
    });
    y += 4;
  }

  // ── 8. PAYMENT DETAILS ──
  check(38);
  pdf.setDrawColor('#1E1E1E'); pdf.setLineWidth(0.3);
  pdf.line(M, y, W - M, y); y += 6;
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#555555');
  pdf.text('PAYMENT DETAILS', M, y); y += 6;

  const bankRows = doc.currency === 'MWK'
    ? [['Bank', settings.mwkBankName], ['Account Name', settings.mwkAccountName],
       ['Account No', settings.mwkAccountNumber],
       ['Branch', settings.mwkBranch + ' (' + settings.mwkBranchCode + ')'],
       ['Swift', settings.mwkSwift]]
    : [['Bank', settings.usdBankName], ['Account Name', settings.usdAccountName],
       ['Account No', settings.usdAccountNumber],
       ['Sort Code', settings.usdSortCode], ['Swift', settings.usdSwift]];

  bankRows.forEach(([label, value]) => {
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.setTextColor('#555555'); pdf.text(label, M, y);
    pdf.setTextColor('#AAAAAA'); pdf.text(value, M + 32, y);
    y += 5;
  });

  // ── 9. FOOTER ──
  footer();

  pdf.save(doc.number + '.pdf');
}

// ─── Client Side Panel with Activity Feed ────────────────────────────────────

function ClientSidePanel({ client, documents, onEdit, onDelete, onClose, initials, avatarColor }: any) {
  const [tab, setTab] = useState<'details' | 'activity'>('details');

  // Build activity feed from all documents for this client
  const clientDocs = documents
    .filter((d: BillingDocument) => d.clientId === client.id)
    .sort((a: BillingDocument, b: BillingDocument) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const feedEvents: { date: string; label: string; sub: string; color: string; badge?: string; badgeColor?: string }[] = [];

  clientDocs.forEach((doc: BillingDocument) => {
    // Creation
    feedEvents.push({
      date: doc.createdAt?.slice(0, 10) || doc.issueDate,
      label: doc.type === 'quote' ? 'Quote created' : doc.type === 'proforma' ? 'Proforma created' : doc.type === 'invoice' ? 'Invoice created' : 'Receipt created',
      sub: doc.number + (doc.projectName ? ' · ' + doc.projectName : '') + ' · ' + fmtAmt(doc.total, doc.currency),
      color: 'bg-secondary',
      badge: 'DRAFT', badgeColor: 'text-muted-foreground bg-secondary',
    });
    // Status changes
    if (doc.status === 'sent' || doc.status === 'accepted' || doc.status === 'rejected' || doc.status === 'expired') {
      feedEvents.push({
        date: doc.updatedAt?.slice(0, 10) || doc.issueDate,
        label: doc.status === 'sent' ? (doc.type === 'invoice' ? 'Invoice sent' : 'Quote sent') : doc.status === 'accepted' ? 'Quote accepted' : doc.status === 'rejected' ? 'Quote rejected' : 'Quote expired',
        sub: doc.number + ' · ' + fmtAmt(doc.total, doc.currency),
        color: doc.status === 'sent' ? 'bg-blue-500' : doc.status === 'accepted' ? 'bg-primary' : 'bg-destructive',
        badge: doc.status.toUpperCase(),
        badgeColor: doc.status === 'sent' ? 'text-blue-400 bg-blue-500/10' : doc.status === 'accepted' ? 'text-primary bg-primary/10' : 'text-destructive bg-destructive/10',
      });
    }
    if (doc.convertedFromQuoteId && doc.type === 'invoice') {
      feedEvents.push({
        date: doc.createdAt?.slice(0, 10) || doc.issueDate,
        label: 'Quote converted to invoice',
        sub: doc.number + ' created as draft',
        color: 'bg-purple-500',
        badge: 'CONVERTED', badgeColor: 'text-purple-400 bg-purple-500/10',
      });
    }
    // Payments
    doc.payments.forEach((p: BillingPayment) => {
      feedEvents.push({
        date: p.date,
        label: 'Payment received',
        sub: fmtAmt(p.amount, p.currency) + ' · ' + p.method + (p.reference ? ' · ' + p.reference : ''),
        color: 'bg-primary',
        badge: 'PAID', badgeColor: 'text-primary bg-primary/10',
      });
    });
    // Receipt
    if (doc.type === 'receipt') {
      feedEvents.push({
        date: doc.issueDate,
        label: 'Receipt generated',
        sub: doc.number + ' · ' + fmtAmt(doc.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0), doc.currency),
        color: 'bg-primary',
        badge: 'RECEIPT', badgeColor: 'text-primary bg-primary/10',
      });
    }
  });

  // Sort all events newest first
  feedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 flex items-start justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor(client.id)}`}>{initials(client.name)}</div>
            <div>
              <div className="font-medium text-sm leading-tight">{client.name}</div>
              <div className="text-[10px] text-primary mt-0.5">{client.currency}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['details', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors capitalize border-b-2 ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'activity' ? `Activity (${feedEvents.length})` : 'Details'}
            </button>
          ))}
        </div>

        {/* Details tab */}
        {tab === 'details' && (
          <div className="p-4 space-y-4">
            <div className="space-y-2.5">
              {client.email && <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Email</div><div className="text-xs">{client.email}</div></div>}
              {client.phone && <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Phone</div><div className="text-xs">{client.phone}</div></div>}
              {client.address && <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Address</div><div className="text-xs">{client.address}</div></div>}
              <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Added</div><div className="text-xs">{client.createdAt?.slice(0,10)}</div></div>
              <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Documents</div><div className="text-xs">{clientDocs.length} total</div></div>
            </div>
            <div className="border-t border-border pt-3 space-y-1.5">
              <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={onEdit}><Edit2 className="w-3 h-3" />Edit Client</Button>
              <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-destructive border-destructive/30 hover:bg-destructive/5" variant="outline" onClick={onDelete}><Trash2 className="w-3 h-3" />Delete</Button>
            </div>
          </div>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <div className="max-h-96 overflow-y-auto">
            {feedEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8 px-4">No activity yet for this client</div>
            ) : (
              <div className="p-2">
                {feedEvents.map((event, idx) => (
                  <div key={idx} className="flex gap-3 py-2.5 px-2">
                    <div className="flex flex-col items-center mt-0.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${event.color}`} />
                      {idx < feedEvents.length - 1 && <div className="w-px bg-border flex-1 mt-1 min-h-[12px]" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium">{event.label}</span>
                        {event.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${event.badgeColor}`}>{event.badge}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{event.sub}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">{event.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Project Costs View ──────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Design Assets', 'Printing', 'Software', 'Travel', 'Office', 'Other'];
const CATEGORY_COLORS: Record<string, string> = {
  'Design Assets': 'bg-blue-500',
  'Printing': 'bg-amber-500',
  'Software': 'bg-purple-500',
  'Travel': 'bg-green-500',
  'Office': 'bg-gray-500',
  'Other': 'bg-slate-400',
};

function ExpensesView({ expenses, clients, billing, state, dispatch, toast }: { expenses: Expense[]; clients: BillingClient[]; billing: any; state: any; dispatch: any; toast: any }) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Expense | null>(null);

  const invoices = billing.documents.filter((d: BillingDocument) => d.type === 'invoice');

  const emptyForm = {
    date: new Date().toISOString().slice(0,10),
    description: '',
    invoiceId: '',
    projectName: '',
    category: 'Design Assets' as ExpenseCategory,
    amount: '',
    currency: 'MWK' as BillingCurrency,
  };
  const [form, setForm] = useState(emptyForm);

  // Auto-fill client and project when invoice selected
  const handleInvoiceSelect = (invoiceId: string) => {
    const inv = invoices.find((i: BillingDocument) => i.id === invoiceId);
    if (inv) {
      setForm(p => ({
        ...p,
        invoiceId,
        projectName: (inv as any).projectName || inv.number,
        currency: inv.currency,
      }));
    } else {
      setForm(p => ({ ...p, invoiceId, projectName: '', currency: 'MWK' }));
    }
  };

  const reset = () => { setForm(emptyForm); setEditingExpense(null); setShowForm(false); };

  const save = () => {
    if (!form.description.trim()) { toast({ title: 'Description required', variant: 'destructive' }); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    if (!form.invoiceId) { toast({ title: 'Link this cost to an invoice', variant: 'destructive' }); return; }

    const amount = parseFloat(form.amount);
    const mwkAmount = form.currency === 'MWK' ? amount : amount; // simplified — can add exchange rate later

    if (editingExpense) {
      dispatch({ type: 'EXPENSE_UPDATE', payload: { ...editingExpense, ...form, amount } });
      toast({ title: '✓ Project cost updated' });
    } else {
      const expense: Expense = {
        id: genId(),
        date: form.date,
        description: form.description,
        invoiceId: form.invoiceId,
        projectName: form.projectName,
        category: form.category,
        amount,
        currency: form.currency,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'EXPENSE_ADD', payload: expense });

      // ── Auto-create WC project_expense outflow — with double-count guard ──
      const inv = invoices.find((i: BillingDocument) => i.id === form.invoiceId);
      const wcClient = inv ? clients.find((c: BillingClient) => c.id === inv.clientId) : null;
      const wcTransactions = state?.wcTransactions || [];
      const alreadyExists = wcTransactions.some((t: any) =>
        t.type === 'outflow' &&
        t.category === 'project_expense' &&
        t.amount === mwkAmount &&
        t.date === form.date &&
        !t.autoGenerated
      );
      if (alreadyExists) {
        toast({ title: '✓ Project cost recorded', description: 'WC entry skipped — a manual entry for this amount and date already exists' });
      } else {
        dispatch({ type: 'ADD_WC_TRANSACTION', payload: {
          id: 'wc-exp-' + genId(),
          date: form.date,
          type: 'outflow',
          category: 'project_expense',
          amount: mwkAmount,
          description: form.description + ' — ' + (wcClient?.name || form.projectName || 'Project'),
          balanceAfter: 0,
          autoGenerated: true,
        }});
        toast({ title: '✓ Project cost recorded', description: 'Auto-recorded in Working Capital' });
      }
    }
    reset();
  };

  const startEdit = (e: Expense) => {
    setEditingExpense(e);
    setForm({ date: e.date, description: e.description, invoiceId: e.invoiceId || '', projectName: e.projectName || '', category: e.category, amount: String(e.amount), currency: e.currency });
    setShowForm(true);
  };

  const del = (id: string) => {
    if (confirm('Delete project cost?')) {
      dispatch({ type: 'EXPENSE_DELETE', payload: id });
      if (selected?.id === id) setSelected(null);
      toast({ title: 'Project cost deleted' });
    }
  };

  const sorted = [...expenses].sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const thisMonth = new Date().toISOString().slice(0,7);
  const monthExp = expenses.filter((e: Expense) => e.date.startsWith(thisMonth));
  const totalMonth = monthExp.reduce((s: number, e: Expense) => s + e.amount, 0);
  const totalAllTime = expenses.reduce((s: number, e: Expense) => s + e.amount, 0);

  const getInvoiceLabel = (invoiceId: string) => {
    const inv = invoices.find((i: BillingDocument) => i.id === invoiceId);
    if (!inv) return '—';
    const client = clients.find((c: BillingClient) => c.id === inv.clientId);
    return inv.number + (client ? ' · ' + client.name : '');
  };

  const selInvoice = selected?.invoiceId ? invoices.find((i: BillingDocument) => i.id === selected.invoiceId) : null;
  const selClient = selInvoice ? clients.find((c: BillingClient) => c.id === selInvoice.clientId) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Project Costs</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Costs incurred to deliver a project — deducted from invoice profit. Auto-recorded in Working Capital.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Total this month', value: 'MK ' + totalMonth.toLocaleString(), color: 'text-destructive' },
          { label: 'Total all time', value: 'MK ' + totalAllTime.toLocaleString(), color: 'text-muted-foreground' },
          { label: 'Linked to invoices', value: expenses.filter((e: Expense) => e.invoiceId).length + ' / ' + expenses.length, color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-card border-border"><CardContent className="p-3"><div className="text-xs text-muted-foreground mb-1">{label}</div><div className={`text-lg font-semibold ${color}`}>{value}</div></CardContent></Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{expenses.length} cost{expenses.length !== 1 ? 's' : ''} recorded</div>
        <Button size="sm" onClick={() => { reset(); setShowForm(true); }} className="gap-1"><Plus className="w-3.5 h-3.5" />Add Project Cost</Button>
      </div>

      {/* Form */}
      {(showForm || editingExpense) && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">{editingExpense ? 'Edit Project Cost' : 'New Project Cost'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Link to Invoice *</Label>
                <Select value={form.invoiceId} onValueChange={handleInvoiceSelect}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue placeholder="Select invoice..." /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {invoices.map((inv: BillingDocument) => {
                      const client = clients.find((c: BillingClient) => c.id === inv.clientId);
                      return <SelectItem key={inv.id} value={inv.id}>{inv.number} · {client?.name} — {fmtAmt(inv.total, inv.currency)}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1"><Label className="text-xs">Description *</Label><Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="e.g. Printing — brand guide" className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v as ExpenseCategory}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({...p, currency: v as BillingCurrency}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-2 bg-primary/5 border border-primary/20 rounded text-xs text-muted-foreground">This cost will be automatically recorded as a project expense outflow in Working Capital.</div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
              <Button size="sm" onClick={save}>{editingExpense ? 'Update' : 'Record Cost'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Card className="bg-card border-border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e: Expense) => (
                  <tr key={e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)}
                    className={`border-b border-border cursor-pointer transition-colors hover:bg-secondary/30 ${selected?.id === e.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.date}</td>
                    <td className="px-4 py-3 text-sm font-medium truncate max-w-[180px]">{e.description}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.invoiceId ? getInvoiceLabel(e.invoiceId) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[e.category] || 'bg-gray-400'}`} />
                        <span className="text-xs text-muted-foreground">{e.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-destructive">{fmtAmt(e.amount, e.currency)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No project costs recorded yet</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="w-64 flex-shrink-0">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm leading-tight">{selected.description}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{selected.date}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-destructive">{fmtAmt(selected.amount, selected.currency)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Category</span>
                    <div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[selected.category]}`} /><span>{selected.category}</span></div>
                  </div>
                  {selClient && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Client</span><span>{selClient.name}</span></div>}
                  {selected.projectName && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Project</span><span>{selected.projectName}</span></div>}
                  {selInvoice && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Invoice</span><span className="font-mono text-primary">{selInvoice.number}</span></div>}
                  <div className="text-[10px] text-primary bg-primary/5 rounded p-1.5 text-center">Auto-recorded in Working Capital</div>
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start" variant="outline" onClick={() => startEdit(selected)}><Edit2 className="w-3 h-3" />Edit</Button>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5 justify-start text-destructive border-destructive/30" variant="outline" onClick={() => del(selected.id)}><Trash2 className="w-3 h-3" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Retainer / Deposit View ─────────────────────────────────────────────────

function RetainerView({ invoices, clients, billing, dispatch, toast }: any) {
  const [payingInvoice, setPayingInvoice] = useState<BillingDocument | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', currency: 'MWK' as BillingCurrency, exchangeRate: '1', method: 'Bank Transfer', reference: '', date: new Date().toISOString().slice(0,10) });

  // Only show invoices with partial payments or no payments (active retainer/deposit situations)
  const activeInvoices = invoices.filter((i: BillingDocument) => i.status !== 'paid');

  const getClient = (id: string) => clients.find((c: BillingClient) => c.id === id);
  const avatarColors = ['bg-primary/20 text-primary','bg-blue-500/20 text-blue-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
  const avatarColor = (id: string) => avatarColors[id?.charCodeAt(0) % avatarColors.length] || avatarColors[0];
  const initials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || '?';

  const recordPayment = () => {
    if (!payingInvoice) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const rate = parseFloat(payForm.exchangeRate) || 1;
    const payment: BillingPayment = { id: genId(), date: payForm.date, amount, currency: payForm.currency, mwkEquivalent: payForm.currency === 'MWK' ? amount : Math.round(amount * rate), exchangeRate: rate, method: payForm.method, reference: payForm.reference || undefined };
    dispatch({ type: 'BILLING_ADD_PAYMENT', payload: { documentId: payingInvoice.id, payment } });
    const allPayments = [...payingInvoice.payments, payment];
    const totalPaidNow = allPayments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
    const isFullyPaid = totalPaidNow >= payingInvoice.total;
    const paymentStatus = isFullyPaid ? 'Paid in full' : 'Partial payment';

    // ── Auto WC inflow ──
    const retWcClient = clients.find((c: BillingClient) => c.id === payingInvoice.clientId);
    dispatch({ type: 'ADD_WC_TRANSACTION', payload: { id: 'wc-' + genId(), date: payment.date, type: 'inflow', category: 'client_payment', amount: payment.mwkEquivalent, description: (retWcClient?.name || 'Client') + ' — ' + payingInvoice.number + (payment.reference ? ' · ' + payment.reference : ''), reference: payment.reference, balanceAfter: 0, autoGenerated: true } });

    const existingReceipt = billing.documents.find((d: BillingDocument) => d.type === 'receipt' && (d as any).sourceInvoiceId === payingInvoice.id);
    if (existingReceipt) {
      dispatch({ type: 'BILLING_UPDATE_DOCUMENT', payload: { ...existingReceipt, payments: allPayments, status: isFullyPaid ? ('paid' as any) : ('partial' as any), notes: `Receipt for Invoice ${payingInvoice.number} — ${paymentStatus}`, updatedAt: new Date().toISOString() } });
    } else {
      const rcpNumber = nextNumber('receipt' as DocType, billing.counters.receipt, billing.settings);
      dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: { id: genId(), type: 'receipt', number: rcpNumber, clientId: payingInvoice.clientId, projectName: (payingInvoice as any).projectName, currency: payingInvoice.currency, lineItems: payingInvoice.lineItems, subtotal: payingInvoice.subtotal, taxRate: payingInvoice.taxRate, taxAmount: payingInvoice.taxAmount, discount: payingInvoice.discount, total: payingInvoice.total, status: isFullyPaid ? ('paid' as any) : ('partial' as any), issueDate: new Date().toISOString().slice(0,10), notes: `Receipt for Invoice ${payingInvoice.number} — ${paymentStatus}`, payments: allPayments, sourceInvoiceId: payingInvoice.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    }
    toast({ title: isFullyPaid ? '✓ Fully paid — receipt generated' : '✓ Payment recorded' });
    setPayingInvoice(null);
    setPayForm({ amount: '', currency: 'MWK', exchangeRate: '1', method: 'Bank Transfer', reference: '', date: new Date().toISOString().slice(0,10) });
  };

  const sendReminder = (inv: BillingDocument) => {
    const client = getClient(inv.clientId);
    if (!client?.email) { toast({ title: 'No client email', variant: 'destructive' }); return; }
    const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
    const remaining = inv.total - paid;
    const isDeposit = paid === 0;
    const nl = '\n';
    const subj = encodeURIComponent((isDeposit ? 'Deposit Required — ' : 'Balance Due — ') + inv.number + ' · ' + billing.settings.companyName);
    const body = encodeURIComponent('Hi ' + client.name + ',' + nl + nl + (isDeposit ? 'This is a reminder that a 50% deposit of ' + fmtAmt(inv.total / 2, inv.currency) + ' is required to begin work on ' + ((inv as any).projectName || inv.number) + '.' : 'Thank you for your deposit. The remaining balance of ' + fmtAmt(remaining, inv.currency) + ' is due upon delivery of ' + ((inv as any).projectName || 'the project') + '.') + nl + nl + 'Invoice: ' + inv.number + nl + 'Total: ' + fmtAmt(inv.total, inv.currency) + nl + 'Balance Due: ' + fmtAmt(remaining, inv.currency) + nl + nl + 'Please arrange payment at your earliest convenience.' + nl + nl + billing.settings.companyName);
    window.open('mailto:' + client.email + '?subject=' + subj + '&body=' + body);
    toast({ title: 'Reminder email opened' });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Retainer & Deposit Tracking</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Track deposits and balance payments per active invoice</p>
      </div>

      {/* Payment modal */}
      {payingInvoice && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Record Payment — {payingInvoice.number}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Currency</Label>
                <Select value={payForm.currency} onValueChange={v => setPayForm(p => ({...p, currency: v as BillingCurrency}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {payForm.currency !== 'MWK' && <div className="space-y-1"><Label className="text-xs">Rate to MWK</Label><Input type="number" value={payForm.exchangeRate} onChange={e => setPayForm(p => ({...p, exchangeRate: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>}
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({...p, date: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Method</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm(p => ({...p, method: v}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{['Bank Transfer','Mobile Money','Cash','Cheque','Other'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={payForm.reference} onChange={e => setPayForm(p => ({...p, reference: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
            </div>
            {payForm.currency !== 'MWK' && payForm.amount && <div className="text-xs text-muted-foreground">MWK equivalent: <span className="font-medium">MK {Math.round(parseFloat(payForm.amount||'0') * (parseFloat(payForm.exchangeRate)||1)).toLocaleString()}</span></div>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPayingInvoice(null)}>Cancel</Button>
              <Button size="sm" onClick={recordPayment}>Record Payment</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeInvoices.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-12">
          <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No active invoices. All invoices are paid.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeInvoices.map((inv: BillingDocument) => {
            const client = getClient(inv.clientId);
            const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
            const remaining = inv.total - paid;
            const paidPct = inv.total > 0 ? Math.min(100, Math.round((paid / inv.total) * 100)) : 0;
            const depositExpected = inv.total / 2;
            const hasDeposit = paid > 0;
            const isOverdueInv = isOverdue(inv);
            const ds = getDisplayStatus(inv);

            return (
              <Card key={inv.id} className={`bg-card ${isOverdueInv ? 'border-destructive/40' : 'border-border'}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${avatarColor(inv.clientId)}`}>{initials(client?.name || '?')}</div>
                      <div>
                        <div className="font-medium text-sm">{client?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{(inv as any).projectName || inv.number}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ds === 'overdue' ? 'text-destructive bg-destructive/10' : ds === 'partial' ? 'text-amber-400 bg-amber-500/10' : 'text-muted-foreground bg-secondary/50'}`}>{ds.toUpperCase()}</span>
                  </div>

                  {/* Amounts */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/30 rounded p-2">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Invoice Total</div>
                      <div className="text-xs font-semibold">{fmtAmt(inv.total, inv.currency)}</div>
                    </div>
                    <div className={`rounded p-2 ${hasDeposit ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Paid</div>
                      <div className={`text-xs font-semibold ${hasDeposit ? 'text-primary' : 'text-amber-400'}`}>{fmtAmt(paid, inv.currency)}</div>
                    </div>
                    <div className={`rounded p-2 ${isOverdueInv ? 'bg-destructive/10' : 'bg-secondary/30'}`}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Balance Due</div>
                      <div className={`text-xs font-semibold ${isOverdueInv ? 'text-destructive' : remaining > 0 ? 'text-amber-400' : 'text-primary'}`}>{fmtAmt(remaining, inv.currency)}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{paidPct}% paid</span>
                      <span>{inv.dueDate ? 'Due ' + inv.dueDate : 'No due date'}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${paidPct >= 100 ? 'bg-primary' : paidPct >= 50 ? 'bg-primary/70' : 'bg-amber-400'}`} style={{ width: `${paidPct}%` }} />
                    </div>
                    {/* 50% deposit marker */}
                    <div className="relative h-1">
                      <div className="absolute top-0" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                        <div className="w-px h-2 bg-border" />
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground text-center mt-0.5">50% deposit = {fmtAmt(depositExpected, inv.currency)}</div>
                  </div>

                  {/* Payment history */}
                  {inv.payments.length > 0 && (
                    <div className="space-y-0.5 border-t border-border pt-2">
                      {inv.payments.map((p: BillingPayment) => (
                        <div key={p.id} className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{p.date} · {p.method}{p.reference ? ' · ' + p.reference : ''}</span>
                          <span className="text-primary">{fmtAmt(p.amount, p.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-8 gap-1" onClick={() => sendReminder(inv)}>
                      <Mail className="w-3 h-3" />{paid === 0 ? 'Request Deposit' : 'Request Balance'}
                    </Button>
                    <Button size="sm" className="flex-1 text-xs h-8 gap-1" onClick={() => setPayingInvoice(inv)}>
                      <Check className="w-3 h-3" />{paid === 0 ? 'Record Deposit' : 'Record Payment'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── Recurring Invoices View ──────────────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };
function calcNextDue(lastDate: string, freq: string): string {
  const d = new Date(lastDate);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function RecurringView({ schedules, clients, billing, dispatch, toast }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringSchedule | null>(null);
  const emptyForm = { clientId: clients[0]?.id || '', projectName: '', frequency: 'monthly' as RecurringFrequency, amount: '', currency: 'MWK' as BillingCurrency, taxRate: 0, notes: '', startDate: new Date().toISOString().slice(0,10) };
  const [form, setForm] = useState(emptyForm);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = schedules.filter((s: RecurringSchedule) => s.active && s.nextDueDate <= today);

  const getClient = (id: string) => clients.find((c: BillingClient) => c.id === id);
  const avatarColors = ['bg-primary/20 text-primary','bg-blue-500/20 text-blue-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
  const avatarColor = (id: string) => avatarColors[id?.charCodeAt(0) % avatarColors.length] || avatarColors[0];
  const initials = (name: string) => name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || '?';

  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const reset = () => { setForm(emptyForm); setEditing(null); setShowForm(false); };

  const save = () => {
    if (!form.clientId) { toast({ title: 'Select a client', variant: 'destructive' }); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const amt = parseFloat(form.amount);
    const subtotal = amt;
    const taxAmt = Math.round(subtotal * form.taxRate / 100);
    const total = subtotal + taxAmt;
    if (editing) {
      dispatch({ type: 'RECURRING_UPDATE', payload: { ...editing, ...form, amount: total, taxRate: form.taxRate, nextDueDate: calcNextDue(editing.lastGeneratedDate || editing.startDate, form.frequency) } });
      toast({ title: '✓ Schedule updated' });
    } else {
      const schedule: RecurringSchedule = { id: genId(), ...form, amount: total, taxRate: form.taxRate, lineItems: [{ id: genId(), description: form.projectName || 'Services', qty: 1, unitPrice: total, total }], nextDueDate: form.startDate, active: true, generatedCount: 0, createdAt: new Date().toISOString() };
      dispatch({ type: 'RECURRING_ADD', payload: schedule });
      toast({ title: '✓ Recurring schedule created' });
    }
    reset();
  };

  const toggle = (s: RecurringSchedule) => {
    dispatch({ type: 'RECURRING_UPDATE', payload: { ...s, active: !s.active } });
    toast({ title: s.active ? 'Schedule paused' : 'Schedule resumed' });
  };

  const del = (id: string) => { if (confirm('Delete schedule?')) { dispatch({ type: 'RECURRING_DELETE', payload: id }); toast({ title: 'Deleted' }); }};

  const generate = (s: RecurringSchedule) => {
    const invNumber = nextNumber('invoice', billing.counters.invoice, billing.settings);
    const invoice: BillingDocument = {
      id: genId(), type: 'invoice', number: invNumber, clientId: s.clientId,
      projectName: s.projectName, currency: s.currency, lineItems: s.lineItems,
      subtotal: s.amount, taxRate: s.taxRate, taxAmount: Math.round(s.amount * s.taxRate / 100),
      discount: 0, total: s.amount, status: 'draft',
      issueDate: new Date().toISOString().slice(0,10),
      dueDate: new Date(Date.now() + billing.settings.defaultPaymentTerms * 86400000).toISOString().slice(0,10),
      notes: s.notes || billing.settings.invoiceNotes,
      payments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'BILLING_ADD_DOCUMENT', payload: invoice });
    const newNext = calcNextDue(today, s.frequency);
    dispatch({ type: 'RECURRING_UPDATE', payload: { ...s, lastGeneratedDate: today, nextDueDate: newNext, generatedCount: s.generatedCount + 1 } });
    toast({ title: '✓ Invoice generated', description: invNumber + ' created as draft' });
  };

  return (
    <div className="space-y-4">
      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
          <div className="text-xs text-amber-400 font-medium">
            {overdue.length} recurring invoice{overdue.length !== 1 ? 's are' : ' is'} due to be generated
          </div>
          <div className="flex gap-2">
            {overdue.map((s: RecurringSchedule) => {
              const client = getClient(s.clientId);
              return (
                <Button key={s.id} size="sm" variant="outline" className="text-xs h-7 gap-1 border-amber-500/30 text-amber-400" onClick={() => generate(s)}>
                  <RefreshCw className="w-3 h-3" />{client?.name} — Generate
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{schedules.length} schedule{schedules.length !== 1 ? 's' : ''}</div>
        <Button size="sm" onClick={() => { reset(); setShowForm(true); }} className="gap-1" disabled={clients.length === 0}><Plus className="w-3.5 h-3.5" />New Schedule</Button>
      </div>
      {clients.length === 0 && <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">Add a client first.</div>}

      {(showForm || editing) && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3"><CardTitle className="text-sm">{editing ? 'Edit Schedule' : 'New Recurring Schedule'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Client *</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({...p, clientId: v}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{clients.map((c: BillingClient) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(p => ({...p, frequency: v as RecurringFrequency}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {(['weekly','monthly','quarterly','annually'] as RecurringFrequency[]).map(f => <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Project / Description</Label><Input value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} placeholder="e.g. Monthly Brand Management" className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} className="bg-secondary border-input h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({...p, currency: v as BillingCurrency}))}>
                  <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
              <Button size="sm" onClick={save}>{editing ? 'Update' : 'Create Schedule'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {schedules.length === 0 && !showForm ? (
        <div className="text-center text-muted-foreground text-sm py-12"><RefreshCw className="w-8 h-8 mx-auto mb-3 opacity-30" /><p>No recurring schedules. Set one up to auto-generate invoices.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((s: RecurringSchedule) => {
            const client = getClient(s.clientId);
            const days = daysUntil(s.nextDueDate);
            const isOverdueSchedule = s.active && days <= 0;
            const isDueSoon = s.active && days > 0 && days <= 7;
            return (
              <Card key={s.id} className={`bg-card ${!s.active ? 'opacity-60' : isOverdueSchedule ? 'border-amber-500/40' : 'border-border'}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${avatarColor(s.clientId)}`}>{initials(client?.name || '?')}</div>
                      <div>
                        <div className="font-medium text-sm">{client?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{s.projectName || 'Recurring invoice'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/10 text-purple-400">{FREQ_LABELS[s.frequency]}</span>
                      <button onClick={() => toggle(s)}
                        className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${s.active ? 'bg-primary' : 'bg-secondary'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${s.active ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/30 rounded p-2">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Amount</div>
                      <div className="text-xs font-semibold">{fmtAmt(s.amount, s.currency)}</div>
                    </div>
                    <div className="bg-secondary/30 rounded p-2">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Generated</div>
                      <div className="text-xs font-semibold">{s.generatedCount} invoice{s.generatedCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div className={`rounded p-2 ${isOverdueSchedule ? 'bg-amber-500/10' : isDueSoon ? 'bg-amber-500/5' : 'bg-secondary/30'}`}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Next Due</div>
                      <div className={`text-xs font-semibold ${isOverdueSchedule ? 'text-amber-400' : isDueSoon ? 'text-amber-400' : ''}`}>
                        {!s.active ? 'Paused' : isOverdueSchedule ? 'Now!' : days === 0 ? 'Today' : days + 'd'}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Next: {s.nextDueDate}{s.lastGeneratedDate ? ' · Last: ' + s.lastGeneratedDate : ''}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => { setEditing(s); setForm({ clientId: s.clientId, projectName: s.projectName || '', frequency: s.frequency, amount: String(s.amount), currency: s.currency, taxRate: s.taxRate, notes: s.notes || '', startDate: s.startDate }); setShowForm(true); }}><Edit2 className="w-3 h-3" />Edit</Button>
                    <Button size="sm" variant="outline" className={`text-xs h-7 gap-1 flex-1 ${isOverdueSchedule ? 'text-amber-400 border-amber-500/40' : ''}`} onClick={() => generate(s)} disabled={!s.active}><RefreshCw className="w-3 h-3" />Generate Invoice</Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => del(s.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tax Summary Report ───────────────────────────────────────────────────────

function TaxReportView({ invoices, clients, billing, expenses }: any) {
  const [period, setPeriod] = useState<'q1' | 'q2' | 'q3' | 'q4' | 'year' | 'all'>('year');
  const [reportTab, setReportTab] = useState<'summary' | 'monthly' | 'invoices'>('summary');
  const currentYear = new Date().getFullYear();

  const inPeriod = (date: string) => {
    if (period === 'all') return true;
    if (period === 'year') return date.startsWith(String(currentYear));
    const m = parseInt(date.slice(5, 7));
    if (period === 'q1') return date.startsWith(String(currentYear)) && m <= 3;
    if (period === 'q2') return date.startsWith(String(currentYear)) && m >= 4 && m <= 6;
    if (period === 'q3') return date.startsWith(String(currentYear)) && m >= 7 && m <= 9;
    if (period === 'q4') return date.startsWith(String(currentYear)) && m >= 10;
    return false;
  };

  const periodInvoices = invoices.filter((i: BillingDocument) => inPeriod(i.issueDate));
  const periodExpenses = (expenses || []).filter((e: any) => inPeriod(e.date));

  // WC overhead = non-project outflows from Working Capital (bills, subscriptions, etc.)
  const wcTransactions = billing?.wcTransactions || [];
  const OVERHEAD_CATS = ['bill', 'subscription', 'transport', 'marketing', 'training', 'other', 'salary', 'payroll'];
  const periodOverhead = wcTransactions.filter((t: any) =>
    t.type === 'outflow' &&
    OVERHEAD_CATS.includes(t.category) &&
    inPeriod(t.date)
  ).reduce((s: number, t: any) => s + t.amount, 0);

  const totalRevenue    = periodInvoices.reduce((s: number, i: BillingDocument) => s + i.subtotal, 0);
  const totalTax        = periodInvoices.reduce((s: number, i: BillingDocument) => s + i.taxAmount, 0);
  const totalReceived   = periodInvoices.reduce((s: number, i: BillingDocument) => s + i.payments.reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0), 0);
  const totalOutstanding = periodInvoices.reduce((s: number, i: BillingDocument) => {
    const paid = i.payments.reduce((ps: number, p: BillingPayment) => ps + p.amount, 0);
    return s + Math.max(0, i.total - paid);
  }, 0);
  const totalProjectCosts = periodExpenses.reduce((s: number, e: any) => s + e.amount, 0);
  const totalExpenses   = totalProjectCosts + periodOverhead;
  const netProfit       = totalReceived - totalExpenses;
  const profitMargin    = totalReceived > 0 ? Math.round((netProfit / totalReceived) * 100) : 0;

  // Revenue by currency
  const byCurrency: Record<string, number> = {};
  periodInvoices.forEach((inv: BillingDocument) => {
    byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + inv.total;
  });

  // Monthly breakdown — build month buckets for the selected period
  const getMonthsInPeriod = (): string[] => {
    if (period === 'all') {
      const allDates = [
        ...invoices.map((i: BillingDocument) => i.issueDate.slice(0,7)),
        ...(expenses || []).map((e: any) => e.date.slice(0,7)),
      ];
      if (allDates.length === 0) return [];
      const min = allDates.reduce((a, b) => a < b ? a : b);
      const max = allDates.reduce((a, b) => a > b ? a : b);
      const months: string[] = [];
      let cur = min;
      while (cur <= max) {
        months.push(cur);
        const [y, m] = cur.split('-').map(Number);
        const next = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
        cur = next;
      }
      return months.reverse();
    }
    const year = String(currentYear);
    const ranges: Record<string, number[]> = { q1:[1,2,3], q2:[4,5,6], q3:[7,8,9], q4:[10,11,12], year:[1,2,3,4,5,6,7,8,9,10,11,12] };
    return (ranges[period] || []).map(m => year + '-' + String(m).padStart(2,'0')).reverse();
  };

  const MONTH_NAMES: Record<string, string> = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };

  const monthlyData = getMonthsInPeriod().map(ym => {
    const [y, m] = ym.split('-');
    const mInvoices = periodInvoices.filter((i: BillingDocument) => i.issueDate.startsWith(ym));
    const mExpenses = periodExpenses.filter((e: any) => e.date.startsWith(ym));
    const revenue   = mInvoices.reduce((s: number, i: BillingDocument) => s + i.subtotal, 0);
    const received  = mInvoices.reduce((s: number, i: BillingDocument) => s + i.payments.reduce((ps: number, p: BillingPayment) => ps + p.mwkEquivalent, 0), 0);
    const expTotal  = mExpenses.reduce((s: number, e: any) => s + e.amount, 0);
    const profit    = received - expTotal;
    return { ym, label: MONTH_NAMES[m] + ' ' + y, revenue, received, expenses: expTotal, profit, invoiceCount: mInvoices.length, expenseCount: mExpenses.length };
  });

  const periodLabels: Record<string, string> = {
    q1: `Q1 ${currentYear} (Jan–Mar)`, q2: `Q2 ${currentYear} (Apr–Jun)`,
    q3: `Q3 ${currentYear} (Jul–Sep)`, q4: `Q4 ${currentYear} (Oct–Dec)`,
    year: `Full Year ${currentYear}`, all: 'All Time',
  };

  const exportPDF = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210; const M = 18; let y = 20;
    pdf.setFillColor('#FFFFFF'); pdf.rect(0, 0, W, 297, 'F');
    pdf.setFontSize(18); pdf.setFont('helvetica','bold'); pdf.setTextColor('#000000');
    pdf.text('Financial Report', M, y); y += 7;
    pdf.setFontSize(10); pdf.setFont('helvetica','normal'); pdf.setTextColor('#666666');
    pdf.text(billing.settings.companyName + ' · ' + periodLabels[period], M, y); y += 5;
    pdf.text('Generated: ' + new Date().toLocaleDateString('en-GB'), M, y); y += 9;
    pdf.setDrawColor('#CCCCCC'); pdf.line(M, y, W-M, y); y += 7;
    pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor('#000000');
    [['Total Revenue (invoiced)', 'MK ' + totalRevenue.toLocaleString()],
     ['Total Received (cash)', 'MK ' + totalReceived.toLocaleString()],
     ['Total Expenses', 'MK ' + totalExpenses.toLocaleString()],
     ['Net Profit / Loss', (netProfit >= 0 ? '+' : '') + 'MK ' + netProfit.toLocaleString()],
     ['Profit Margin', profitMargin + '%'],
     ['Tax Collected', 'MK ' + totalTax.toLocaleString()],
     ['Outstanding', 'MK ' + totalOutstanding.toLocaleString()],
    ].forEach(([lbl, val]) => { pdf.setFont('helvetica','normal'); pdf.text(lbl + ':', M, y); pdf.setFont('helvetica','bold'); pdf.text(val, W-M, y, { align:'right' }); y += 6; });
    y += 4; pdf.setDrawColor('#CCCCCC'); pdf.line(M, y, W-M, y); y += 8;
    if (monthlyData.length > 0) {
      pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.text('Monthly Breakdown', M, y); y += 6;
      pdf.setFontSize(9); pdf.setFont('helvetica','bold');
      ['Month','Revenue','Received','Expenses','Profit / Loss'].forEach((h,i) => { pdf.text(h, [M,M+35,M+75,M+115,M+150][i], y); }); y += 4;
      pdf.line(M, y, W-M, y); y += 4;
      pdf.setFont('helvetica','normal');
      monthlyData.forEach(row => {
        if (y > 272) { pdf.addPage(); y = 18; }
        const pl = (row.profit >= 0 ? '+' : '') + 'MK ' + row.profit.toLocaleString();
        [row.label, 'MK ' + row.revenue.toLocaleString(), 'MK ' + row.received.toLocaleString(), 'MK ' + row.expenses.toLocaleString(), pl].forEach((v,i) => {
          if (i === 4) { pdf.setTextColor(row.profit >= 0 ? '#15803d' : '#b91c1c'); }
          pdf.text(v, [M,M+35,M+75,M+115,M+150][i], y);
          pdf.setTextColor('#000000');
        });
        y += 5;
      });
      y += 4; pdf.line(M, y, W-M, y); y += 4;
      pdf.setFont('helvetica','bold');
      const totPl = (netProfit >= 0 ? '+' : '') + 'MK ' + netProfit.toLocaleString();
      ['TOTAL', 'MK '+totalRevenue.toLocaleString(), 'MK '+totalReceived.toLocaleString(), 'MK '+totalExpenses.toLocaleString(), totPl].forEach((v,i) => {
        if (i === 4) pdf.setTextColor(netProfit >= 0 ? '#15803d' : '#b91c1c');
        pdf.text(v, [M,M+35,M+75,M+115,M+150][i], y);
        pdf.setTextColor('#000000');
      });
    }
    pdf.save('financial-report-' + period + '-' + currentYear + '.pdf');
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-medium">Financial Report</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue, expenses, profit/loss and tax</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 bg-secondary/30 p-0.5 rounded-md">
            {(['q1','q2','q3','q4','year','all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {p === 'year' ? String(currentYear) : p === 'all' ? 'All' : p.toUpperCase()}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={exportPDF}><FileText className="w-3.5 h-3.5" />Export PDF</Button>
        </div>
      </div>

      {/* Profit / Loss hero card */}
      <Card className={`border ${netProfit >= 0 ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Net {netProfit >= 0 ? 'Profit' : 'Loss'} — {periodLabels[period]}</div>
            <div className={`text-3xl font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {netProfit >= 0 ? '+' : ''}MK {Math.abs(netProfit).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {profitMargin >= 0 ? profitMargin : 0}% margin · MK {totalReceived.toLocaleString()} received − MK {totalExpenses.toLocaleString()} expenses
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Revenue', value: 'MK ' + totalRevenue.toLocaleString(), color: 'text-foreground' },
              { label: 'Received', value: 'MK ' + totalReceived.toLocaleString(), color: 'text-primary' },
              { label: 'Expenses', value: 'MK ' + totalExpenses.toLocaleString(), color: 'text-destructive' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                <div className={`text-sm font-semibold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tax Collected', value: 'MK ' + totalTax.toLocaleString(), color: totalTax > 0 ? 'text-amber-400' : 'text-muted-foreground' },
          { label: 'Outstanding', value: 'MK ' + totalOutstanding.toLocaleString(), color: totalOutstanding > 0 ? 'text-amber-400' : 'text-muted-foreground' },
          { label: 'Project Costs', value: 'MK ' + totalProjectCosts.toLocaleString(), color: 'text-destructive' },
          { label: 'Overhead (WC)', value: 'MK ' + periodOverhead.toLocaleString(), color: 'text-destructive' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-card border-border"><CardContent className="p-3"><div className="text-xs text-muted-foreground mb-1">{label}</div><div className={`text-lg font-semibold ${color}`}>{value}</div></CardContent></Card>
        ))}
      </div>

      {/* Report tabs */}
      <div className="flex gap-1 bg-secondary/30 p-0.5 rounded-md w-fit">
        {([['summary','Summary'],['monthly','Monthly P&L'],['invoices','Invoice Breakdown']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setReportTab(t)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${reportTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary tab — currency breakdown */}
      {reportTab === 'summary' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {CURRENCIES.map((cur: BillingCurrency) => (
              <Card key={cur} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">{cur} Revenue</div>
                  <div className="text-base font-semibold">{cur === 'MWK' ? 'MK' : cur === 'USD' ? '$' : 'R'} {(byCurrency[cur] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{periodInvoices.filter((i: BillingDocument) => i.currency === cur).length} invoice{periodInvoices.filter((i: BillingDocument) => i.currency === cur).length !== 1 ? 's' : ''}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Monthly P&L tab */}
      {reportTab === 'monthly' && (
        <Card className="bg-card border-border overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Month</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Received</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Expenses</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Profit / Loss</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Margin</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.filter(r => r.revenue > 0 || r.expenses > 0).map(row => {
                const margin = row.received > 0 ? Math.round((row.profit / row.received) * 100) : 0;
                return (
                  <tr key={row.ym} className="border-b border-border hover:bg-secondary/20">
                    <td className="px-4 py-3 text-sm font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-right text-xs">MK {row.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-primary font-medium">MK {row.received.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-destructive">MK {row.expenses.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right text-xs font-semibold ${row.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {row.profit >= 0 ? '+' : ''}MK {row.profit.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${margin >= 50 ? 'text-primary' : margin >= 20 ? 'text-amber-400' : 'text-destructive'}`}>{margin}%</td>
                  </tr>
                );
              })}
              {monthlyData.filter(r => r.revenue > 0 || r.expenses > 0).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No data for this period</td></tr>
              )}
              {monthlyData.filter(r => r.revenue > 0 || r.expenses > 0).length > 0 && (
                <tr className="border-t-2 border-border bg-secondary/20 font-medium">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">TOTAL</td>
                  <td className="px-4 py-2.5 text-right text-xs font-semibold">MK {totalRevenue.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-primary font-semibold">MK {totalReceived.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-destructive font-semibold">MK {totalExpenses.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right text-xs font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{netProfit >= 0 ? '+' : ''}MK {netProfit.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right text-xs font-semibold ${profitMargin >= 50 ? 'text-primary' : profitMargin >= 20 ? 'text-amber-400' : 'text-destructive'}`}>{profitMargin}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Invoice breakdown tab */}
      {reportTab === 'invoices' && (
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{periodLabels[period]} · {periodInvoices.length} invoices</div>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Tax</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Received</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {periodInvoices.map((inv: BillingDocument) => {
                const client = clients.find((c: BillingClient) => c.id === inv.clientId);
                const paid = inv.payments.reduce((s: number, p: BillingPayment) => s + p.amount, 0);
                const remaining = inv.total - paid;
                const ds = getDisplayStatus(inv);
                return (
                  <tr key={inv.id} className="border-b border-border hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{inv.number}</td>
                    <td className="px-4 py-2.5 text-sm">{client?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{inv.issueDate}</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(ds)}`}>{ds.toUpperCase()}</span></td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium">{fmtAmt(inv.subtotal, inv.currency)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{inv.taxRate > 0 ? fmtAmt(inv.taxAmount, inv.currency) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-primary font-medium">{fmtAmt(paid, inv.currency)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-semibold ${remaining > 0 ? (ds === 'overdue' ? 'text-destructive' : 'text-amber-400') : 'text-muted-foreground'}`}>{fmtAmt(remaining, inv.currency)}</td>
                  </tr>
                );
              })}
              {periodInvoices.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No invoices for this period</td></tr>}
              {periodInvoices.length > 0 && (
                <tr className="border-t-2 border-border bg-secondary/20 font-medium">
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-muted-foreground">TOTAL</td>
                  <td className="px-4 py-2.5 text-right text-xs font-semibold">MK {totalRevenue.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-xs">MK {totalTax.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-primary font-semibold">MK {totalReceived.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right text-xs font-semibold ${totalOutstanding > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>MK {totalOutstanding.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
