import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BrandedTooltip } from '@/components/ui/branded-tooltip';

export interface CashFlowPoint {
  /** YYYY-MM */
  month: string;
  wc: number;
  retainedProfit: number;
}

interface CashFlowChartProps {
  data: CashFlowPoint[];
  format?: (n: number) => string;
  height?: number;
}

const monthLabel = (m: string) => {
  const [_, mm] = m.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.max(0, parseInt(mm) - 1)];
};

export function CashFlowChart({ data, format, height = 280 }: CashFlowChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ar-wc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#73F764" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#73F764" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ar-rp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.40} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={monthLabel}
            dy={6}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`}
            width={48}
          />
          <Tooltip content={<BrandedTooltip format={format} titleFormat={monthLabel} />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="retainedProfit" name="Retained Profit" stroke="#a78bfa" strokeWidth={2} fill="url(#ar-rp)" animationDuration={900} />
          <Area type="monotone" dataKey="wc"             name="WC Balance"   stroke="#73F764" strokeWidth={2.5} fill="url(#ar-wc)" animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
