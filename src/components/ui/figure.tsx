import { AnimatedNumber } from '@/components/ui/animated-number';

/** Font size that keeps a figure inside a narrow card as it gets longer. */
export function figureSizeClass(text: string): string {
  const n = text.length;
  if (n <= 12) return 'text-[26px]';
  if (n <= 14) return 'text-[22px]';
  if (n <= 16) return 'text-[19px]';
  return 'text-[16px]';
}

/** Short form for very large amounts, e.g. "MK 12.3B". The exact figure goes in a tooltip. */
export function compactAmount(value: number, formatted: string): string {
  const prefix = (formatted.match(/^[^\d-]*/) || [''])[0];
  const abs = Math.abs(value);
  const units: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const n = (abs / size).toFixed(1).replace(/\.0$/, '');
      return `${prefix}${value < 0 ? '-' : ''}${n}${suffix}`;
    }
  }
  return formatted;
}

interface FigureProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

/** An animated currency figure that shrinks, then switches to short form, so it never spills out of its card. */
export function Figure({ value, format, className = '' }: FigureProps) {
  const full = format(value);
  const compact = full.length > 17;
  const shown = compact ? compactAmount(value, full) : full;
  const fmt = compact ? (n: number) => compactAmount(n, format(n)) : format;
  return (
    <p
      title={compact ? full : undefined}
      className={`${figureSizeClass(shown)} font-semibold leading-none tracking-tight tabular whitespace-nowrap min-w-0 ${className}`}
    >
      <AnimatedNumber value={value} format={fmt} />
    </p>
  );
}
