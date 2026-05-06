import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export type StatusTone = 'lime' | 'blue' | 'amber' | 'red' | 'purple' | 'cyan' | 'neutral';

const TONES: Record<StatusTone, { dot: string; text: string; bg: string; border: string; bgActive: string }> = {
  lime:    { dot: 'bg-[#73F764]',    text: 'text-[#73F764]',  bg: 'bg-[#73F764]/10',  border: 'border-[#73F764]/25',  bgActive: 'bg-[#73F764]/20' },
  blue:    { dot: 'bg-blue-400',     text: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/25',   bgActive: 'bg-blue-400/20' },
  amber:   { dot: 'bg-amber-400',    text: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/25',  bgActive: 'bg-amber-400/20' },
  red:     { dot: 'bg-red-400',      text: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/25',    bgActive: 'bg-red-400/20' },
  purple:  { dot: 'bg-purple-400',   text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/25', bgActive: 'bg-purple-400/20' },
  cyan:    { dot: 'bg-cyan-400',     text: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/25',   bgActive: 'bg-cyan-400/20' },
  neutral: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: 'bg-secondary', border: 'border-border', bgActive: 'bg-secondary' },
};

export interface StatusTabItem {
  key: string;
  label: string;
  count?: number;
  tone: StatusTone;
  delta?: number | null;
  caption?: string;
}

interface StatusTabsProps {
  items: StatusTabItem[];
  active?: string;
  onChange?: (key: string) => void;
  className?: string;
}

/**
 * Hello-Barbara-style colored status tabs.
 * Each tab has its own tone, count, and optional delta vs last period.
 */
export function StatusTabs({ items, active, onChange, className = '' }: StatusTabsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${Math.min(items.length, 4)} gap-3 ${className}`}>
      {items.map(item => {
        const t = TONES[item.tone];
        const isActive = active === item.key;
        const Wrapper: any = onChange ? motion.button : motion.div;
        return (
          <Wrapper
            key={item.key}
            whileHover={onChange ? { y: -2 } : undefined}
            transition={{ duration: 0.15 }}
            onClick={onChange ? () => onChange(item.key) : undefined}
            className={`relative text-left p-4 rounded-xl border ${t.border} ${isActive ? t.bgActive : t.bg} ${onChange ? 'cursor-pointer' : 'cursor-default'} transition-colors`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-2 text-xs font-medium ${t.text}`}>
                <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                {item.label}
              </span>
              {item.delta !== undefined && item.delta !== null && (
                <span className={`text-[10px] font-medium tabular ${item.delta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {item.delta >= 0 ? '+' : ''}{Math.round(item.delta * 10) / 10}%
                </span>
              )}
            </div>
            {item.count !== undefined && (
              <div className={`text-2xl font-bold tabular mt-2 ${t.text}`}>{item.count}</div>
            )}
            {item.caption && (
              <div className="text-[11px] text-muted-foreground mt-0.5">{item.caption}</div>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}

interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

/** Simple inline status badge. */
export function StatusBadge({ tone, children, className = '' }: StatusBadgeProps) {
  const t = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${t.text} ${t.bg} border ${t.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

