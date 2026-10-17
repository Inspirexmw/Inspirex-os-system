import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Settings,
  Receipt, BarChart3, Search, ArrowRight, CornerDownLeft,
} from 'lucide-react';
import type { ViewType } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: ViewType) => void;
}

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  group: 'Navigate' | 'Actions';
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navCommands: PaletteCommand[] = useMemo(() => [
    { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Navigate', keywords: 'home overview', run: () => onNavigate('dashboard') },
    { id: 'nav-billing', label: 'Billing', icon: Receipt, group: 'Navigate', keywords: 'invoice quote receipt client', run: () => onNavigate('billing') },
    { id: 'nav-summary', label: 'Monthly Summary', icon: BarChart3, group: 'Navigate', keywords: 'report month', run: () => onNavigate('summary') },
    { id: 'nav-capital', label: 'Working Capital', icon: Wallet, group: 'Navigate', keywords: 'wc bank cash retained', run: () => onNavigate('capital') },
    { id: 'nav-settings', label: 'Settings', icon: Settings, group: 'Navigate', keywords: 'config preferences', run: () => onNavigate('settings') },
  ], [onNavigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navCommands;
    return navCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords || '').toLowerCase().includes(q) ||
      (c.hint || '').toLowerCase().includes(q)
    );
  }, [navCommands, query]);

  const grouped = useMemo(() => {
    const map: Record<string, PaletteCommand[]> = {};
    filtered.forEach(c => { (map[c.group] ||= []).push(c); });
    return map;
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) { cmd.run(); onOpenChange(false); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIndex, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
          onClick={() => onOpenChange(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type a command or search…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-secondary/50">esc</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No results for "{query}"</div>
              ) : (
                Object.entries(grouped).map(([group, cmds]) => (
                  <div key={group} className="mb-2 last:mb-0">
                    <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                      {group}
                    </div>
                    {cmds.map(cmd => {
                      const idx = filtered.indexOf(cmd);
                      const active = idx === activeIndex;
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => { cmd.run(); onOpenChange(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            active ? 'bg-primary/10 text-foreground' : 'text-foreground/80 hover:text-foreground'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="flex-1 text-left">{cmd.label}</span>
                          {active ? <CornerDownLeft className="w-3 h-3 text-primary" /> : <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between px-4 h-9 border-t border-border bg-secondary/20 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-card border border-border">↑</kbd><kbd className="px-1 rounded bg-card border border-border">↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-card border border-border">↵</kbd> select</span>
              </div>
              <span>InspireX OS</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
