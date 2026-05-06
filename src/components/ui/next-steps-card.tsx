import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NextStep {
  id: string;
  label: string;
  detail?: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

interface NextStepsCardProps {
  steps: NextStep[];
  /** Optional headline; defaults to "Next steps" */
  title?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  emptyContent?: ReactNode;
}

export function NextStepsCard({ steps, title = 'Next steps', subtitle, emptyContent }: NextStepsCardProps) {
  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-card overflow-hidden">
      {/* decorative shimmer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_60%)] pointer-events-none" />
      <div className="relative p-5">
        <div className="flex items-start gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {steps.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-4">
            {emptyContent ?? "You're all caught up ✓"}
          </div>
        ) : (
          <ol className="space-y-1.5">
            {steps.map(s => {
              const Icon = s.icon;
              const Comp: any = s.onClick ? motion.button : motion.div;
              return (
                <Comp
                  key={s.id}
                  whileHover={s.onClick ? { x: 3 } : undefined}
                  onClick={s.onClick}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card/60 border border-border/50 hover:border-primary/30 transition-all ${
                    s.onClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {Icon && (
                    <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{s.label}</div>
                    {s.detail && <div className="text-[11px] text-muted-foreground truncate">{s.detail}</div>}
                  </div>
                  {s.onClick && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                </Comp>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
