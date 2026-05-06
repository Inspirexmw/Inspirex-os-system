import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText, Wallet, Users, TrendingUp, Receipt, Settings as SettingsIcon, Activity } from 'lucide-react';

export type ActivityKind =
  | 'payment_received'
  | 'project_created'
  | 'scores_saved'
  | 'stipend_paid'
  | 'transfer'
  | 'invoice_created'
  | 'expense'
  | 'setting_changed'
  | 'other';

const KIND_META: Record<ActivityKind, { icon: React.ElementType; tone: string }> = {
  payment_received: { icon: TrendingUp,    tone: 'text-primary  bg-primary/10' },
  project_created:  { icon: FileText,      tone: 'text-blue-400 bg-blue-400/10' },
  scores_saved:     { icon: CheckCircle2,  tone: 'text-purple-400 bg-purple-400/10' },
  stipend_paid:     { icon: Users,         tone: 'text-amber-400 bg-amber-400/10' },
  transfer:         { icon: Wallet,        tone: 'text-cyan-400 bg-cyan-400/10' },
  invoice_created:  { icon: Receipt,       tone: 'text-pink-400 bg-pink-400/10' },
  expense:          { icon: Wallet,        tone: 'text-red-400 bg-red-400/10' },
  setting_changed:  { icon: SettingsIcon,  tone: 'text-muted-foreground bg-secondary' },
  other:            { icon: Activity,      tone: 'text-muted-foreground bg-secondary' },
};

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  amount?: number;
  /** ISO timestamp */
  at: string;
}

function relative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface ActivityFeedProps {
  items: ActivityItem[];
  emptyText?: string;
  format?: (n: number) => string;
}

export function ActivityFeed({ items, emptyText = 'No recent activity', format }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-6 text-center">{emptyText}</div>
    );
  }
  return (
    <ol className="relative space-y-1">
      {items.map((item, i) => {
        const meta = KIND_META[item.kind];
        const Icon = meta.icon;
        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: i * 0.03 }}
            className="flex items-start gap-3 py-2"
          >
            <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.tone}`}>
              <Icon className="w-3.5 h-3.5" />
              {i < items.length - 1 && (
                <span className="absolute top-full left-1/2 w-px h-4 -translate-x-1/2 bg-border" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground leading-tight truncate">{item.title}</p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{relative(item.at)}</span>
              </div>
              {(item.detail || item.amount !== undefined) && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {item.detail}
                  {item.amount !== undefined && (
                    <span className="ml-1 font-medium tabular text-foreground">
                      {format ? format(item.amount) : item.amount.toLocaleString()}
                    </span>
                  )}
                </p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Section wrapper (used in the right rail) */
export function RailSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
