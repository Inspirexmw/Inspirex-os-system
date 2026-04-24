import { useState, useCallback, useMemo } from 'react';
import { Save, Download, Trash2, History, Copy, AlertTriangle, Info } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import type { DimensionScores, ProjectDistribution, WorkType, Project, WorkLogEntry } from '@/types';

interface MemberScore {
  memberId: string;
  scores: DimensionScores;
}

const TYPE_CONFIG: Record<WorkType, { badge: string; desc: string; color: string }> = {
  client: {
    badge: 'Revenue-generating',
    desc: 'Generates revenue. Triggers 60/40 split. Bonus pool distributed to team based on involvement scores.',
    color: 'border-primary/30 bg-primary/5',
  },
  internal: {
    badge: 'Non-revenue',
    desc: 'No revenue. Builds InspireX systems and capacity. Scores feed the Contribution Bank.',
    color: 'border-blue-500/30 bg-blue-500/5',
  },
  impression: {
    badge: 'Non-revenue',
    desc: 'No revenue. Portfolio and visibility work. Same quality standard as paid work. Scores feed the Contribution Bank.',
    color: 'border-amber-500/30 bg-amber-500/5',
  },
};

export function ProjectCalculator() {
  const { state, dispatch, formatCurrency, getActiveMembers } = useApp();
  const { toast } = useToast();

  const activeMembers = getActiveMembers();
  const { scoringWeights, revenueSplit } = state.settings;

  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<WorkType>('client');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [linkedInvoiceId, setLinkedInvoiceId] = useState('');
  const [revenue, setRevenue] = useState('');
  const [directExpenses, setDirectExpenses] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

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
    // Pull project name: invoice.projectName → first line item title → invoice number
    const autoName = inv.projectName
      || (inv.lineItems?.[0]?.description?.split('\n')[0]?.trim())
      || inv.number
      || '';
    setProjectName(autoName); // always override — invoice is the source of truth
    // Auto-pull project costs linked to this invoice
    const linked = billingExpenses.filter((e: any) => e.invoiceId === invoiceId);
    const totalCosts = linked.reduce((s: number, e: any) => s + e.amount, 0);
    setDirectExpenses(totalCosts > 0 ? String(totalCosts) : '');
  };
  const [memberScores, setMemberScores] = useState<MemberScore[]>(
    activeMembers.map(m => ({ memberId: m.id, scores: { deliverables: 0, responsibility: 0, quality: 0 } }))
  );
  const [showHistory, setShowHistory] = useState(true);

  const isClient = projectType === 'client';

  const calculations = useMemo(() => {
    if (!isClient) return { rev: 0, exp: 0, grossProfit: 0, bonusPool: 0, companyContribution: 0 };
    const rev = parseFloat(revenue) || 0;
    const exp = parseFloat(directExpenses) || 0;
    const grossProfit = Math.max(0, rev - exp);
    const bonusPool = grossProfit * ((revenueSplit.bonusPercent ?? 40) / 100);
    const companyContribution = grossProfit * ((revenueSplit.companyPercent ?? 60) / 100);
    return { rev, exp, grossProfit, bonusPool, companyContribution };
  }, [revenue, directExpenses, revenueSplit, isClient]);

  const distribution = useMemo((): ProjectDistribution[] => {
    const totalScore = memberScores.reduce((sum, ms) =>
      sum + ms.scores.deliverables + ms.scores.responsibility + ms.scores.quality, 0);
    return memberScores.map(ms => {
      const member = activeMembers.find(m => m.id === ms.memberId);
      const memberTotalScore = ms.scores.deliverables + ms.scores.responsibility + ms.scores.quality;
      const sharePercent = isClient && totalScore > 0 ? memberTotalScore / totalScore : 0;
      const baseBonus = isClient ? calculations.bonusPool * sharePercent : 0;
      return {
        memberId: ms.memberId,
        memberName: member?.name || 'Unknown',
        scores: ms.scores,
        totalScore: memberTotalScore,
        sharePercent: sharePercent * 100,
        baseBonus: Math.round(baseBonus),
        performanceMultiplier: 1.0,
        finalBonus: Math.round(baseBonus),
      };
    });
  }, [memberScores, calculations.bonusPool, activeMembers, isClient]);

  const updateScore = useCallback((memberId: string, dimension: keyof DimensionScores, value: string) => {
    const maxValue = scoringWeights[dimension];
    const numValue = Math.min(parseInt(value) || 0, maxValue);
    setMemberScores(prev => prev.map(ms =>
      ms.memberId === memberId ? { ...ms, scores: { ...ms.scores, [dimension]: numValue } } : ms
    ));
  }, [scoringWeights]);

  const handleTypeChange = useCallback((type: WorkType) => {
    setProjectType(type);
    setRevenue('');
    setDirectExpenses('');
    setDescription('');
  }, []);

  const saveProject = useCallback(() => {
    // Auto-resolve project name from linked invoice if blank
    const resolvedName = projectName.trim() || (() => {
      const inv = billingInvoices.find((i: any) => i.id === linkedInvoiceId);
      return inv?.projectName || inv?.number || '';
    })();
    if (!resolvedName) {
      toast({ title: 'Error', description: 'Enter a project name or link to an invoice', variant: 'destructive' });
      return;
    }
    if (isClient && calculations.rev === 0) {
      toast({ title: 'Error', description: 'Please enter revenue for this client project', variant: 'destructive' });
      return;
    }
    const hasAnyScore = memberScores.some(ms =>
      ms.scores.deliverables + ms.scores.responsibility + ms.scores.quality > 0
    );
    if (!hasAnyScore) {
      toast({ title: 'Error', description: 'Score at least one team member before saving', variant: 'destructive' });
      return;
    }

    // No multiplier — finalBonus = baseBonus directly from involvement scores
    const distributionWithMultipliers = distribution.map(d => ({
      ...d,
      performanceMultiplier: 1.0,
      finalBonus: d.baseBonus,
    }));

    // Get client info from linked invoice
    const linkedInv = billingInvoices.find((i: any) => i.id === linkedInvoiceId);
    const linkedClient = linkedInv ? billingClients.find((c: any) => c.id === linkedInv.clientId) : null;

    const newProject: Project = {
      id: Date.now().toString(),
      name: resolvedName,
      type: projectType,
      month,
      revenue: calculations.rev,
      directExpenses: calculations.exp,
      netProfit: calculations.grossProfit,
      bonusPool: calculations.bonusPool,
      companyContribution: calculations.companyContribution,
      distribution: distributionWithMultipliers,
      createdAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
      payments: [],
      billingInvoiceId: linkedInvoiceId || undefined,
      billingClientId: linkedClient?.id || undefined,
      paymentStatus: 'projected',
      paidAmount: linkedInv ? linkedInv.payments.reduce((s: number, p: any) => s + p.mwkEquivalent, 0) : 0,
    };

    dispatch({ type: 'ADD_PROJECT', payload: newProject });

    // Retroactively accrue retained profit for payments already on the linked invoice
    // (fires when invoice was paid before the project was saved in calculator)
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

    // AUTO-CREATE WORK LOG ENTRIES for every scored member
    const today = new Date().toISOString().slice(0, 10);
    const workLogEntries: WorkLogEntry[] = memberScores
      .filter(ms => ms.scores.deliverables + ms.scores.responsibility + ms.scores.quality > 0)
      .map(ms => {
        const member = activeMembers.find(m => m.id === ms.memberId);
        const totalPts = ms.scores.deliverables + ms.scores.responsibility + ms.scores.quality;
        return {
          id: `${Date.now()}-${ms.memberId}`,
          memberId: ms.memberId,
          memberName: member?.name || 'Unknown',
          projectId: newProject.id,
          projectName: newProject.name,
          type: projectType,
          date: today,
          task: newProject.name,
          scores: { ...ms.scores },
          totalPoints: totalPts,
          notes: undefined,
        };
      });

    workLogEntries.forEach(entry => {
      dispatch({ type: 'ADD_WORK_LOG', payload: entry });
      if (projectType === 'internal' || projectType === 'impression') {
        // Only non-contract members accumulate contribution bank points
        const member = activeMembers.find(m => m.id === entry.memberId);
        if (member && member.type !== 'Contract') {
          dispatch({
            type: 'UPDATE_CONTRIBUTION_BANK',
            payload: { memberId: entry.memberId, points: entry.totalPoints, quarter: state.currentQuarter },
          });
        }
      }
    });

    // Reset form
    setProjectName(''); setRevenue(''); setDirectExpenses('');
    setDescription(''); setNotes('');
    setLinkedInvoiceId('');
    setMemberScores(activeMembers.map(m => ({ memberId: m.id, scores: { deliverables: 0, responsibility: 0, quality: 0 } })));

    toast({
      title: '✓ Project saved',
      description: `"${newProject.name}" saved. ${workLogEntries.length} work log entries created automatically.`,
    });
  }, [projectName, projectType, isClient, month, calculations, distribution, notes, dispatch, toast, activeMembers, memberScores, state.currentQuarter, linkedInvoiceId, billingInvoices, billingClients]);

  const deleteProject = useCallback((id: string) => {
    if (confirm('Delete this project?')) {
      dispatch({ type: 'REMOVE_PROJECT', payload: id });
      toast({ title: 'Deleted' });
    }
  }, [dispatch, toast]);

  const duplicateProject = useCallback((project: Project) => {
    setProjectName(`${project.name} (Copy)`);
    setProjectType(project.type);
    setMonth(project.month);
    setRevenue(project.revenue.toString());
    setDirectExpenses(project.directExpenses.toString());
    setNotes(project.notes || '');
    setLinkedInvoiceId(project.billingInvoiceId || '');
    setMemberScores(activeMembers.map(m => {
      const dist = project.distribution.find(d => d.memberId === m.id);
      return { memberId: m.id, scores: dist?.scores || { deliverables: 0, responsibility: 0, quality: 0 } };
    }));
    toast({ title: 'Loaded', description: 'Project loaded for editing' });
    setShowHistory(false);
  }, [activeMembers, toast]);

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

  const cfg = TYPE_CONFIG[projectType];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Project Calculator</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Score your team here. Work log entries are created automatically when you save.
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

      {/* STEP 1 — Project Type */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 1 — Project Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-72">
              <Select value={projectType} onValueChange={(v) => handleTypeChange(v as WorkType)}>
                <SelectTrigger className="bg-secondary border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="client">💼  Client Project</SelectItem>
                  <SelectItem value="internal">⚙️  Internal Project</SelectItem>
                  <SelectItem value="impression">✨  Impression / Visibility</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant={isClient ? 'default' : 'secondary'} className="text-xs">{cfg.badge}</Badge>
          </div>
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm text-muted-foreground ${cfg.color}`}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
            <span>{cfg.desc}</span>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2 — Invoice + Project Details (client) */}
      {isClient && (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 2 — Invoice & Project Details</CardTitle>
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

              {/* Invoice snapshot — shown after selection */}
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

              {/* Project name + month — same row, name always visible */}
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
                  {linkedInvoiceId && !projectName && (
                    <p className="text-xs text-amber-400">Waiting for invoice selection</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-secondary border-input" />
                </div>
              </div>

              {/* Revenue + costs — editable override */}
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
        </>
      )}

      {/* STEP 2 — Description (non-revenue projects) */}
      {!isClient && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 2 — Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input placeholder="e.g. InspireX brand guidelines refresh"
                  value={projectName} onChange={e => setProjectName(e.target.value)} className="bg-secondary border-input" />
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-secondary border-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Brief description</Label>
              <Input placeholder="e.g. System documentation, internal tool build..."
                value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary border-input" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any additional context..."
                value={notes} onChange={e => setNotes(e.target.value)} className="bg-secondary border-input" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4 — Involvement Scoring (ALL project types) */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step 3 — Involvement Scoring — enter 0 if member was not involved
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isClient && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
              💡 Scores for {projectType} projects feed each member's <strong className="text-primary">Contribution Bank</strong> this quarter.
              Work log entries are created automatically when you save. No immediate bonus — reward pays at quarter end.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Member</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Deliverables /{scoringWeights.deliverables}</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Responsibility /{scoringWeights.responsibility}</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Quality /{scoringWeights.quality}</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Total Pts</th>
                  {isClient && (
                    <>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Share</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Bonus</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(member => {
                  const ms = memberScores.find(s => s.memberId === member.id);
                  const dist = distribution.find(d => d.memberId === member.id);
                  const totalScore = ms ? ms.scores.deliverables + ms.scores.responsibility + ms.scores.quality : 0;
                  return (
                    <tr key={member.id} className="border-b border-border/50">
                      <td className="py-3 px-3">
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.role}</div>
                        <div className="flex gap-1 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            member.type === 'Founder' ? 'bg-primary/20 text-primary' :
                            member.type === 'Full-time' ? 'bg-green-500/20 text-green-400' :
                            member.type === 'Part-time' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'}`}>
                            {member.type}
                          </span>
                          {member.stipend === 0 && member.type !== 'Founder' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Bonus only</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Input type="number" min={0} max={scoringWeights.deliverables}
                          value={ms?.scores.deliverables || 0}
                          onChange={e => updateScore(member.id, 'deliverables', e.target.value)}
                          className="w-20 mx-auto text-center bg-secondary border-input" />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Input type="number" min={0} max={scoringWeights.responsibility}
                          value={ms?.scores.responsibility || 0}
                          onChange={e => updateScore(member.id, 'responsibility', e.target.value)}
                          className="w-20 mx-auto text-center bg-secondary border-input" />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Input type="number" min={0} max={scoringWeights.quality}
                          value={ms?.scores.quality || 0}
                          onChange={e => updateScore(member.id, 'quality', e.target.value)}
                          className="w-20 mx-auto text-center bg-secondary border-input" />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-semibold text-primary">{totalScore} pts</div>
                      </td>
                      {isClient && (
                        <>
                          <td className="py-3 px-3 text-right">
                            <div className="text-sm font-medium">{dist?.sharePercent.toFixed(1)}%</div>
                            <div className="w-20 h-1 bg-secondary rounded-full ml-auto mt-1 overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${dist?.sharePercent || 0}%` }} />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="text-sm font-semibold text-primary">{formatCurrency(dist?.finalBonus || 0)}</div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-between items-center no-print flex-wrap gap-3">
        <p className="text-xs text-muted-foreground">
          Saving will create work log entries automatically for all scored members.
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
                    formatCurrency={formatCurrency}
                    wcBalance={state.wcBalance || 0}
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


// ─── Project History Card with Payment Tracker ───────────────────────────────

interface ProjectHistoryCardProps {
  project: Project;
  formatCurrency: (n: number) => string;
  wcBalance: number;
  
  onDuplicate: () => void;
  onDelete: () => void;
}

function ProjectHistoryCard({
  project, formatCurrency,
  onDuplicate, onDelete,
}: ProjectHistoryCardProps) {



  const isClient = project.type === 'client';

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-secondary/10">
      {/* Project header */}
      <div className="flex items-start justify-between p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{project.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              project.type === 'client' ? 'bg-green-500/20 text-green-400' :
              project.type === 'internal' ? 'bg-blue-500/20 text-blue-400' :
              'bg-amber-500/20 text-amber-400'}`}>
              {project.type}
            </span>
            <span className="text-xs text-muted-foreground">{project.month}</span>
            {isClient && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                project.paymentStatus === 'confirmed' ? 'bg-primary/10 text-primary' :
                project.paymentStatus === 'partial' ? 'bg-blue-500/10 text-blue-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                {project.paymentStatus === 'confirmed' ? '✓ PAID' :
                 project.paymentStatus === 'partial' ? '~ PARTIAL' : '⟳ PROJECTED'}
              </span>
            )}
            {project.billingInvoiceId && (
              <span className="text-[10px] text-muted-foreground font-mono">linked to invoice</span>
            )}
          </div>
          {isClient ? (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div>Invoice: {formatCurrency(project.revenue)} · Project Costs: {formatCurrency(project.directExpenses)} · Net Profit: {formatCurrency(project.netProfit)}</div>
              <div>
                <span className="text-primary">Company Fund: {formatCurrency(project.companyContribution)}</span>
                {' · '}
                <span className="text-blue-400">Bonus Pool: {formatCurrency(project.bonusPool)}</span>
                {project.paidAmount > 0 && project.paidAmount < project.revenue && (
                  <span className="text-amber-400"> · Received: {formatCurrency(project.paidAmount)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">
              {project.distribution.filter(d => d.totalScore > 0).length} members scored · Contribution Bank
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 no-print">
          <Button variant="ghost" size="sm" onClick={onDuplicate} className="h-8 w-8 p-0">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Client project WC actions */}
      {isClient && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3 space-y-3">

          {/* Direct Expenses row */}
          {project.directExpenses > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Direct Expenses: <span className="text-foreground font-medium">{formatCurrency(project.directExpenses)}</span>
              </div>
              <span className="text-[10px] text-primary/60">Via Billing → Project Costs</span>
            </div>
          )}

          {/* Payment tracker */}
          <div>


            {/* Payment status — now driven by Billing */}
            {project.billingInvoiceId ? (
              <div className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${
                project.paymentStatus === 'confirmed' ? 'bg-primary/10 text-primary' :
                project.paymentStatus === 'partial' ? 'bg-blue-500/10 text-blue-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                <span>
                  {project.paymentStatus === 'confirmed' ? '✓ Fully paid via Billing' :
                   project.paymentStatus === 'partial' ? `~ Partial payment — ${formatCurrency(project.paidAmount || 0)} received` :
                   '⟳ Awaiting payment — record in Billing → Invoices'}
                </span>
                {project.paidAmount > 0 && (
                  <span className="font-medium">{formatCurrency(project.paidAmount)} / {formatCurrency(project.revenue)}</span>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-1 bg-secondary/30 rounded p-2">
                Link this project to a Billing invoice in Step 2 to track payments here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
