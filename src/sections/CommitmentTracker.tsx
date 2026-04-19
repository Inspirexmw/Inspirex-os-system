import { useMemo, useCallback, useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { Download, ChevronDown, ChevronRight, Briefcase, Zap, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getQuarterLabel(q: string) {
  const [year, qNum] = q.split('-Q');
  return `Q${qNum} ${year}`;
}

function getProjectQuarter(month: string) {
  const d = new Date(month + '-01');
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function getPrevQuarter(q: string) {
  const [year, qNum] = q.split('-Q');
  const y = parseInt(year), n = parseInt(qNum);
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CommitmentTracker() {
  const { state, dispatch, getActiveMembers, getContributionBankReward, formatCurrency } = useApp();
  const { toast } = useToast();
  const activeMembers = getActiveMembers();
  const currentQuarter = state.currentQuarter;

  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, Record<string, boolean>>>({});

  // Build list of all quarters that have projects
  const availableQuarters = useMemo(() => {
    const qs = new Set<string>([currentQuarter]);
    state.projects.forEach(p => qs.add(getProjectQuarter(p.month)));
    return Array.from(qs).sort().reverse();
  }, [state.projects, currentQuarter]);

  const toggleSection = (memberId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || {}), [section]: !(prev[memberId]?.[section] ?? true) },
    }));
  };
  const isSectionOpen = (memberId: string, section: string) =>
    expandedSections[memberId]?.[section] ?? true;

  // Projects for selected quarter
  const quarterProjects = useMemo(() =>
    state.projects.filter(p => getProjectQuarter(p.month) === selectedQuarter),
  [state.projects, selectedQuarter]);

  // Projects for previous quarter (for trend)
  const prevQuarterProjects = useMemo(() =>
    state.projects.filter(p => getProjectQuarter(p.month) === getPrevQuarter(selectedQuarter)),
  [state.projects, selectedQuarter]);

  const extract = (projects: typeof quarterProjects, type: string, member: typeof activeMembers[0]) =>
    projects
      .filter(p => p.type === type)
      .flatMap(p => {
        const dist = p.distribution.find(d => d.memberId === member.id && d.totalScore > 0);
        if (!dist) return [];
        return [{ id: p.id, name: p.name, score: dist.totalScore, bonus: dist.finalBonus, bankPts: member.type !== 'Contract' ? dist.totalScore : 0 }];
      });

  const memberData = useMemo(() =>
    activeMembers.map(member => {
      const clientProjects   = extract(quarterProjects, 'client', member);
      const internalProjects  = extract(quarterProjects, 'internal', member);
      const impressionProjects = extract(quarterProjects, 'impression', member);

      const totalScore = [...clientProjects, ...internalProjects, ...impressionProjects].reduce((s, p) => s + p.score, 0);
      const totalBonus = clientProjects.reduce((s, p) => s + p.bonus, 0);

      // Previous quarter total for trend
      const prevClient    = extract(prevQuarterProjects, 'client', member);
      const prevInternal  = extract(prevQuarterProjects, 'internal', member);
      const prevImpression = extract(prevQuarterProjects, 'impression', member);
      const prevTotal = [...prevClient, ...prevInternal, ...prevImpression].reduce((s, p) => s + p.score, 0);

      const trend: 'up' | 'stable' | 'down' =
        prevTotal === 0 ? 'stable' :
        totalScore > prevTotal * 1.15 ? 'up' :
        totalScore < prevTotal * 0.85 ? 'down' : 'stable';

      const bankReward = getContributionBankReward(member.id);
      const note = (member.quarterlyNotes || {})[selectedQuarter] || '';
      const bankPoints = member.contributionBank.currentQuarterPoints;

      // Radar data
      const radarData = [
        { axis: 'Client', value: clientProjects.reduce((s, p) => s + p.score, 0) },
        { axis: 'Internal', value: internalProjects.reduce((s, p) => s + p.score, 0) },
        { axis: 'Impression', value: impressionProjects.reduce((s, p) => s + p.score, 0) },
      ];

      return { member, clientProjects, internalProjects, impressionProjects, totalScore, totalBonus, trend, bankPoints, bankReward, note, radarData };
    }),
  [activeMembers, quarterProjects, prevQuarterProjects, selectedQuarter, getContributionBankReward]);

  // Team comparison bar data
  const teamBarData = useMemo(() =>
    memberData
      .filter(d => d.totalScore > 0 || d.totalBonus > 0)
      .map(d => ({
        name: d.member.name.split(' ')[0],
        Client:     d.clientProjects.reduce((s, p) => s + p.score, 0),
        Internal:   d.internalProjects.reduce((s, p) => s + p.score, 0),
        Impression: d.impressionProjects.reduce((s, p) => s + p.score, 0),
      }))
      .sort((a, b) => (b.Client + b.Internal + b.Impression) - (a.Client + a.Internal + a.Impression)),
  [memberData]);

  // Quarter summary totals
  const totalClientPts    = memberData.reduce((s, d) => s + d.clientProjects.reduce((ss, p) => ss + p.score, 0), 0);
  const totalInternalPts  = memberData.reduce((s, d) => s + d.internalProjects.reduce((ss, p) => ss + p.score, 0), 0);
  const totalImpressionPts = memberData.reduce((s, d) => s + d.impressionProjects.reduce((ss, p) => ss + p.score, 0), 0);
  const totalBonuses = memberData.reduce((s, d) => s + d.totalBonus, 0);
  const totalQRewards = memberData.reduce((s, d) => s + d.bankReward.rewardAmount, 0);

  const saveNote = useCallback((memberId: string) => {
    dispatch({ type: 'SET_QUARTERLY_NOTE', payload: { memberId, quarter: selectedQuarter, note: noteText } });
    setEditingNote(null); setNoteText('');
    toast({ title: 'Note saved' });
  }, [dispatch, selectedQuarter, noteText, toast]);

  const exportCSV = useCallback(() => {
    const headers = ['Member','Role','Type','Client Pts','Internal Pts','Impression Pts','Bonus','Bank Pts','Q-Reward','Note'];
    const rows = memberData.map(d => [d.member.name, d.member.role, d.member.type,
      d.clientProjects.reduce((s,p)=>s+p.score,0), d.internalProjects.reduce((s,p)=>s+p.score,0),
      d.impressionProjects.reduce((s,p)=>s+p.score,0), d.totalBonus, d.bankPoints, d.bankReward.rewardAmount, d.note]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `inspirex-quarterly-${selectedQuarter}.csv`;
    a.click();
    toast({ title: 'Exported' });
  }, [memberData, selectedQuarter, toast]);

  const tiers = state.settings.contributionBank.tiers;
  const nextTier = (pts: number) => {
    const sorted = [...tiers].sort((a,b) => a.minPoints - b.minPoints);
    return sorted.find(t => t.minPoints > pts && t.rewardPercent > 0) || null;
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Commitment Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">Quarterly performance review</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-36 bg-secondary border-input text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {availableQuarters.map(q => (
                <SelectItem key={q} value={q}>{getQuarterLabel(q)}{q === currentQuarter ? ' (current)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="no-print">
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {/* Quarter summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Client Pts',     value: totalClientPts,               color: 'text-primary',     sub: 'Revenue work' },
          { label: 'Internal Pts',   value: totalInternalPts,             color: 'text-blue-400',    sub: 'Internal work' },
          { label: 'Impression Pts', value: totalImpressionPts,           color: 'text-purple-400',  sub: 'Brand work' },
          { label: 'Total Bonuses',  value: formatCurrency(totalBonuses), color: 'text-primary',     sub: 'From client pool' },
          { label: 'Q-Rewards',      value: formatCurrency(totalQRewards),color: 'text-amber-400',   sub: 'Bank accrued' },
        ].map(({ label, value, color, sub }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-xl font-semibold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team comparison bar chart */}
      {teamBarData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team Contribution — {getQuarterLabel(selectedQuarter)}</CardTitle>
            <p className="text-xs text-muted-foreground">Points by work type per member</p>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamBarData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#ccc' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Client" stackId="a" fill="#73F764" radius={[0,0,0,0]} />
                  <Bar dataKey="Internal" stackId="a" fill="#4a9edd" radius={[0,0,0,0]} />
                  <Bar dataKey="Impression" stackId="a" fill="#9b59b6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {memberData.map(({ member, clientProjects, internalProjects, impressionProjects, totalBonus, totalScore, trend, bankPoints, bankReward, note, radarData }) => {
          const nextT = member.type !== 'Contract' ? nextTier(bankPoints) : null;
              const bankPct = Math.min(100, nextT ? Math.round((bankPoints / nextT.minPoints) * 100) : 100);

          return (
            <Card key={member.id} className="bg-card border-border">
              <CardContent className="p-5 space-y-4">

                {/* Name + trend */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{member.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        member.type === 'Founder'   ? 'bg-primary/20 text-primary' :
                        member.type === 'Full-time' ? 'bg-green-500/20 text-green-400' :
                        member.type === 'Part-time' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>{member.type}</span>
                      {/* Trend indicator */}
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
                        trend === 'up' ? 'text-primary' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {trend === 'up'   && <TrendingUp className="w-3 h-3" />}
                        {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        {trend === 'stable' && <Minus className="w-3 h-3" />}
                        {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{member.role}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-lg font-bold text-foreground">{totalScore} pts</div>
                    <div className="text-xs text-muted-foreground">this quarter</div>
                  </div>
                </div>

                {/* Radar chart + stats side by side */}
                <div className="flex gap-4 items-center">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <PolarGrid stroke="#333" />
                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#888' }} />
                        <Radar dataKey="value" stroke="#73F764" fill="#73F764" fillOpacity={0.25} strokeWidth={1.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { label: 'Client', pts: clientProjects.reduce((s,p)=>s+p.score,0), color: 'text-primary', bg: 'bg-primary' },
                      { label: 'Internal', pts: internalProjects.reduce((s,p)=>s+p.score,0), color: 'text-blue-400', bg: 'bg-blue-400' },
                      { label: 'Impression', pts: impressionProjects.reduce((s,p)=>s+p.score,0), color: 'text-purple-400', bg: 'bg-purple-400' },
                    ].map(({ label, pts, color, bg }) => {
                      const pct = totalScore > 0 ? Math.round((pts / totalScore) * 100) : 0;
                      return (
                        <div key={label}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className={color}>{label}</span>
                            <span className="text-muted-foreground">{pts} pts</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full ${bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {totalBonus > 0 && (
                      <div className="pt-1 text-xs">
                        <span className="text-muted-foreground">Bonus: </span>
                        <span className="text-primary font-medium">{formatCurrency(totalBonus)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project sections */}
                <div className="space-y-2">
                  <Section label="Client Work" icon={<Briefcase className="w-3.5 h-3.5" />} accent="text-primary"
                    projects={clientProjects} isOpen={isSectionOpen(member.id, 'client')}
                    onToggle={() => toggleSection(member.id, 'client')}
                    emptyText="No client projects this quarter" showBonus formatCurrency={formatCurrency}
                    footer={clientProjects.length > 0
                      ? <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
                          <span>{clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}</span>
                          <span className="text-primary font-medium">{formatCurrency(totalBonus)} earned</span>
                        </div> : null}
                  />
                  <Section label="Internal Work" icon={<Zap className="w-3.5 h-3.5" />} accent="text-blue-400"
                    projects={internalProjects} isOpen={isSectionOpen(member.id, 'internal')}
                    onToggle={() => toggleSection(member.id, 'internal')}
                    emptyText="No internal projects this quarter" showBankPts={member.type !== 'Contract'} formatCurrency={formatCurrency}
                    footer={internalProjects.length > 0
                      ? <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
                          <span>{internalProjects.length} project{internalProjects.length !== 1 ? 's' : ''}</span>
                          {member.type !== 'Contract' && <span className="text-blue-400 font-medium">+{internalProjects.reduce((s,p)=>s+p.bankPts,0)} bank pts</span>}
                        </div> : null}
                  />
                  <Section label="Impression Work" icon={<Star className="w-3.5 h-3.5" />} accent="text-purple-400"
                    projects={impressionProjects} isOpen={isSectionOpen(member.id, 'impression')}
                    onToggle={() => toggleSection(member.id, 'impression')}
                    emptyText="No impression projects this quarter" showBankPts={member.type !== 'Contract'} formatCurrency={formatCurrency}
                    footer={impressionProjects.length > 0
                      ? <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
                          <span>{impressionProjects.length} project{impressionProjects.length !== 1 ? 's' : ''}</span>
                          {member.type !== 'Contract' && <span className="text-purple-400 font-medium">+{impressionProjects.reduce((s,p)=>s+p.bankPts,0)} bank pts</span>}
                        </div> : null}
                  />
                </div>

                {/* Contribution Bank */}
                <div className="pt-2 border-t border-border/50 space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Contribution Bank</div>
                  {member.type === 'Contract' ? (
                    <div className="text-xs text-muted-foreground italic">Contract members don't accumulate bank points</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span><span className="text-foreground font-medium">{bankPoints}</span> <span className="text-muted-foreground">pts this quarter</span></span>
                        {bankReward.tier && bankReward.rewardAmount > 0
                          ? <span className="text-amber-400 font-medium">{formatCurrency(bankReward.rewardAmount)} Q-reward · {bankReward.tier.rewardPercent}% tier</span>
                          : nextT
                          ? <span className="text-muted-foreground">{nextT.minPoints - bankPoints} pts to next tier</span>
                          : <span className="text-muted-foreground">No pts yet</span>}
                      </div>
                      {/* Progress bar toward next tier */}
                      {nextT && (
                        <div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${bankPct}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                            <span>{bankPoints} pts</span>
                            <span>{nextT.minPoints} pts for {nextT.rewardPercent}% reward</span>
                          </div>
                        </div>
                      )}
                      {!nextT && bankReward.tier && (
                        <div className="h-2 bg-amber-400/30 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: '100%' }} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Founder note */}
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Founder Note</div>
                    {editingNote !== member.id && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground"
                        onClick={() => { setEditingNote(member.id); setNoteText(note); }}>
                        {note ? 'Edit' : '+ Add note'}
                      </Button>
                    )}
                  </div>
                  {editingNote === member.id ? (
                    <div className="space-y-2">
                      <Textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                        placeholder="Your observation for this quarter..."
                        className="text-xs bg-secondary border-input resize-none h-20" />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNote(null)}>Cancel</Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => saveNote(member.id)}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-foreground/70 italic min-h-[1.5rem]">
                      {note || <span className="text-muted-foreground">No note yet — add your quarterly observation</span>}
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Collapsible project section ─────────────────────────────────────────────

interface PEntry { id: string; name: string; score: number; bonus: number; bankPts: number; }

function Section({ label, icon, accent, projects, isOpen, onToggle, emptyText, showBonus, showBankPts, footer, formatCurrency }: {
  label: string; icon: React.ReactNode; accent: string;
  projects: PEntry[]; isOpen: boolean; onToggle: () => void;
  emptyText: string; showBonus?: boolean; showBankPts?: boolean;
  footer?: React.ReactNode; formatCurrency: (n: number) => string;
}) {
  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-secondary/20 hover:bg-secondary/40 transition-colors text-left">
        <div className={`flex items-center gap-2 text-xs font-medium ${accent}`}>
          {icon}{label}
          <span className="text-muted-foreground font-normal">({projects.length})</span>
        </div>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-3 py-2">
          {projects.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-1">{emptyText}</div>
          ) : (
            <div>
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-xs">
                  <span className="text-foreground/80 flex-1 pr-3 truncate">{p.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{p.score} pts</span>
                    {showBonus   && <span className="text-primary font-medium w-24 text-right">{formatCurrency(p.bonus)}</span>}
                    {showBankPts && p.bankPts > 0 && <span className="text-amber-400 font-medium">+{p.bankPts} bank</span>}
                  </div>
                </div>
              ))}
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
