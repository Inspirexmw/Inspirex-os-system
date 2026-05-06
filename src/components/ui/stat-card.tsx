import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { DeltaPill } from '@/components/ui/delta-pill';

interface StatCardProps {
  title: string;
  /** Static value (string or node) — used when no numeric animation is needed */
  value?: ReactNode;
  /** Numeric value — animated counter; pass with `format` for currency, etc. */
  numericValue?: number;
  format?: (n: number) => string;
  subtitle?: string;
  icon?: React.ElementType;
  /** % vs previous period; pass null for "no comparison" */
  delta?: number | null;
  deltaInvert?: boolean;
  deltaLabel?: string;
  /** Highlight state — adds lime gradient background */
  accent?: boolean;
  onClick?: () => void;
  /** Optional small content rendered below the delta (e.g. sparkline) */
  footer?: ReactNode;
}

const lift = { y: -2, transition: { duration: 0.15 } };

export function StatCard({
  title, value, numericValue, format,
  subtitle, icon: Icon, delta, deltaInvert, deltaLabel,
  accent, onClick, footer,
}: StatCardProps) {
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
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                {title}
              </p>
              <p className={`text-3xl font-semibold leading-none mt-3 tracking-tight tabular ${accent ? 'text-primary' : 'text-foreground'}`}>
                {numericValue !== undefined ? (
                  <AnimatedNumber value={numericValue} format={format} />
                ) : value}
              </p>
              {delta !== undefined && (
                <div className="mt-3">
                  <DeltaPill value={delta ?? null} label={deltaLabel ?? 'vs last month'} invert={deltaInvert} />
                </div>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{subtitle}</p>
              )}
              {footer && <div className="mt-3">{footer}</div>}
            </div>
            {Icon && (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                accent ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
