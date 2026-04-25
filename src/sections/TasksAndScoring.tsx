import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, CheckSquare, ChevronRight, ChevronDown, Save, X, Pencil, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import type { TaskProject, TaskProjectScore, ProjectTask, WorkType, WorkLogEntry } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500','bg-purple-500','bg-green-500',
  'bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500',
];
const mkAvatarColor = (id: string) => AVATAR_COLORS[(id?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
const mkInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const mkId = () => `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const mkTaskId = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const TYPE_COLOR: Record<WorkType, string> = {
  client: 'bg-green-500/20 text-green-400',
  internal: 'bg-blue-500/20 text-blue-400',
  impression: 'bg-amber-500/20 text-amber-400',
};

// ─── New Project Form ─────────────────────────────────────────────────────────

interface NewProjectFormProps {
  onSave: (tp: TaskProject) => void;
  onCancel: () => void;
  billingInvoices: any[];
  billingClients: any[];
}

function NewProjectForm({ onSave, onCancel, billingInvoices, billingClients }: NewProjectFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<WorkType>('client');
  const [invoiceId, setInvoiceId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = useState('');

  const handleInvoiceSelect = (id: string) => {
    if (!id || id === '__none') { setInvoiceId(''); return; }
    setInvoiceId(id);
    const inv = billingInvoices.find((i: any) => i.id === id);
    if (!inv) return;
    const autoName = inv.projectName
      || inv.lineItems?.[0]?.description?.split('\n')[0]?.trim()
      || inv.number || '';
    if (autoName) setName(autoName);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const inv = invoiceId ? billingInvoices.find((i: any) => i.id === invoiceId) : null;
    const client = inv ? billingClients.find((c: any) => c.id === inv.clientId) : null;
    const tp: TaskProject = {
      id: mkId(),
      name: name.trim(),
      type,
      billingInvoiceId: invoiceId || undefined,
      billingClientId: client?.id || undefined,
      month,
      tasks: [],
      scores: [],
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onSave(tp);
  };

  return (
    <Card className="bg-card border-primary/30 border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">New Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Project Type</Label>
            <Select value={type} onValueChange={v => { setType(v as WorkType); setInvoiceId(''); }}>
              <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="client">💼 Client</SelectItem>
                <SelectItem value="internal">⚙️ Internal</SelectItem>
                <SelectItem value="impression">✨ Impression</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-secondary border-input h-8 text-sm" />
          </div>
        </div>

        {type === 'client' && (
          <div className="space-y-1">
            <Label className="text-xs">Link to Invoice (optional)</Label>
            <Select value={invoiceId} onValueChange={handleInvoiceSelect}>
              <SelectTrigger className="bg-secondary border-input h-8 text-sm"><SelectValue placeholder="Select invoice…" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none">— None —</SelectItem>
                {billingInvoices.map((inv: any) => {
                  const cl = billingClients.find((c: any) => c.id === inv.clientId);
                  return <SelectItem key={inv.id} value={inv.id}>{inv.number} · {cl?.name || '—'}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Project Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. ACE Branding Refresh" className="bg-secondary border-input h-8 text-sm" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes (optional)</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any context…" className="bg-secondary border-input h-8 text-sm" />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1" />Create Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, members, onToggle, onCycle, onDelete, onEdit }: {
  task: ProjectTask;
  members: any[];
  onToggle: () => void;
  onCycle: () => void;
  onDelete: () => void;
  onEdit: (description: string, memberId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description);
  const [editMemberId, setEditMemberId] = useState(task.assignedMemberId || '');
  const activeMembers = members.filter(m => m.isActive);
  const assignee = members.find(m => m.id === task.assignedMemberId);

  const startEdit = () => {
    setEditDesc(task.description);
    setEditMemberId(task.assignedMemberId || '');
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editDesc.trim()) return;
    onEdit(editDesc.trim(), editMemberId);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditDesc(task.description);
    setEditMemberId(task.assignedMemberId || '');
    setEditing(false);
  };

  // ── Edit mode ──
  if (editing) {
    return (
      <div className="rounded-md bg-secondary/40 border border-primary/30 p-2 space-y-2">
        <Textarea
          value={editDesc}
          onChange={e => setEditDesc(e.target.value)}
          className="text-xs bg-secondary border-input resize-none min-h-[64px]"
          rows={3}
          autoFocus
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
        />
        <div className="flex gap-2">
          <Select value={editMemberId} onValueChange={setEditMemberId}>
            <SelectTrigger className="flex-1 h-8 text-xs bg-secondary border-input">
              <SelectValue placeholder="Assign to member…" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {activeMembers.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mkAvatarColor(m.id)}`}>
                      {mkInitials(m.name)}
                    </div>
                    {m.name.split(' ')[0]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={cancelEdit}
            className="h-8 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex-shrink-0"
            title="Cancel">
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={saveEdit}
            disabled={!editDesc.trim()}
            className="h-8 px-3 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0 flex items-center gap-1"
            title="Save changes">
            <Check className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>
    );
  }

  // ── View mode ──
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-secondary/30 hover:bg-secondary/50 group transition-colors">
      {/* Checkbox */}
      <button onClick={onToggle} className="flex-shrink-0 mt-0.5">
        {task.status === 'done'
          ? <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          : <div className="w-4 h-4 rounded border border-border bg-secondary/50" />}
      </button>

      {/* Description — wraps naturally */}
      <span className={`flex-1 text-xs min-w-0 break-words leading-relaxed ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {task.description}
      </span>

      {/* Right-side controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {assignee && (
          <div className="flex items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${mkAvatarColor(assignee.id)}`}>
              {mkInitials(assignee.name)}
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:block">{assignee.name.split(' ')[0]}</span>
          </div>
        )}
        <button onClick={onCycle}
          className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors
            ${task.status === 'done' ? 'bg-primary/10 text-primary hover:bg-primary/20'
            : task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
            : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}>
          {task.status}
        </button>
        <button onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary flex-shrink-0 transition-opacity p-0.5"
          title="Edit task">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0 transition-opacity p-0.5"
          title="Delete task">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Project Card (left column) ───────────────────────────────────────────────

function ProjectCard({
  project, selected, billingClients, billingInvoices, members, onSelect, dispatch, toast,
}: {
  project: TaskProject;
  selected: boolean;
  billingClients: any[];
  billingInvoices: any[];
  members: any[];
  onSelect: () => void;
  dispatch: any;
  toast: any;
}) {
  const tasks = project.tasks || [];
  const done = tasks.filter(t => t.status === 'done').length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const inv = project.billingInvoiceId ? billingInvoices.find((i: any) => i.id === project.billingInvoiceId) : null;
  const client = inv ? billingClients.find((c: any) => c.id === inv.clientId) : null;

  const [newDesc, setNewDesc] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const activeMembers = members.filter(m => m.isActive);

  const addTask = () => {
    if (!newDesc.trim()) { toast({ title: 'Enter a task description', variant: 'destructive' }); return; }
    if (!newMemberId) { toast({ title: 'Select a member', variant: 'destructive' }); return; }
    const task: ProjectTask = {
      id: mkTaskId(),
      description: newDesc.trim(),
      assignedMemberId: newMemberId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_PROJECT_TASK', payload: { taskProjectId: project.id, task } });
    setNewDesc('');
    toast({ title: '✓ Task added' });
  };

  const toggleTask = (task: ProjectTask) => {
    const done = task.status === 'done';
    dispatch({ type: 'UPDATE_PROJECT_TASK', payload: {
      taskProjectId: project.id, taskId: task.id,
      updates: { status: done ? 'pending' : 'done', completedAt: done ? undefined : new Date().toISOString() },
    }});
  };

  const cycleStatus = (task: ProjectTask) => {
    const next: Record<ProjectTask['status'], ProjectTask['status']> = {
      pending: 'in-progress', 'in-progress': 'done', done: 'pending',
    };
    dispatch({ type: 'UPDATE_PROJECT_TASK', payload: {
      taskProjectId: project.id, taskId: task.id,
      updates: { status: next[task.status], completedAt: next[task.status] === 'done' ? new Date().toISOString() : undefined },
    }});
  };

  const deleteTask = (taskId: string) => {
    dispatch({ type: 'DELETE_PROJECT_TASK', payload: { taskProjectId: project.id, taskId } });
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${selected
        ? 'border-primary/50 bg-primary/5'
        : 'border-border bg-card hover:border-border/80'}`}
    >
      {/* Card header — click to select */}
      <button className="w-full text-left p-3" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{project.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[project.type]}`}>
                {project.type}
              </span>
            </div>
            {client && <div className="text-xs text-muted-foreground mt-0.5">{client.name}{inv ? ` · ${inv.number}` : ''}</div>}
            {!client && project.type !== 'client' && (
              <div className="text-xs text-muted-foreground mt-0.5">{project.month}</div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">{done}/{tasks.length}</span>
            {selected ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2">
            <Progress value={pct} className="h-1" />
          </div>
        )}
      </button>

      {/* Expanded task list */}
      {selected && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">

          {/* Info badge */}
          {project.type !== 'client' ? (
            <div className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1">
              Points → Contribution Bank (Q-Reward, not Calculator)
            </div>
          ) : (
            <div className="text-[10px] text-primary bg-primary/5 border border-primary/20 rounded px-2 py-1">
              Scores push to Project Calculator on save
            </div>
          )}

          {/* Summary */}
          {tasks.length > 0 && (
            <div className="flex gap-3 text-xs">
              <span className="text-muted-foreground">Total <span className="text-foreground font-medium">{tasks.length}</span></span>
              <span className="text-primary">Done <span className="font-medium">{done}</span></span>
              <span className="text-amber-400">Remaining <span className="font-medium">{tasks.length - done}</span></span>
            </div>
          )}

          {/* Task rows */}
          {tasks.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">No tasks yet — add one below.</div>
          )}
          <div className="space-y-1">
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                members={members}
                onToggle={() => toggleTask(task)}
                onCycle={() => cycleStatus(task)}
                onDelete={() => deleteTask(task.id)}
                onEdit={(description, memberId) =>
                  dispatch({ type: 'UPDATE_PROJECT_TASK', payload: {
                    taskProjectId: project.id, taskId: task.id,
                    updates: { description, assignedMemberId: memberId },
                  }})
                }
              />
            ))}
          </div>

          {/* Add task row */}
          <div className="pt-1 border-t border-border space-y-2">
            <Textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Describe the task in detail — what needs to be done, any relevant context…"
              className="text-xs bg-secondary border-input resize-none min-h-[72px]"
              rows={3}
            />
            <div className="flex gap-2">
              <Select value={newMemberId} onValueChange={setNewMemberId}>
                <SelectTrigger className="flex-1 h-8 text-xs bg-secondary border-input">
                  <SelectValue placeholder="Assign to member…" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {activeMembers.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mkAvatarColor(m.id)}`}>{mkInitials(m.name)}</div>
                        {m.name.split(' ')[0]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addTask} className="h-8 px-3 text-xs bg-primary text-primary-foreground flex-shrink-0">
                <Plus className="w-3 h-3 mr-1" />Add Task
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scoring Panel (right column) ────────────────────────────────────────────

function ScoringPanel({
  project, members, dispatch, toast,
}: {
  project: TaskProject;
  members: any[];
  dispatch: any;
  toast: any;
}) {
  const { state } = useApp();
  const activeMembers = members.filter(m => m.isActive);
  const tasks = project.tasks || [];
  const doneTasks = tasks.filter(t => t.status === 'done');
  const totalDone = doneTasks.length;
  const pct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0;

  const calcAutoD = (memberId: string) => {
    const memberDone = doneTasks.filter(t => t.assignedMemberId === memberId).length;
    return totalDone > 0 ? Math.round((memberDone / totalDone) * 30) : 0;
  };

  const [scores, setScores] = useState<Record<string, { deliverables: number; responsibility: number; quality: number }>>(() => {
    const init: Record<string, { deliverables: number; responsibility: number; quality: number }> = {};
    activeMembers.forEach(m => {
      const existing = project.scores.find(s => s.memberId === m.id);
      init[m.id] = {
        deliverables: existing?.deliverables ?? calcAutoD(m.id),
        responsibility: existing?.responsibility ?? 0,
        quality: existing?.quality ?? 0,
      };
    });
    return init;
  });

  // Re-sync scores when project tasks change (auto-deliverables update)
  useEffect(() => {
    setScores(prev => {
      const next = { ...prev };
      activeMembers.forEach(m => {
        const existing = project.scores.find(s => s.memberId === m.id);
        // Only update deliverables auto if no existing saved score
        if (!existing) {
          next[m.id] = { ...next[m.id], deliverables: calcAutoD(m.id) };
        }
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length, doneTasks.length]);

  const setScore = (memberId: string, field: 'deliverables' | 'responsibility' | 'quality', val: number) =>
    setScores(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: val } }));

  const handleSave = () => {
    for (const [, sc] of Object.entries(scores)) {
      if (sc.deliverables < 0 || sc.deliverables > 30) { toast({ title: 'Deliverables must be 0–30', variant: 'destructive' }); return; }
      if (sc.responsibility < 0 || sc.responsibility > 35) { toast({ title: 'Responsibility must be 0–35', variant: 'destructive' }); return; }
      if (sc.quality < 0 || sc.quality > 35) { toast({ title: 'Quality must be 0–35', variant: 'destructive' }); return; }
    }

    const allScores = activeMembers.map(m => ({
      ...scores[m.id],
      memberId: m.id,
      totalPoints: (scores[m.id]?.deliverables || 0) + (scores[m.id]?.responsibility || 0) + (scores[m.id]?.quality || 0),
      sharePercent: 0, // calculated below
    }));

    const totalPts = allScores.reduce((s, sc) => s + sc.totalPoints, 0);
    const finalScores: TaskProjectScore[] = allScores.map(sc => ({
      ...sc,
      sharePercent: totalPts > 0 ? (sc.totalPoints / totalPts) * 100 : 0,
    }));

    dispatch({ type: 'SAVE_PROJECT_SCORES', payload: { taskProjectId: project.id, scores: finalScores } });

    // Work log entries + Contribution Bank for non-client projects
    const today = new Date().toISOString().slice(0, 10);
    finalScores.filter(sc => sc.totalPoints > 0).forEach(sc => {
      const member = state.members.find(m => m.id === sc.memberId);
      const entry: WorkLogEntry = {
        id: `wl-${Date.now()}-${sc.memberId}`,
        memberId: sc.memberId,
        memberName: member?.name || '',
        projectName: project.name,
        type: project.type,
        date: today,
        task: project.name,
        scores: { deliverables: sc.deliverables, responsibility: sc.responsibility, quality: sc.quality },
        totalPoints: sc.totalPoints,
      };
      dispatch({ type: 'ADD_WORK_LOG', payload: entry });

      if (project.type !== 'client' && member && member.type !== 'Contract') {
        dispatch({
          type: 'UPDATE_CONTRIBUTION_BANK',
          payload: { memberId: sc.memberId, points: sc.totalPoints, quarter: state.currentQuarter },
        });
      }
    });

    toast({ title: '✓ Scores saved' });
  };

  // Per-member task summaries for display
  const memberTaskSummary = (memberId: string) => {
    const memberDone = doneTasks.filter(t => t.assignedMemberId === memberId);
    if (memberDone.length === 0) return 'No completed tasks';
    const preview = memberDone.slice(0, 2).map(t => t.description.split(' ').slice(0, 2).join(' ')).join(', ');
    return `${memberDone.length} done · ${preview}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold">{project.name}</h2>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[project.type]}`}>{project.type}</span>
      </div>

      {/* Task progress summary */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{totalDone}/{tasks.length} tasks done</span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      {/* Member scoring rows */}
      <div className="space-y-2">
        {activeMembers.map(member => {
          const sc = scores[member.id] || { deliverables: 0, responsibility: 0, quality: 0 };
          const autoD = calcAutoD(member.id);
          const total = sc.deliverables + sc.responsibility + sc.quality;

          return (
            <div key={member.id} className="bg-secondary/20 rounded-lg p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_88px_88px_88px_56px]">
                {/* Member info */}
                <div className="flex gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${mkAvatarColor(member.id)}`}>
                    {mkInitials(member.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{memberTaskSummary(member.id)}</div>
                    <div className="mt-1 space-y-0.5">
                      <div className="text-[9px] text-muted-foreground/60">· Did they produce the majority of outputs?</div>
                      <div className="text-[9px] text-muted-foreground/60">· Did they complete tasks without being chased?</div>
                      <div className="text-[9px] text-muted-foreground/60">· Was their work portfolio-worthy?</div>
                    </div>
                  </div>
                </div>

                {/* Deliverables /30 */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Deliverables</div>
                  <Input type="number" min={0} max={30}
                    value={sc.deliverables}
                    onChange={e => setScore(member.id, 'deliverables', Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="h-8 w-full text-center text-sm font-semibold bg-secondary border-input text-primary" />
                  <div className="text-[9px] text-primary/70">auto ({autoD}) / 30</div>
                </div>

                {/* Responsibility /35 */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Responsibility</div>
                  <Input type="number" min={0} max={35}
                    value={sc.responsibility}
                    onChange={e => setScore(member.id, 'responsibility', Math.min(35, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="h-8 w-full text-center text-sm font-semibold bg-secondary border-input" />
                  <div className="text-[9px] text-muted-foreground">/ 35</div>
                </div>

                {/* Quality /35 */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Quality</div>
                  <Input type="number" min={0} max={35}
                    value={sc.quality}
                    onChange={e => setScore(member.id, 'quality', Math.min(35, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="h-8 w-full text-center text-sm font-semibold bg-secondary border-input" />
                  <div className="text-[9px] text-muted-foreground">/ 35</div>
                </div>

                {/* Total */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Total</div>
                  <div className="h-8 w-full flex items-center justify-center text-sm font-bold text-primary">{total}</div>
                  <div className="text-[9px] text-muted-foreground">/ 100</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div className="text-[10px] text-muted-foreground bg-secondary/30 rounded-md p-2.5 leading-relaxed">
        Deliverables are auto-calculated from completed tasks. Edit if a task carried more weight than others.
        Responsibility and Quality are your judgment — use the prompts above.
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {project.type === 'client' ? 'Save scores → push to Calculator' : 'Save scores → add to Q-Bank'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function TasksAndScoring() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();
  const taskProjects: TaskProject[] = state.taskProjects || [];
  const billingInvoices = (state.billing?.documents || []).filter((d: any) => d.type === 'invoice');
  const billingClients = state.billing?.clients || [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | WorkType>('all');
  const [showNewForm, setShowNewForm] = useState(false);

  const filteredProjects = useMemo(() =>
    taskProjects.filter(tp => filterType === 'all' || tp.type === filterType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [taskProjects, filterType]
  );

  const selectedProject = taskProjects.find(tp => tp.id === selectedId) || null;

  const handleCreateProject = (tp: TaskProject) => {
    dispatch({ type: 'ADD_TASK_PROJECT', payload: tp });
    setSelectedId(tp.id);
    setShowNewForm(false);
    toast({ title: '✓ Project created' });
  };

  const handleDeleteProject = (id: string) => {
    if (!confirm('Delete this task project?')) return;
    dispatch({ type: 'DELETE_TASK_PROJECT', payload: id });
    if (selectedId === id) setSelectedId(null);
    toast({ title: 'Project deleted' });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            Tasks & Scoring
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track tasks, score involvement, push results to the Project Calculator.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewForm(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />New Project
        </Button>
      </div>

      {/* New project form */}
      {showNewForm && (
        <NewProjectForm
          onSave={handleCreateProject}
          onCancel={() => setShowNewForm(false)}
          billingInvoices={billingInvoices}
          billingClients={billingClients}
        />
      )}

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* ── Left column: project list ── */}
        <div className="w-full sm:w-80 flex-shrink-0 space-y-3">
          {/* Filter tabs */}
          <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
            {(['all', 'client', 'internal', 'impression'] as const).map(f => (
              <button key={f} onClick={() => setFilterType(f)}
                className={`flex-1 py-1 text-xs rounded-md transition-colors font-medium ${filterType === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <CheckSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
              {taskProjects.length === 0
                ? 'No projects yet — click "+ New Project" to start.'
                : 'No projects match this filter.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map(tp => (
                <div key={tp.id} className="relative group/card">
                  <ProjectCard
                    project={tp}
                    selected={selectedId === tp.id}
                    billingClients={billingClients}
                    billingInvoices={billingInvoices}
                    members={state.members}
                    onSelect={() => setSelectedId(selectedId === tp.id ? null : tp.id)}
                    dispatch={dispatch}
                    toast={toast}
                  />
                  <button
                    onClick={() => handleDeleteProject(tp.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
                    title="Delete project">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column: scoring panel ── */}
        <div className="flex-1 min-w-0">
          {selectedProject ? (
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <ScoringPanel
                  project={selectedProject}
                  members={state.members}
                  dispatch={dispatch}
                  toast={toast}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-48 text-muted-foreground text-sm rounded-lg border border-dashed border-border">
              <CheckSquare className="w-8 h-8 mb-3 opacity-20" />
              <p>Select a project to score it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
