import type { TeamMember } from '@/types';
import { motion } from 'framer-motion';

interface TeamRailItemProps {
  member: TeamMember;
  earnings?: number;
  format?: (n: number) => string;
  active?: boolean;
  onClick?: () => void;
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function colorForId(id: string) {
  // 8 stable hash colors
  const palette = [
    'bg-primary/15 text-primary',
    'bg-blue-400/15 text-blue-400',
    'bg-purple-400/15 text-purple-400',
    'bg-amber-400/15 text-amber-400',
    'bg-pink-400/15 text-pink-400',
    'bg-cyan-400/15 text-cyan-400',
    'bg-red-400/15 text-red-400',
    'bg-emerald-400/15 text-emerald-400',
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function TeamRailItem({ member, earnings, format, active, onClick }: TeamRailItemProps) {
  const Comp: any = onClick ? motion.button : motion.div;
  return (
    <Comp
      whileHover={onClick ? { x: 2 } : undefined}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left ${
        active ? 'bg-primary/10' : 'hover:bg-secondary/50'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`relative w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${colorForId(member.id)}`}>
        {initials(member.name)}
        {active && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary border-2 border-card rounded-full" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{member.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {member.role} · {member.type}
        </div>
      </div>
      {earnings !== undefined && earnings > 0 && (
        <div className="text-xs font-semibold tabular text-primary whitespace-nowrap">
          {format ? format(earnings) : earnings.toLocaleString()}
        </div>
      )}
    </Comp>
  );
}
