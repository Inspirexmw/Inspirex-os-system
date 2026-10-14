import { useState, useCallback } from 'react';
import { Save, Download, Upload, Trash2, AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DEFAULT_SETTINGS } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function Settings() {
  const { state, dispatch, exportData, importData } = useApp();
  const { toast } = useToast();
  
  // Local state for settings
  const [settings, setSettings] = useState(state.settings);
  const [importText, setImportText] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);

  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Save settings
  const saveSettings = useCallback(() => {
    const now = new Date().toISOString();
    dispatch({ type: 'UPDATE_SETTINGS', payload: { ...settings, lastSavedAt: now } });
    setLastSaved(now);
    toast({ title: '✓ Settings saved', description: 'All changes saved to browser storage' });
  }, [settings, dispatch, toast]);

  // Update nested setting
  const updateSetting = useCallback((path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current: any = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  }, []);

  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspirex-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast({ title: 'Exported', description: 'Data backup downloaded' });
  }, [exportData, toast]);

  // Import data
  const handleImport = useCallback(() => {
    if (!importText.trim()) {
      toast({ title: 'Error', description: 'Please paste data to import', variant: 'destructive' });
      return;
    }
    
    if (importData(importText)) {
      setImportText('');
      setImportDialogOpen(false);
      toast({ title: 'Imported', description: 'Data imported successfully' });
      // Reload settings
      setSettings(state.settings);
    } else {
      toast({ title: 'Error', description: 'Invalid data format', variant: 'destructive' });
    }
  }, [importText, importData, toast, state.settings]);

  // Reset all data
  const handleClearData = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_DATA' });
    setClearDataDialogOpen(false);
    toast({ title: 'Reset', description: 'All data has been cleared' });
  }, [dispatch, toast]);

  // Reset settings to defaults
  const handleResetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    dispatch({ type: 'RESET_SETTINGS' });
    toast({ title: 'Reset', description: 'Settings restored to defaults' });
  }, [dispatch, toast]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize your compensation system and manage data
        </p>
      </div>

      {/* Section 1: Company & Display */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Company & Display
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => updateSetting('companyName', DEFAULT_SETTINGS.companyName)}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={settings.companyName}
                onChange={(e) => updateSetting('companyName', e.target.value)}
                className="bg-secondary border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency Symbol</Label>
              <Input
                value={settings.currencySymbol}
                onChange={(e) => updateSetting('currencySymbol', e.target.value.slice(0, 5))}
                className="bg-secondary border-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency Code</Label>
              <Input
                value={settings.currencyCode}
                onChange={(e) => updateSetting('currencyCode', e.target.value.slice(0, 5))}
                className="bg-secondary border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Fiscal Year Start Month</Label>
              <Select value={settings.fiscalMonthStart} onValueChange={(v) => updateSetting('fiscalMonthStart', v)}>
                <SelectTrigger className="bg-secondary border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {MONTHS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fiscal Year End Month</Label>
              <Select value={settings.fiscalYearEnd || 'December'} onValueChange={(v) => updateSetting('fiscalYearEnd', v)}>
                <SelectTrigger className="bg-secondary border-input"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for Tax Report annual period calculations.</p>
            </div>
            <div className="space-y-2">
              <Label>Custom Approval Link Domain</Label>
              <Input
                value={settings.customDomain || ''}
                onChange={(e) => updateSetting('customDomain', e.target.value.trim())}
                placeholder="e.g. studio.inspirex.africa"
                className="bg-secondary border-input"
              />
              <p className="text-xs text-muted-foreground">Quote approval links use this domain instead of the internal app URL.</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div>
              <div className="font-medium text-sm">Auto-save</div>
              <div className="text-xs text-muted-foreground">Automatically save changes to browser storage</div>
            </div>
            <Switch 
              checked={settings.autoSave} 
              onCheckedChange={(v) => updateSetting('autoSave', v)} 
            />
          </div>
          {(lastSaved || state.settings.lastSavedAt) && (
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-primary" />
                <div>
                  <div className="text-xs font-medium text-primary">Last saved</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(lastSaved || state.settings.lastSavedAt || '').toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => {
                const data = JSON.stringify(exportData ? exportData() : state, null, 2);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
                a.download = 'inspirex-backup-' + new Date().toISOString().slice(0,10) + '.json';
                a.click();
              }}>
                <Download className="w-3 h-3" />Backup now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Working Capital Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Working Capital Bank</CardTitle>
          <p className="text-xs text-muted-foreground">
            Controls for your operations account — month-end auto-transfer from Retained Profit.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Month-end Auto Transfer % of Retained Profit</Label>
            <Input
              type="number"
              min={0} max={100}
              value={settings.workingCapital.autoTransferPercent ?? 0}
              onChange={(e) => updateSetting('workingCapital.autoTransferPercent', parseInt(e.target.value) || 0)}
              className="bg-secondary border-input md:max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Within last 3 days of each month, system prompts to transfer this % of <em>this month's</em> retained profit into WC. 0 = disabled.</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div>
              <div className="font-medium text-sm">Enable month-end auto-transfer prompt</div>
              <div className="text-xs text-muted-foreground">Receive a prompt 3 days before month end to transfer funds to WC</div>
            </div>
            <Switch
              checked={settings.workingCapital.autoTransferEnabled ?? false}
              onCheckedChange={(v) => updateSetting('workingCapital.autoTransferEnabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 9: Data Management */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/30 rounded-lg">
              <div className="font-medium text-sm mb-1">Export Backup</div>
              <div className="text-xs text-muted-foreground mb-3">
                Download a backup of all your data
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export Backup
              </Button>
            </div>
            
            <div className="p-4 bg-secondary/30 rounded-lg">
              <div className="font-medium text-sm mb-1">Import Backup</div>
              <div className="text-xs text-muted-foreground mb-3">
                Restore from a previous backup
              </div>
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Backup
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Import Data</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Paste your backup JSON data below. This will replace all current data.
                    </p>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Paste JSON data here..."
                      className="w-full h-40 bg-secondary border border-input rounded-md p-3 text-sm font-mono"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setImportDialogOpen(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={handleImport} className="flex-1 bg-primary text-primary-foreground">
                        Import
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/30 rounded-lg">
              <div className="font-medium text-sm mb-1">Reset Settings</div>
              <div className="text-xs text-muted-foreground mb-3">
                Reset settings to defaults. Data is preserved.
              </div>
              <Button variant="outline" size="sm" onClick={handleResetSettings} className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Settings
              </Button>
            </div>
            
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-destructive">Clear All Data</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Deletes projects, logs, team data. Settings preserved.
                  </div>
                  <Dialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle className="text-destructive">Clear All Data?</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                          This will permanently delete all projects, work logs, and team data. 
                          This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setClearDataDialogOpen(false)} className="flex-1">
                            Cancel
                          </Button>
                          <Button variant="destructive" onClick={handleClearData} className="flex-1">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Yes, Clear All
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save Button */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="flex items-center gap-2 text-primary">
              <Check className="w-4 h-4" />
              Changes are saved to this browser
            </span>
          </div>
          <Button 
            onClick={saveSettings}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
