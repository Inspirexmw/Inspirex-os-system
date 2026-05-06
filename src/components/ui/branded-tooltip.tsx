interface BrandedTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
  format?: (n: number) => string;
  titleFormat?: (label: string) => string;
}

/** Decko-style floating pill tooltip for Recharts. */
export function BrandedTooltip({ active, payload, label, format, titleFormat }: BrandedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl bg-[#0a0a0a] border border-white/10 shadow-2xl backdrop-blur-md px-3 py-2.5 min-w-[160px]">
      {label && (
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1.5">
          {titleFormat ? titleFormat(label) : label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground text-xs">{entry.name}</span>
            </div>
            <span className="font-semibold tabular text-foreground">
              {format ? format(entry.value) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
