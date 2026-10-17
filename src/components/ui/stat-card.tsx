import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { DeltaPill } from '@/components/ui/delta-pill';
import { Figure } from '@/components/ui/figure';

type Tone = 'default' | 'primary' | 'amber';

interface StatCardProps {
  title: string;
  /** Static value (string or node) — used when no numeric animation is needed */
  value?: ReactNode;
  /** Numeric value — animated counter; pass with `format` for currency, etc. */
  numericValue?: number;
  format?: (n: number) => string;
  subtitle?: ReactNode;
  icon?: React.ElementType;
  /** % vs previous period; pass null for "no comparison" */
  delta?: number | null;
  deltaInvert?: boolean;
  /** Highlight state — adds lime gradient background */
  accent?: boolean;
  /** Colour of the figure and icon */
  tone?: Tone;
  onClick?: () => void;
  /** Optional small content rendered below the subtitle (e.g. sparkline) */
  footer?: ReactNode;
}

const lift = { y: -2, transition: { duration: 0.15 } };

const TONES: Record<Tone, { text: string; icon: string }> = {
  default: { text: 'text-foreground', icon: 'bg-secondary text-muted-foreground' },
  primary: { text: 'text-primary', icon: 'bg-primary/15 text-primary' },
  amber: { text: 'text-amber-400', icon: 'bg-amber-500/15 text-amber-400' },
};

export function StatCard({
  title, value, numericValue, format,
  subtitle, icon: Icon, delta, deltaInvert,
  accent, tone, onClick, footer,
}: StatCardProps) {
  const t = TONES[tone ?? (accent ? 'primary' : 'default')];
  return (
    <motion.div whileHover={lift} className="h-full">
      <Card
        className={`relative h-full overflow-hidden transition-colors ${
          accent
            ? 'bg-gradient-to-br from-primary/15 via-primary/5 to-card border-primary/30'
            : 'bg-card border-border hover:border-primary/20'
        } ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        {accent && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />}
        <CardContent className="p-4">
          {/* Title row: label, change pill, icon */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium truncate">{title}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {delta !== undefined && <DeltaPill value={delta ?? null} invert={deltaInvert} size="xs" />}
              {Icon && (
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${t.icon}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* Figure: measures its space and shrinks to fit */}
          <div className="mt-2 min-w-0">
            {numericValue !== undefined && format ? (
              <Figure value={numericValue} format={format} className={t.text} />
            ) : (
              <p className={`text-[26px] font-semibold leading-none tracking-tight tabular whitespace-nowrap ${t.text}`}>
                {numericValue !== undefined ? <AnimatedNumber value={numericValue} format={format} /> : value}
              </p>
            )}
          </div>

          {subtitle && <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug truncate">{subtitle}</p>}
          {footer && <div className="mt-2">{footer}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
