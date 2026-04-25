import { useState, useCallback, useMemo } from 'react';
import { Save, Download, Trash2, History, Copy, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import type { ProjectDistribution, Project, TeamMember } from '@/types';

export function ProjectCalculator() {
  const { state, dispatch, formatCurrency, getActiveMembers } = useApp();
  const { toast } = useToast();

  const activeMembers = getActiveMembers();
  const { revenueSplit } = state.settings;

  const [projectName, setProjectName] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [linkedInvoiceId, setLinkedInvoiceId] = useState('');
  const [revenue, setRevenue] = useState('');
  const [directExpenses, setDirectExpenses] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(true);

  // Billing data
  const billingInvoices = (state.billing?.documents || []).filter((d: any) => d.type === 'invoice');
  const billingClients = state.billing?.clients || [];
  const billingExpenses = state.billing?.expenses || [];

  // When invoice selected — auto-fill revenue, client, project name
  const handleInvoiceLink = (invoiceId: string) => {
    if (!invoiceId || invoiceId === '__none') { setLinkedInvoiceId(''); setRevenue(''); setProjectName(''); return; }
    setLinkedInvoiceId(invoiceId);
    const inv = billingInvoices.find((i: any) => i.id === invoiceId);
    if (!inv) return;
    setRevenue(String(Math.round(inv.total * (inv.exchangeRate || 1))));
    const autoName = inv.projectName
      || (inv.lineItems?.[0]?.description?.split('\n')[0]?.trim())
      || inv.number
      || '';
    setProjectName(autoName);
    const linked = billingExpenses.filter((e: any) => e.invoiceId === invoiceId);
    const totalCosts = linked.reduce((s: number, e: any) => s + e.amount, 0);
    setDirectExpenses(totalCosts > 0 ? String(totalCosts) : '');
  };

  const calculations = useMemo(() => {
    const rev = parseFloat(revenue) || 0;
    const exp = parseFloat(directExpenses) || 0;
    const grossProfit = Math.max(0, rev - exp);
    const bonusPool = grossProfit * ((revenueSplit.bonusPercent ?? 40) / 100);
    const companyContribution = grossProfit * ((revenueSplit.companyPercent ?? 60) / 100);
    return { rev, exp, grossProfit, bonusPool, companyContribution };
  }, [revenue, directExpenses, revenueSplit]);

  const saveProject = useCallback(() => {
    const resolvedName = projectName.trim() || (() => {
      const inv = billingInvoices.find((i: any) => i.id === linkedInvoiceId);
      return inv?.projectName || inv?.number || '';
    })();
    if (!resolvedName) {
      toast({ title: 'Error', description: 'Enter a project name or link to an invoice', variant: 'destructive' });
      return;
    }
    if (calculations.rev === 0) {
      toast({ title: 'Error', description: 'Please enter revenue for this client project', variant: 'destructive' });
      return;
    }

    const linkedInv = billingInvoices.find((i: any) => i.id === linkedInvoiceId);
    const linkedClient = linkedInv ? billingClients.find((c: any) => c.id === linkedInv.clientId) : null;

    const newProject: Project = {
      id: Date.now().toString(),
      name: resolvedName,
      type: 'client',
      month,
      revenue: calculations.rev,
      directExpenses: calculations.exp,
      netProfit: calculations.grossProfit,
      bonusPool: calculations.bonusPool,
      companyContribution: calculations.companyContribution,
      distribution: [],          // populated by Tasks & Scoring → SAVE_PROJECT_SCORES
      createdAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
      payments: [],
      billingInvoiceId: linkedInvoiceId || undefined,
      billingClientId: linkedClient?.id || undefined,
      paymentStatus: 'projected',
      paidAmount: linkedInv ? linkedInv.payments.reduce((s: number, p: any) => s + p.mwkEquivalent, 0) : 0,
      tasks: [],
    };

    dispatch({ type: 'ADD_PROJECT', payload: newProject });

    // Retroactively accrue retained profit for payments already on the linked invoice
    if (linkedInv && linkedInv.payments?.length > 0 && calculations.rev > 0) {
      const costsRatio = calculations.exp / calculations.rev;
      const companyPct = (state.settings.revenueSplit?.companyPercent ?? 60) / 100;
      linkedInv.payments.forEach((p: any) => {
        const mwkAmt = p.mwkEquivalent || p.amount || 0;
        const companyPortion = Math.round(mwkAmt * (1 - costsRatio) * companyPct);
        if (companyPortion > 0) {
          dispatch({ type: 'ADD_RETAINED_PROFIT', payload: companyPortion });
        }
      });
    }

    // Reset form
    setProjectName(''); setRevenue(''); setDirectExpenses('');
    setNotes('');
    setLinkedInvoiceId('');

    toast({
      title: '✓ Project saved',
      description: `"${newProject.name}" saved. Go to Tasks & Scoring to assign team scores.`,
    });
  }, [projectName, month, calculations, notes, dispatch, toast, linkedInvoiceId, billingInvoices, billingClients, state.settings.revenueSplit]);

  const deleteProject = useCallback((id: string) => {
    if (confirm('Delete this project?')) {
      dispatch({ type: 'REMOVE_PROJECT', payload: id });
      toast({ title: 'Deleted' });
    }
  }, [dispatch, toast]);

  const duplicateProject = useCallback((project: Project) => {
    setProjectName(`${project.name} (Copy)`);
    setMonth(project.month);
    setRevenue(project.revenue.toString());
    setDirectExpenses(project.directExpenses.toString());
    setNotes(project.notes || '');
    setLinkedInvoiceId(project.billingInvoiceId || '');
    toast({ title: 'Loaded', description: 'Project loaded for editing' });
    setShowHistory(false);
  }, [toast]);

  const exportCSV = useCallback(() => {
    if (!state.projects.length) { toast({ title: 'No projects to export', variant: 'destructive' }); return; }
    const headers = ['Project', 'Type', 'Month', 'Gross Profit', 'Company', 'Bonus Pool', ...activeMembers.map(m => m.name)];
    const rows = state.projects.map(p => [
      p.name, p.type, p.month, p.netProfit, p.companyContribution, p.bonusPool,
      ...activeMembers.map(m => p.distribution.find(d => d.memberId === m.id)?.finalBonus || 0),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `inspirex-projects-${month}.csv`;
    a.click();
    toast({ title: 'Exported' });
  }, [state.projects, activeMembers, month, toast]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Project Calculator</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Client project financials. Team scoring is handled in <strong>Tasks &amp; Scoring</strong>.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-2" />{showHistory ? 'Hide' : 'Show'} History
          </Button>
        </div>
      </div>

      {/* STEP 1 — Invoice + Project Details */}
      <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 1 — Invoice &amp; Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Invoice picker */}
              <div className="space-y-2">
                <Label>Link to Billing Invoice *</Label>
                <Select value={linkedInvoiceId} onValueChange={handleInvoiceLink}>
                  <SelectTrigger className="bg-secondary border-input"><SelectValue placeholder="Select invoice — revenue, name and costs auto-fill" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {billingInvoices.map((inv: any) => {
                      const client = billingClients.find((c: any) => c.id === inv.clientId);
                      return <SelectItem key={inv.id} value={inv.id}>{inv.number} · {client?.name || '—'} · {formatCurrency(Math.round(inv.total * (inv.exchangeRate || 1)))}</SelectItem>;
                    })}
                    {billingInvoices.length === 0 && <SelectItem value="__none" disabled>No invoices — create one in Billing first</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice snapshot */}
              {linkedInvoiceId && (() => {
                const inv = billingInvoices.find((i: any) => i.id === linkedInvoiceId);
                const client = inv ? billingClients.find((c: any) => c.id === inv.clientId) : null;
                const paid = inv ? inv.payments.reduce((s: number, p: any) => s + p.mwkEquivalent, 0) : 0;
                const invMwk = inv ? inv.total * (inv.exchangeRate || 1) : 0;
                const pct = invMwk > 0 ? Math.min(100, Math.round((paid / invMwk) * 100)) : 0;
                const linked = billingExpenses.filter((e: any) => e.invoiceId === linkedInvoiceId);
                const costs = linked.reduce((s: number, e: any) => s + e.amount, 0);
                const pmtStatus = pct >= 100 ? 'confirmed' : pct > 0 ? 'partial' : 'projected';
                return inv ? (
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{inv.number}</div>
                        <div className="font-medium text-sm mt-0.5">{client?.name || '—'}</div>
                        {inv.projectName && <div className="text-xs text-muted-foreground">{inv.projectName}</div>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pmtStatus === 'confirmed' ? 'text-primary bg-primary/10' : pmtStatus === 'partial' ? 'text-blue-400 bg-blue-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                        {pmtStatus === 'confirmed' ? 'PAID' : pmtStatus === 'partial' ? 'PARTIAL' : 'PROJECTED'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-card rounded p-2"><div className="text-[9px] text-muted-foreground mb-0.5">Invoice Total</div><div className="text-xs font-semibold">{formatCurrency(invMwk)}</div></div>
                      <div className="bg-card rounded p-2"><div className="text-[9px] text-muted-foreground mb-0.5">Received</div><div className={`text-xs font-semibold ${paid > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{formatCurrency(paid)}</div></div>
                      <div className="bg-card rounded p-2"><div className="text-[9px] text-muted-foreground mb-0.5">Project Costs</div><div className={`text-xs font-semibold ${costs > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{costs > 0 ? formatCurrency(costs) : '—'}</div></div>
                    </div>
                    {pct > 0 && <div className="h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: pct + '%' }} /></div>}
                    {linked.length > 0 && <div className="text-[10px] text-muted-foreground">{linked.length} project cost{linked.length !== 1 ? 's' : ''} auto-pulled: {linked.map((e: any) => e.description).join(', ')}</div>}
                  </div>
                ) : null;
              })()}

              {/* Project name + month */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    placeholder="Auto-filled from invoice"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    className={`bg-secondary border-input ${linkedInvoiceId && projectName ? 'border-primary/40' : ''}`}
                  />
                  {linkedInvoiceId && projectName && (
                    <p className="text-[10px] text-primary/70">↑ Pulled from invoice — edit to override</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-secondary border-input" />
                </div>
              </div>

              {/* Revenue + costs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Revenue ({state.settings.currencySymbol})</Label>
                  <Input type="number" placeholder="Auto-fills from invoice" value={revenue}
                    onChange={e => setRevenue(e.target.value)} className="bg-secondary border-input" />
                  <p className="text-xs text-muted-foreground">Auto-filled. Edit only if needed.</p>
                </div>
                <div className="space-y-2">
                  <Label>Project Costs ({state.settings.currencySymbol})</Label>
                  <Input type="number" placeholder="Auto-fills from Project Costs tab" value={directExpenses}
                    onChange={e => setDirectExpenses(e.target.value)} className="bg-secondary border-input" />
                  <p className="text-xs text-muted-foreground">Auto-pulled from Billing → Project Costs.</p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="Any additional context or internal notes..."
                  value={notes} onChange={e => setNotes(e.target.value)} className="bg-secondary border-input" />
              </div>
            </CardContent>
          </Card>

          {/* Profit split summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</div>
                <div className="text-2xl font-semibold mt-1">{formatCurrency(calculations.grossProfit)}</div>
                <div className="text-xs text-muted-foreground mt-1">Revenue − Project Costs</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Company Fund ({revenueSplit.companyPercent}%)</div>
                <div className="text-2xl font-semibold mt-1">{formatCurrency(calculations.companyContribution)}</div>
                <Progress value={revenueSplit.companyPercent} className="mt-2 h-1" />
              </CardContent>
            </Card>
            <Card className="bg-card border-border border-primary/30">
              <CardContent className="p-5">
                <div className="text-xs text-primary uppercase tracking-wider">Bonus Pool ({revenueSplit.bonusPercent}%)</div>
                <div className="text-2xl font-semibold mt-1 text-primary">{formatCurrency(calculations.bonusPool)}</div>
                <Progress value={revenueSplit.bonusPercent} className="mt-2 h-1" />
                {revenue && parseFloat(revenue) > 0 && calculations.bonusPool <= 0 && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" />No distributable profit
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

      {/* Save */}
      <div className="flex justify-between items-center no-print flex-wrap gap-3">
        <p className="text-xs text-muted-foreground">
          After saving, go to <strong>Tasks &amp; Scoring</strong> to assign team involvement scores and generate bonus distribution.
        </p>
        <Button onClick={saveProject} className="bg-primary text-primary-foreground hover:bg-primary/90" size="lg">
          <Save className="w-4 h-4 mr-2" />Save Project
        </Button>
      </div>

      {/* History */}
      {showHistory && (
        <Card className="bg-card border-border animate-fadeIn">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Saved Projects ({state.projects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state.projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No projects saved yet.</div>
            ) : (
              <div className="space-y-4">
                {[...state.projects].reverse().map(project => (
                  <ProjectHistoryCard
                    key={project.id}
                    project={project}
                    members={state.members}
                    formatCurrency={formatCurrency}
                    dispatch={dispatch}
                    toast={toast}
                    onDuplicate={() => duplicateProject(project)}
                    onDelete={() => deleteProject(project.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500'];
const mkAvatarColor = (id: string) => AVATAR_COLORS[(id?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
const mkInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ─── Project History Card ─────────────────────────────────────────────────────

interface ProjectHistoryCardProps {
  project: Project;
  members: TeamMember[];
  formatCurrency: (n: number) => string;
  dispatch: (action: any) => void;
  toast: (opts: any) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function ProjectHistoryCard({ project, members, formatCurrency, onDuplicate, onDelete }: ProjectHistoryCardProps) {
  const isClient = project.type === 'client';
  const hasDistribution = project.distribution && project.distribution.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-secondary/10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{project.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${project.type === 'client' ? 'bg-green-500/20 text-green-400' : project.type === 'internal' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{project.type}</span>
            <span className="text-xs text-muted-foreground">{project.month}</span>
            {isClient && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${project.paymentStatus === 'confirmed' ? 'bg-primary/10 text-primary' : project.paymentStatus === 'partial' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {project.paymentStatus === 'confirmed' ? '✓ PAID' : project.paymentStatus === 'partial' ? '~ PARTIAL' : '⟳ PROJECTED'}
              </span>
            )}
            {project.billingInvoiceId && <span className="text-[10px] text-muted-foreground font-mono">linked to invoice</span>}
          </div>
          {isClient ? (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div>Invoice: {formatCurrency(project.revenue)} · Project Costs: {formatCurrency(project.directExpenses)} · Net Profit: {formatCurrency(project.netProfit)}</div>
              <div>
                <span className="text-primary">Company Fund: {formatCurrency(project.companyContribution)}</span>
                {' · '}<span className="text-blue-400">Bonus Pool: {formatCurrency(project.bonusPool)}</span>
                {project.paidAmount > 0 && project.paidAmount < project.revenue && <span className="text-amber-400"> · Received: {formatCurrency(project.paidAmount)}</span>}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">
              {hasDistribution
                ? `${project.distribution.filter((d: ProjectDistribution) => d.totalScore > 0).length} members scored · Contribution Bank`
                : 'No scores yet — score in Tasks & Scoring'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 no-print">
          <Button variant="ghost" size="sm" onClick={onDuplicate} className="h-8 w-8 p-0"><Copy className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* ── Bonus distribution (client) or payment info ── */}
      {isClient && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3 space-y-3">
          {/* Payment status */}
          {project.billingInvoiceId ? (
            <div className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${project.paymentStatus === 'confirmed' ? 'bg-primary/10 text-primary' : project.paymentStatus === 'partial' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <span>
                {project.paymentStatus === 'confirmed' ? '✓ Fully paid via Billing' :
                 project.paymentStatus === 'partial' ? `~ Partial payment — ${formatCurrency(project.paidAmount || 0)} received` :
                 '⟳ Awaiting payment — record in Billing → Invoices'}
              </span>
              {project.paidAmount > 0 && <span className="font-medium">{formatCurrency(project.paidAmount)} / {formatCurrency(project.revenue)}</span>}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-2">Link this project to a Billing invoice in Step 2 to track payments here.</div>
          )}

          {/* Bonus distribution table */}
          {hasDistribution ? (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Bonus Distribution</div>
              <div className="space-y-1.5">
                {project.distribution.filter((d: ProjectDistribution) => d.totalScore > 0).map((d: ProjectDistribution) => {
                  const member = members.find(m => m.id === d.memberId);
                  return (
                    <div key={d.memberId} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white ${mkAvatarColor(d.memberId)}`}>
                        {mkInitials(member?.name || d.memberName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium truncate">{member?.name || d.memberName}</span>
                          <span className="text-primary font-semibold ml-2 flex-shrink-0">{formatCurrency(d.finalBonus)}</span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${d.sharePercent}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-10 text-right">{d.sharePercent.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-2.5 text-center">
              Score this project in <strong className="text-foreground">Tasks &amp; Scoring</strong> to see bonus distribution.
            </div>
          )}
        </div>
      )}

      {/* ── Non-client: contribution bank summary ── */}
      {!isClient && hasDistribution && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Contribution Points</div>
          <div className="flex flex-wrap gap-2">
            {project.distribution.filter((d: ProjectDistribution) => d.totalScore > 0).map((d: ProjectDistribution) => {
              const member = members.find(m => m.id === d.memberId);
              return (
                <div key={d.memberId} className="flex items-center gap-1.5 bg-secondary/40 rounded px-2 py-1">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white ${mkAvatarColor(d.memberId)}`}>
                    {mkInitials(member?.name || d.memberName)}
                  </div>
                  <span className="text-xs font-medium">{member?.name?.split(' ')[0] || d.memberName}</span>
                  <span className="text-[10px] text-primary font-semibold">{d.totalScore} pts</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
