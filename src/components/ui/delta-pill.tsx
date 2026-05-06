import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface DeltaPillProps {
  value: number | null;
  label?: string;
  invert?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}

export function DeltaPill({ value, label, invert = false, size = 'sm', className = '' }: DeltaPillProps) {
  if (value === null || !isFinite(value)) {
    return (
      <span className={`inline-flex items-center gap-1 ${size === 'xs' ? 'text-[10px]' : 'text-[11px]'} text-muted-foreground ${className}`}>
        <Minus className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> no data
      </span>
    );
  }

  const rounded = Math.round(value * 10) / 10;
  const isZero = rounded === 0;
  const positive = rounded > 0;
  const good = invert ? !positive : positive;

  const tone = isZero
    ? 'bg-muted/40 text-muted-foreground'
    : good
    ? 'bg-primary/15 text-primary'
    : 'bg-destructive/15 text-destructive';

  const Icon = isZero ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  const sign = positive ? '+' : '';
  const sz = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  const ic = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`inline-flex items-center gap-0.5 rounded-md font-medium tabular ${sz} ${tone}`}>
        <Icon className={ic} />
        {sign}{rounded}%
      </span>
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
    </span>
  );
}
