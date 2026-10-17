import type { AppState } from '@/types';

/**
 * Profit earned in a month = every client payment routed to Retained Profit
 * minus the project costs recorded that month under the project-money rule.
 * Project costs never touch Working Capital — they come straight out of profit.
 */
export function monthProfit(state: AppState, month: string): number {
  const earned = (state.wcTransactions || [])
    .filter((t: any) => t.category === 'client_to_retained' && t.date?.startsWith(month))
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  const costs = (state.billing?.expenses || [])
    .filter((e: any) => e.profitDeduction !== undefined && e.date?.startsWith(month))
    .reduce((sum: number, e: any) => sum + e.profitDeduction, 0);
  return earned - costs;
}
