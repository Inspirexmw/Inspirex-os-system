import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Wallet, Shield, PiggyBank, Users } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface PulseStat {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  format?: (n: number) => string;
  /** 0–100 progress bar (optional). If provided, draws a thin progress strip */
  progress?: number;
  progressColor?: string;
  /** Tone for the icon background */
  tone?: 'lime' | 'blue' | 'purple' | 'amber' | 'red' | 'neutral';
  /** Subtitle / extra info */
  hint?: string;
  onClick?: () => void;
}

const TONES: Record<NonNullable<PulseStat['tone']>, { bg: string; text: string }> = {
  lime:    { bg: 'bg-primary/15',    text: 'text-primary' },
  blue:    { bg: 'bg-blue-400/15',   text: 'text-blue-400' },
  purple:  { bg: 'bg-purple-400/15', text: 'text-purple-400' },
  amber:   { bg: 'bg-amber-400/15',  text: 'text-amber-400' },
  red:     { bg: 'bg-red-400/15',    text: 'text-red-400' },
  neutral: { bg: 'bg-secondary',     text: 'text-muted-foreground' },
};

interface OperationsPulseProps {
  stats: PulseStat[];
  className?: string;
  formatCurrency: (n: number) => string;
}

export function OperationsPulse({ stats, formatCurrency, className = '' }: OperationsPulseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
      className={`bg-card rounded-2xl overflow-hidden ${className}`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/30">
        {stats.map(s => {
          const Icon = s.icon;
          const tone = TONES[s.tone || 'neutral'];
          const Comp: any = s.onClick ? motion.button : motion.div;
          return (
            <Comp
              key={s.key}
              whileHover={s.onClick ? { backgroundColor: 'hsl(var(--secondary) / 0.3)' } : undefined}
              transition={{ duration: 0.15 }}
              onClick={s.onClick}
              className={`relative p-5 text-left ${s.onClick ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{s.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${tone.text}`} />
                </div>
              </div>
              <div className={`text-2xl font-semibold tracking-tight tabular ${tone.text}`}>
                {s.format ? <AnimatedNumber value={s.value} format={s.format} /> : <AnimatedNumber value={s.value} format={formatCurrency} />}
              </div>
              {s.hint && <div className="text-[11px] text-muted-foreground mt-1.5">{s.hint}</div>}
              {s.progress !== undefined && (
                <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }}
                    transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.progressColor || 'hsl(var(--primary))' }}
                  />
                </div>
              )}
            </Comp>
          );
        })}
      </div>
    </motion.div>
  );
}

// Re-export icons for convenience at call sites
export { Wallet, Shield, PiggyBank, Users };

// Util to silence unused-imports if a host doesn't use ReactNode
export type { ReactNode };
