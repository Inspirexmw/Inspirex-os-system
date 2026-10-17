import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/animated-number';

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

const MAX_SIZE = 26;
const MIN_SIZE = 15;

interface FigureProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

/**
 * An animated currency figure that measures the space it has and shrinks to fit,
 * whatever the screen or card width. If it would need to go smaller than a readable
 * size it switches to short form (MK 12.3B) with the exact amount in a tooltip.
 */
export function Figure({ value, format, className = '' }: FigureProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(MAX_SIZE);
  const [compact, setCompact] = useState(false);
  const full = format(value);

  useLayoutEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      const probe = measureRef.current;
      if (!wrap || !probe) return;
      const available = wrap.clientWidth;
      const needed = probe.offsetWidth; // full text measured at MAX_SIZE
      if (!available || !needed) return;
      if (needed <= available) { setSize(MAX_SIZE); setCompact(false); return; }
      const scaled = Math.floor((MAX_SIZE * available) / needed);
      if (scaled >= MIN_SIZE) { setSize(scaled); setCompact(false); }
      else { setSize(MAX_SIZE); setCompact(true); }
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (observer && wrapRef.current) observer.observe(wrapRef.current);
    return () => observer?.disconnect();
  }, [full]);

  const fmt = compact ? (n: number) => compactAmount(n, format(n)) : format;
  return (
    <div ref={wrapRef} className="relative w-full min-w-0 overflow-hidden" style={{ height: MAX_SIZE + 4 }} title={compact ? full : undefined}>
      {/* invisible probe: the full figure at full size, used only to measure */}
      <span
        ref={measureRef}
        aria-hidden
        className="absolute left-0 top-0 invisible whitespace-nowrap font-semibold tracking-tight tabular"
        style={{ fontSize: MAX_SIZE }}
      >
        {full}
      </span>
      <p
        className={`font-semibold leading-none tracking-tight tabular whitespace-nowrap absolute left-0 bottom-0 ${className}`}
        style={{ fontSize: size }}
      >
        <AnimatedNumber value={value} format={fmt} />
      </p>
    </div>
  );
}
