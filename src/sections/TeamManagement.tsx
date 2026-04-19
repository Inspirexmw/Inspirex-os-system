import { useState, useCallback } from 'react';
import { Trash2, Edit2, Users, Mail, Briefcase, DollarSign, UserPlus, AlertTriangle, PiggyBank, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import type { EmploymentType, TeamMember } from '@/types';

export function TeamManagement() {
  const { state, dispatch, formatCurrency, getActiveMembers, getContributionBankReward } = useApp();
  const { toast } = useToast();
  
  const activeMembers = getActiveMembers();
  const inactiveMembers = state.members.filter(m => !m.isActive);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<EmploymentType>('Part-time');
  const [stipend, setStipend] = useState('30000');

  // Reset form
  const resetForm = useCallback(() => {
    setName('');
    setRole('');
    setEmail('');
    setType('Part-time');
    setStipend('30000');
    setEditingMember(null);
  }, []);

  // Open add dialog
  const openAddDialog = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  // Open edit dialog
  const openEditDialog = useCallback((member: TeamMember) => {
    setEditingMember(member);
    setName(member.name);
    setRole(member.role);
    setEmail(member.email || '');
    setType(member.type);
    setStipend(member.stipend.toString());
    setDialogOpen(true);
  }, []);

  // Save member
  const saveMember = useCallback(() => {
    if (!name.trim() || !role.trim()) {
      toast({ title: 'Error', description: 'Name and role are required', variant: 'destructive' });
      return;
    }

    const memberData = {
      name: name.trim(),
      role: role.trim(),
      email: email.trim() || undefined,
      type,
      stipend: parseInt(stipend) || 0,
    };

    if (editingMember) {
      dispatch({
        type: 'UPDATE_MEMBER',
        payload: { ...editingMember, ...memberData },
      });
      toast({ title: 'Updated', description: `${memberData.name} updated successfully` });
    } else {
      const newMember: TeamMember = {
        id: Date.now().toString(),
        ...memberData,
        joinedAt: new Date().toISOString().slice(0, 10),
        isActive: true,
        deferredStipendBalance: 0,
        contributionBank: { currentQuarterPoints: 0, pendingRewards: 0 },
        quarterlyReliability: {},
        quarterlyNotes: {},
      };
      dispatch({ type: 'ADD_MEMBER', payload: newMember });
      toast({ title: 'Added', description: `${memberData.name} added to the team` });
    }

    setDialogOpen(false);
    resetForm();
  }, [name, role, email, type, stipend, editingMember, dispatch, toast, resetForm]);

  // Remove member
  const removeMember = useCallback((member: TeamMember) => {
    if (confirm(`Remove ${member.name}? Their past records will be preserved.`)) {
      dispatch({ type: 'REMOVE_MEMBER', payload: member.id });
      toast({ title: 'Removed', description: `${member.name} has been removed` });
    }
  }, [dispatch, toast]);

  // Reactivate member
  const reactivateMember = useCallback((member: TeamMember) => {
    dispatch({
      type: 'UPDATE_MEMBER',
      payload: { ...member, isActive: true },
    });
    toast({ title: 'Reactivated', description: `${member.name} is back on the team` });
  }, [dispatch, toast]);

  // Get type badge color
  const getTypeBadgeClass = (type: EmploymentType) => {
    switch (type) {
      case 'Founder': return 'bg-primary/20 text-primary';
      case 'Full-time': return 'bg-green-500/20 text-green-400';
      case 'Part-time': return 'bg-blue-500/20 text-blue-400';
      case 'Contract': return 'bg-amber-500/20 text-amber-400';
    }
  };

  // Calculate total monthly stipends
  const totalStipends = activeMembers.reduce((sum, m) => sum + m.stipend, 0);
  const totalDeferred = activeMembers.reduce((sum, m) => sum + m.deferredStipendBalance, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Team Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add, edit, or remove team members. Changes apply across the whole system.
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-primary text-primary-foreground no-print">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          Removing a member preserves all their past work log entries and project history. 
          Only their name is removed from future dropdowns and scoring.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground uppercase">Active Members</div>
                <div className="text-2xl font-semibold">{activeMembers.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs text-muted-foreground uppercase">Monthly Stipends</div>
                <div className="text-2xl font-semibold">{formatCurrency(totalStipends)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-xs text-muted-foreground uppercase">Full-time</div>
                <div className="text-2xl font-semibold">
                  {activeMembers.filter(m => m.type === 'Full-time').length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-card border-border ${totalDeferred > 0 ? 'border-amber-500/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <PiggyBank className={`w-5 h-5 ${totalDeferred > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
              <div>
                <div className="text-xs text-muted-foreground uppercase">Deferred</div>
                <div className={`text-2xl font-semibold ${totalDeferred > 0 ? 'text-amber-400' : ''}`}>
                  {formatCurrency(totalDeferred)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Members */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Active Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Member</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Role</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Stipend/mo</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Deferred</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Bank</th>
                  <th className="w-20 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(member => {
                  const bankReward = getContributionBankReward(member.id);
                  return (
                    <tr key={member.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-3 px-3">
                        <div className="font-medium text-sm">{member.name}</div>
                        {member.email && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">{member.role}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${getTypeBadgeClass(member.type)}`}>
                          {member.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-mono">
                        {member.stipend > 0 ? formatCurrency(member.stipend) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-sm">
                        {member.deferredStipendBalance > 0 ? (
                          <span className="text-amber-400">{formatCurrency(member.deferredStipendBalance)}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <Award className="w-3 h-3 text-primary" />
                          <span>{member.contributionBank.currentQuarterPoints} pts</span>
                        </div>
                        {bankReward.tier && bankReward.rewardAmount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {bankReward.tier.rewardPercent}% = {formatCurrency(bankReward.rewardAmount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 no-print">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditDialog(member)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {member.type !== 'Founder' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeMember(member)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {activeMembers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No active team members.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Members */}
      {inactiveMembers.length > 0 && (
        <Card className="bg-card border-border border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Former Members ({inactiveMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveMembers.map(member => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg opacity-60"
                >
                  <div>
                    <div className="font-medium text-sm">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.role}</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => reactivateMember(member)}
                    className="no-print"
                  >
                    Reactivate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add Team Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grace Banda"
                className="bg-secondary border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Role / Title</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Motion Graphics Designer"
                className="bg-secondary border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="bg-secondary border-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as EmploymentType)}>
                  <SelectTrigger className="bg-secondary border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Founder">Founder</SelectItem>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Stipend ({state.settings.currencySymbol})</Label>
                <Input
                  type="number"
                  value={stipend}
                  onChange={(e) => setStipend(e.target.value)}
                  placeholder="0"
                  className="bg-secondary border-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveMember} className="bg-primary text-primary-foreground">
                {editingMember ? 'Save Changes' : 'Add Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
