import { useMemo, useState, useCallback } from 'react';
import { Download, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

interface PaymentRow {
  id: string;
  date: string;
  invoiceNumber: string;
  client: string;
  method: string;
  mwk: number;
}

interface CostRow {
  id: string;
  date: string;
  description: string;
  project: string;
  category: string;
  mwk: number;
}

export function MonthlySummary() {
  const { state, formatCurrency } = useApp();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const billing = state.billing;
  const documents: any[] = billing?.documents || [];
  const clients: any[] = billing?.clients || [];
  const expenses: any[] = billing?.expenses || [];

  // All payments recorded against invoices (receipts are copies, so invoices only)
  const allPayments = useMemo<PaymentRow[]>(() => {
    const rows: PaymentRow[] = [];
    documents.filter(d => d.type === 'invoice').forEach(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      (inv.payments || []).forEach((p: any) => {
        rows.push({
          id: p.id,
          date: p.date,
          invoiceNumber: inv.number,
          client: client?.name || '—',
          method: p.method || '—',
          mwk: p.mwkEquivalent || p.amount || 0,
        });
      });
    });
    return rows;
  }, [documents, clients]);

  // Project costs (contractors, assets, printing...) converted to MWK via the linked invoice's rate
  const allCosts = useMemo<CostRow[]>(() => expenses.map(e => {
    const inv = documents.find(d => d.id === e.invoiceId);
    const rate = e.currency === 'MWK' ? 1 : (inv?.exchangeRate || 1);
    return {
      id: e.id,
      date: e.date,
      description: e.description,
      project: e.projectName || inv?.number || '—',
      category: e.category,
      mwk: Math.round((e.amount || 0) * rate),
    };
  }), [expenses, documents]);

  const payments = allPayments.filter(p => p.date?.startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date));
  const costs = allCosts.filter(c => c.date?.startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date));

  const invoicedThisMonth = documents
    .filter(d => d.type === 'invoice' && (d.issueDate || '').startsWith(selectedMonth))
    .reduce((s, d) => s + d.total * (d.exchangeRate || 1), 0);

  const received = payments.reduce((s, p) => s + p.mwk, 0);
  const totalCosts = costs.reduce((s, c) => s + c.mwk, 0);
  const contractorCosts = costs.filter(c => c.category === 'Contractor').reduce((s, c) => s + c.mwk, 0);
  const afterCosts = received - totalCosts;

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allPayments.forEach(p => p.date && set.add(p.date.slice(0, 7)));
    allCosts.forEach(c => c.date && set.add(c.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [allPayments, allCosts]);

  const monthName = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const exportCSV = useCallback(() => {
    if (payments.length === 0 && costs.length === 0) { toast({ title: 'Nothing to export', variant: 'destructive' }); return; }
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`Monthly Summary,${q(monthName)}`);
    lines.push('');
    lines.push('PAYMENTS RECEIVED');
    lines.push(['Date', 'Invoice', 'Client', 'Method', 'Amount (MWK)'].map(q).join(','));
    payments.forEach(p => lines.push([p.date, p.invoiceNumber, p.client, p.method, p.mwk].map(q).join(',')));
    lines.push(['', '', '', 'Total', received].map(q).join(','));
    lines.push('');
    lines.push('PROJECT COSTS');
    lines.push(['Date', 'Description', 'Project', 'Category', 'Amount (MWK)'].map(q).join(','));
    costs.forEach(c => lines.push([c.date, c.description, c.project, c.category, c.mwk].map(q).join(',')));
    lines.push(['', '', '', 'Total', totalCosts].map(q).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `inspirex-summary-${selectedMonth}.csv`;
    a.click();
    toast({ title: 'Exported' });
  }, [payments, costs, received, totalCosts, monthName, selectedMonth, toast]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monthly Summary</h1>
          <p className="text-muted-foreground text-sm mt-1">Money received and project costs by month</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="no-print">
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Month Selector */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Label className="text-sm whitespace-nowrap">Select Month:</Label>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="w-full sm:w-48 bg-secondary border-input" />
            {availableMonths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableMonths.slice(0, 6).map(m => (
                  <Button key={m} variant={m === selectedMonth ? 'default' : 'outline'} size="sm"
                    onClick={() => setSelectedMonth(m)} className="text-xs">{m}</Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-xl font-medium">{monthName}</div>

      {payments.length === 0 && costs.length === 0 && invoicedThisMonth === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nothing recorded for this month.</p>
            <p className="text-sm mt-1">Record invoice payments and project costs in Billing.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-primary/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase">Received</div>
                <div className="text-xl font-semibold mt-1 text-primary">{formatCurrency(received)}</div>
                <div className="text-xs text-muted-foreground mt-1">100% to Retained Profit</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase">Invoiced</div>
                <div className="text-xl font-semibold mt-1 text-blue-400">{formatCurrency(Math.round(invoicedThisMonth))}</div>
                <div className="text-xs text-muted-foreground mt-1">Issued this month</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase">Project Costs</div>
                <div className="text-xl font-semibold mt-1 text-amber-400">{formatCurrency(totalCosts)}</div>
                <div className="text-xs text-muted-foreground mt-1">Contractors: {formatCurrency(contractorCosts)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase">Received − Costs</div>
                <div className={`text-xl font-semibold mt-1 ${afterCosts < 0 ? 'text-destructive' : 'text-foreground'}`}>{formatCurrency(afterCosts)}</div>
                <div className="text-xs text-muted-foreground mt-1">For reference only</div>
              </CardContent>
            </Card>
          </div>

          {/* Payments */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payments Received ({payments.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="text-sm text-muted-foreground italic text-center py-6">No payments this month</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Date', 'Invoice', 'Client', 'Method'].map(h => (
                          <th key={h} className="text-left py-2 px-4 text-xs font-medium text-muted-foreground uppercase">{h}</th>
                        ))}
                        <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-b border-border/40">
                          <td className="py-2 px-4 text-muted-foreground">{p.date}</td>
                          <td className="py-2 px-4 font-medium">{p.invoiceNumber}</td>
                          <td className="py-2 px-4">{p.client}</td>
                          <td className="py-2 px-4 text-muted-foreground">{p.method}</td>
                          <td className="py-2 px-4 text-right font-semibold tabular-nums text-primary">{formatCurrency(p.mwk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Costs */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Project Costs ({costs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {costs.length === 0 ? (
                <div className="text-sm text-muted-foreground italic text-center py-6">No project costs this month</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Date', 'Description', 'Project', 'Category'].map(h => (
                          <th key={h} className="text-left py-2 px-4 text-xs font-medium text-muted-foreground uppercase">{h}</th>
                        ))}
                        <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costs.map(c => (
                        <tr key={c.id} className="border-b border-border/40">
                          <td className="py-2 px-4 text-muted-foreground">{c.date}</td>
                          <td className="py-2 px-4 font-medium">{c.description}</td>
                          <td className="py-2 px-4">{c.project}</td>
                          <td className="py-2 px-4 text-muted-foreground">{c.category}</td>
                          <td className="py-2 px-4 text-right font-semibold tabular-nums text-amber-400">{formatCurrency(c.mwk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
