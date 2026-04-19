import { useState, useMemo, useCallback } from 'react';
import { Search, Download, Trash2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

export function WorkLog() {
  const { state, dispatch, getActiveMembers } = useApp();
  const { toast } = useToast();
  const activeMembers = getActiveMembers();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMember, setFilterMember] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all-months');
  const [showFilters, setShowFilters] = useState(false);

  // Stats from all entries
  const stats = useMemo(() => {
    const total = state.workLog.reduce((s, e) => s + e.totalPoints, 0);
    const client = state.workLog.filter(e => e.type === 'client').reduce((s, e) => s + e.totalPoints, 0);
    const internal = state.workLog.filter(e => e.type === 'internal').reduce((s, e) => s + e.totalPoints, 0);
    const impression = state.workLog.filter(e => e.type === 'impression').reduce((s, e) => s + e.totalPoints, 0);
    return { total, client, internal, impression };
  }, [state.workLog]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return state.workLog.filter(entry => {
      if (searchQuery && !entry.task.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !entry.memberName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(entry.projectName || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterMember !== 'all' && entry.memberId !== filterMember) return false;
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterMonth && filterMonth !== 'all-months' && !entry.date.startsWith(filterMonth)) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.workLog, searchQuery, filterMember, filterType, filterMonth]);

  // Group by project
  const groupedEntries = useMemo(() => {
    const groups: Record<string, typeof filteredEntries> = {};
    filteredEntries.forEach(entry => {
      const key = entry.projectName || 'No Project';
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const deleteEntry = useCallback((id: string) => {
    if (confirm('Delete this work log entry?')) {
      dispatch({ type: 'REMOVE_WORK_LOG', payload: id });
      toast({ title: 'Entry deleted' });
    }
  }, [dispatch, toast]);

  const exportCSV = useCallback(() => {
    if (!state.workLog.length) {
      toast({ title: 'No entries to export', variant: 'destructive' });
      return;
    }
    const headers = ['Date', 'Member', 'Project', 'Type', 'Task', 'Deliverables', 'Responsibility', 'Quality', 'Total Points', 'Notes'];
    const rows = filteredEntries.map(e => [
      e.date, e.memberName, e.projectName || '', e.type, e.task,
      e.scores.deliverables, e.scores.responsibility, e.scores.quality,
      e.totalPoints, e.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `inspirex-worklog-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ title: 'Exported', description: 'Work log exported to CSV' });
  }, [filteredEntries, state.workLog.length, toast]);

  const typeBadge = (type: string) => {
    if (type === 'client') return <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px]">Client</Badge>;
    if (type === 'internal') return <Badge className="bg-blue-500/20 text-blue-400 border-0 text-[10px]">Internal</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">Impression</Badge>;
  };

  const availableMonths = useMemo(() => {
    return Array.from(new Set(state.workLog.map(e => e.date.slice(0, 7)))).sort().reverse();
  }, [state.workLog]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Work Log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-generated from Project Calculator. All contributions recorded here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="no-print">
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Points', value: stats.total, color: '' },
          { label: 'Client Points', value: stats.client, color: 'text-green-400' },
          { label: 'Internal Points', value: stats.internal, color: 'text-blue-400' },
          { label: 'Impression Points', value: stats.impression, color: 'text-amber-400' },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
        <span className="text-primary mt-0.5">💡</span>
        <span>
          Work log entries are created automatically when you save a project in the{' '}
          <strong className="text-foreground">Project Calculator</strong>.
          Score your team there — entries appear here instantly.
        </span>
      </div>

      {/* Search and Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by task, member or project..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-input"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />Filters
              {(filterMember !== 'all' || filterType !== 'all' || (filterMonth && filterMonth !== 'all-months')) && (
                <span className="ml-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="w-44 bg-secondary border-input">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All members</SelectItem>
                  {activeMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 bg-secondary border-input">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="impression">Impression</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-40 bg-secondary border-input">
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all-months">All months</SelectItem>
                  {availableMonths.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filterMember !== 'all' || filterType !== 'all' || (filterMonth && filterMonth !== 'all-months')) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterMember('all'); setFilterType('all'); setFilterMonth('all-months');
                }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entries */}
      {state.workLog.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg mb-2">No work log entries yet.</p>
            <p className="text-sm">Go to Project Calculator → score your team → save the project. Entries appear here automatically.</p>
          </CardContent>
        </Card>
      ) : filteredEntries.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>No entries match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedEntries).map(([projectName, entries]) => (
            <Card key={projectName} className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span>{projectName}</span>
                    {typeBadge(entries[0].type)}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{entries.length} entries</span>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-t border-b border-border bg-secondary/20">
                      <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Member</th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Task</th>
                      <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground uppercase">D</th>
                      <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground uppercase">R</th>
                      <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Q</th>
                      <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground uppercase">Total</th>
                      <th className="py-2 px-4 no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10">
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{entry.date}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium">{entry.memberName.split(' ')[0]}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">{entry.task}</div>
                          {entry.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5">{entry.notes}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">{entry.scores.deliverables}</td>
                        <td className="py-3 px-4 text-center text-sm">{entry.scores.responsibility}</td>
                        <td className="py-3 px-4 text-center text-sm">{entry.scores.quality}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-primary">{entry.totalPoints}</span>
                        </td>
                        <td className="py-3 px-4 no-print">
                          <Button variant="ghost" size="sm" onClick={() => deleteEntry(entry.id)}
                            className="text-destructive hover:text-destructive h-7 w-7 p-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
