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
        <CardContent className="p-5">
          {/* Title row — label + icon */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              {title}
            </p>
            {Icon && (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                accent ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Value + delta on the same line */}
          <div className="flex items-baseline justify-between gap-2 mt-3 flex-wrap">
            <p className={`text-[26px] font-semibold leading-none tracking-tight tabular whitespace-nowrap ${accent ? 'text-primary' : 'text-foreground'}`}>
              {numericValue !== undefined ? (
                <AnimatedNumber value={numericValue} format={format} />
              ) : value}
            </p>
            {delta !== undefined && (
              <DeltaPill value={delta ?? null} invert={deltaInvert} size="xs" />
            )}
          </div>

          {/* Subtitle and footer below */}
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              {deltaLabel === undefined && delta !== undefined ? `${subtitle} · vs last month` : subtitle}
            </p>
          )}
          {footer && <div className="mt-2">{footer}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
