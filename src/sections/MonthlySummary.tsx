import { useState, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { Calendar, Download, TrendingUp, Users, Briefcase, FileText, AlertTriangle, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

export function MonthlySummary() {
  const { state, formatCurrency, getActiveMembers, getMonthlySummary, getMemberMonthlyEarnings } = useApp();
  const { toast } = useToast();
  
  const activeMembers = getActiveMembers();
  const { revenueSplit } = state.settings;
  
  // Selected month
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Get monthly data
  const monthlyData = useMemo(() => {
    return getMonthlySummary(selectedMonth);
  }, [getMonthlySummary, selectedMonth]);

  // Derive confirmed status from billing data — fixes stale paymentStatus in localStorage
  const confirmedProjectIds = useMemo(() => {
    const ids = new Set<string>();
    state.projects.forEach((p: any) => {
      if (p.paymentStatus === 'confirmed') { ids.add(p.id); return; }
      if (!p.billingInvoiceId) return;
      const inv = (state.billing.documents || []).find((d: any) => d.id === p.billingInvoiceId);
      if (!inv) return;
      const totalPaid = (inv.payments || []).reduce((s: number, pay: any) => s + (pay.mwkEquivalent || pay.amount || 0), 0);
      if (totalPaid >= inv.total * (inv.exchangeRate || 1)) ids.add(p.id);
    });
    return ids;
  }, [state.projects, state.billing.documents]);

  // Projected vs confirmed — check payment status of all projects in this month
  const monthProjects = state.projects.filter(p => p.month === selectedMonth && p.type === 'client');
  const confirmedProjects = monthProjects.filter(p => confirmedProjectIds.has(p.id));
  const partialProjects = monthProjects.filter(p => !confirmedProjectIds.has(p.id) && (p.paymentStatus === 'partial' || (state.billing.documents || []).some((d: any) => d.id === p.billingInvoiceId && d.payments?.length > 0)));
  const projectedProjects = monthProjects.filter(p => !confirmedProjectIds.has(p.id) && !partialProjects.find(pp => pp.id === p.id));
  const _confirmedRevenue = confirmedProjects.reduce((s, p) => s + p.paidAmount, 0); void _confirmedRevenue;
  // Billing-only invoices (already paid — always confirmed)
  const billingInvoices: any[] = monthlyData.billingInvoices || [];
  const billingRevenue: number = monthlyData.billingRevenue || 0;
  const totalCount = monthProjects.length + billingInvoices.length;
  const totalConfirmed = confirmedProjects.length + billingInvoices.length; // billing invoices are always paid
  const hasAllConfirmed = totalCount > 0 && projectedProjects.length === 0 && partialProjects.length === 0;
  const hasNoneConfirmed = totalCount > 0 && totalConfirmed === 0;
  const paymentLabel = hasAllConfirmed ? 'CONFIRMED' : hasNoneConfirmed ? 'PROJECTED' : 'MIXED';
  const paymentColor = hasAllConfirmed ? 'text-primary' : hasNoneConfirmed ? 'text-amber-400' : 'text-blue-400';

  // Member breakdown with stipend + bonus
  const memberBreakdownData = useMemo(() => {
    return activeMembers.map(m => {
      const earnings = getMemberMonthlyEarnings(m.id, selectedMonth);
      const bankPoints = m.contributionBank.currentQuarterPoints;
      return {
        memberId: m.id,
        memberName: m.name,
        fullStipend: m.stipend,
        stipendPaid: m.stipend,
        stipendDeferred: 0,
        bonus: earnings.bonus,
        total: m.stipend + earnings.bonus,
        bankPoints,
        isContract: m.type === 'Contract',
      };
    });
  }, [activeMembers, selectedMonth, getMemberMonthlyEarnings]);

  // Available months
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(state.projects.map(p => p.month))).sort().reverse();
    return months;
  }, [state.projects]);

  // Member earnings for chart
  const memberEarnings = useMemo(() => {
    return activeMembers.map(m => {
      const earnings = getMemberMonthlyEarnings(m.id, selectedMonth);
      return {
        name: m.name.split(' ')[0],
        stipend: earnings.stipend,
        bonus: earnings.bonus,
        total: earnings.total,
      };
    }).sort((a, b) => b.total - a.total);
  }, [activeMembers, selectedMonth, getMemberMonthlyEarnings]);

  // Fund distribution pie data
  const fundDistributionData = useMemo(() => [
    { name: 'Company Fund', value: monthlyData.totalCompanyContributions, color: '#4a9edd' },
    { name: 'Bonus Pools', value: monthlyData.totalBonusPools, color: '#73F764' },
    { name: 'Stipends Paid', value: activeMembers.reduce((s,m) => s + m.stipend, 0), color: '#e0a840' },
  ].filter(d => d.value > 0), [monthlyData]);


  // Export CSV
  const exportCSV = useCallback(() => {
    const projects = state.projects.filter(p => p.month === selectedMonth);
    if (projects.length === 0) {
      toast({ title: 'Error', description: 'No data for this month', variant: 'destructive' });
      return;
    }
    
    const rows = [
      ['Monthly Summary', selectedMonth],
      [],
      ['REVENUE'],
      ['Total Gross Revenue (client projects)', monthlyData.totalRevenue],
      ['Total Direct Expenses', monthlyData.totalDirectExpenses],
      ['Total Project Net Profit', monthlyData.totalNetProfit],
      [],
      ['SPLIT'],
      ['Company Contributions', monthlyData.totalCompanyContributions],
      ['Total Bonus Pools', monthlyData.totalBonusPools],
      [],
      ['STIPENDS'],
      ['Total Stipends Owed', activeMembers.reduce((s,m) => s + m.stipend, 0)],
      ['Revenue Threshold Status', 'full'],
      ['Stipends Paid This Month', activeMembers.reduce((s,m) => s + m.stipend, 0)],
      ['Stipends Deferred', 0],
      [],
      ['NET POSITION'],
      ['Net Retained Profit', monthlyData.netCompanyFund],
      ['Total Bonuses Distributed', monthlyData.totalBonusPools],
      ['Projected Payroll', activeMembers.reduce((s,m) => s + m.stipend, 0) + monthlyData.totalBonusPools],
      [],
      ['PER MEMBER BREAKDOWN'],
      ['Name', 'Full Stipend', 'Stipend Paid', 'Stipend Deferred', 'Bonus Earned', 'Total'],
      ...memberBreakdownData.map(m => {
        const earnings = getMemberMonthlyEarnings(m.memberId, selectedMonth);
        return [m.memberName, m.fullStipend, m.stipendPaid, m.stipendDeferred, earnings.bonus, m.stipendPaid + earnings.bonus];
      }),
    ];
    
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspirex-summary-${selectedMonth}.csv`;
    a.click();
    
    toast({ title: 'Exported', description: 'Monthly summary exported to CSV' });
  }, [monthlyData, selectedMonth, state.projects, toast, getMemberMonthlyEarnings]);

  // Export Financial Report PDF — dark theme + logo
  const exportPDF = useCallback(() => {
    const projects = state.projects.filter(p => p.month === selectedMonth);
    if (projects.length === 0) {
      toast({ title: 'Error', description: 'No data for this month', variant: 'destructive' });
      return;
    }

    const [yr, mo] = selectedMonth.split('-');
    const mLabel = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const filename = `inspirex-financial-report-${selectedMonth}.pdf`;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const sym = state.settings.currencySymbol;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Dark background
    doc.setFillColor('#0D0D0D');
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const pdfRow = (left: string, right: string, highlight = false) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(highlight ? '#73F764' : '#CCCCCC');
      doc.text(left, margin, y);
      doc.text(right, pageWidth - margin, y, { align: 'right' });
      y += 6;
    };

    const pdfDivider = (thick = false) => {
      doc.setDrawColor(thick ? '#555555' : '#333333');
      doc.setLineWidth(thick ? 0.5 : 0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    const pdfSection = (text: string) => {
      y += 2;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#888888');
      doc.text(text.toUpperCase(), margin, y);
      y += 4;
      pdfDivider();
    };

    // ── Logo ──
    const billingLogo = state.billing.settings.logoBase64;
    if (billingLogo) {
      try {
        const ext = billingLogo.includes('image/png') ? 'PNG' : 'JPEG';
        const ti = document.createElement('img'); ti.src = billingLogo;
        const nw = ti.naturalWidth || 400, nh = ti.naturalHeight || 120;
        const lw = Math.min(Math.max(state.billing.settings.logoWidth || 50, 20), 80);
        const lh = state.billing.settings.logoHeight && state.billing.settings.logoHeight > 0
          ? state.billing.settings.logoHeight
          : Math.min(Math.max(+(lw * nh / nw).toFixed(1), 7), 22);
        doc.addImage(billingLogo, ext, margin, y - 2, lw, lh);
        y += lh + 2;
      } catch {
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.setTextColor('#FFFFFF'); doc.text('Inspire', margin, y);
        const iw = doc.getTextWidth('Inspire');
        doc.setTextColor('#73F764'); doc.text('X', margin + iw, y);
        y += 7;
      }
    } else {
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.setTextColor('#FFFFFF'); doc.text('Inspire', margin, y);
      const iw = doc.getTextWidth('Inspire');
      doc.setTextColor('#73F764'); doc.text('X', margin + iw, y);
      y += 7;
    }

    // Report label — top right
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor('#73F764');
    doc.text('FINANCIAL REPORT', pageWidth - margin, margin + 5, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#888888');
    doc.text(mLabel, pageWidth - margin, margin + 11, { align: 'right' });

    doc.setDrawColor('#73F764'); doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ── Revenue ──
    pdfSection('Revenue');
    pdfRow('Total Gross Revenue (Client Projects)', `${sym} ${monthlyData.totalRevenue.toLocaleString()}`);
    pdfRow('Total Direct Expenses', `-${sym} ${monthlyData.totalDirectExpenses.toLocaleString()}`);
    y += 5;
    pdfDivider(true);
    y += 2;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor('#73F764');
    doc.text('Total Project Net Profit', margin, y);
    doc.text(`${sym} ${monthlyData.totalNetProfit.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    y += 10;

    // ── Split ──
    pdfSection('Revenue Split');
    pdfRow(`Company Fund (${revenueSplit.companyPercent}%)`, `${sym} ${monthlyData.totalCompanyContributions.toLocaleString()}`);
    pdfRow(`Bonus Pools (${revenueSplit.bonusPercent}%)`, `${sym} ${monthlyData.totalBonusPools.toLocaleString()}`, true);
    y += 6;

    // ── Team Payroll ──
    const totalStipends = activeMembers.reduce((s, m) => s + m.stipend, 0);
    pdfSection('Team Payroll');
    pdfRow('Monthly Stipends Owed', `${sym} ${totalStipends.toLocaleString()}`);
    pdfRow('Total Bonus Pool Distributed', `${sym} ${monthlyData.totalBonusPools.toLocaleString()}`, true);
    y += 5;
    pdfDivider(true);
    y += 2;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor('#FFFFFF');
    doc.text('Projected Total Payroll', margin, y);
    doc.text(`${sym} ${(totalStipends + monthlyData.totalBonusPools).toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    y += 10;

    // ── Per Member Breakdown ──
    pdfSection('Per Member Breakdown');
    // 5-col layout across 170mm content:
    // Member(left) | Stipend(R=85) | Bonus(R=123) | Contrib.Pts(R=150) | Total(R=186)
    // Bonus→Contrib gap: 35mm — safe even when point values grow to 4 digits
    const c1  = margin + 3;              // Member, left-aligned
    const c2R = margin + 65;             // Stipend right edge   (= 85mm)
    const c3R = margin + 103;            // Bonus right edge     (= 123mm)
    const c4R = margin + 130;            // Contrib. Pts right edge (= 150mm) — right-aligned
    const c5  = pageWidth - margin - 4;  // Total right edge     (= 186mm)
    const memberTableStartY = y - 1;
    doc.setFillColor('#1a1a1a');
    doc.roundedRect(margin, y - 1, contentWidth, 7, 1.5, 1.5, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor('#888888');
    doc.text('Member', c1, y + 4);
    doc.text('Stipend', c2R, y + 4, { align: 'right' });
    doc.text('Bonus', c3R, y + 4, { align: 'right' });
    doc.text('Contrib. Pts', c4R, y + 4, { align: 'right' });
    doc.text('Total', c5, y + 4, { align: 'right' });
    y += 8;

    memberBreakdownData.forEach((m, i) => {
      const me = getMemberMonthlyEarnings(m.memberId, selectedMonth);
      if (i % 2 === 0) {
        doc.setFillColor('#111111');
        doc.rect(margin, y - 1, contentWidth, 7, 'F');
      }
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#CCCCCC');
      doc.text(m.memberName, c1, y + 4);
      doc.text(`${sym} ${Math.round(m.stipendPaid).toLocaleString()}`, c2R, y + 4, { align: 'right' });
      doc.setTextColor(me.bonus > 0 ? '#73F764' : '#CCCCCC');
      doc.text(`${sym} ${Math.round(me.bonus).toLocaleString()}`, c3R, y + 4, { align: 'right' });
      doc.setTextColor('#888888');
      doc.text(m.isContract ? '—' : `${m.bankPoints} pts`, c4R, y + 4, { align: 'right' });
      doc.setTextColor('#FFFFFF'); doc.setFont('helvetica', 'bold');
      doc.text(`${sym} ${Math.round(m.stipendPaid + me.bonus).toLocaleString()}`, c5, y + 4, { align: 'right' });
      y += 7;
    });
    // Outer rounded border around per-member table
    doc.setDrawColor('#2a2a2a'); doc.setLineWidth(0.3);
    doc.roundedRect(margin, memberTableStartY, contentWidth, y - memberTableStartY, 1.5, 1.5, 'S');
    y += 6;

    // ── Footer ──
    pdfDivider();
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#888888');
    doc.text(`Generated by InspireX OS · ${state.settings.companyName}`, margin, y);
    doc.text(new Date().toLocaleDateString('en-GB'), pageWidth - margin, y, { align: 'right' });

    doc.save(filename);
    toast({ title: '✓ Report downloaded', description: `${filename} saved to your Downloads folder` });
  }, [monthlyData, selectedMonth, state.projects, state.settings, state.billing.settings, activeMembers, getMemberMonthlyEarnings, revenueSplit, memberBreakdownData, toast]);

  // Get month name
  const monthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }, [selectedMonth]);

  // Generate PDF receipt for a member — dark theme + logo
  const generateReceipt = useCallback((memberId: string, memberName: string) => {
    const monthBreakdown = memberBreakdownData.find(m => m.memberId === memberId);
    const earnings = getMemberMonthlyEarnings(memberId, selectedMonth);
    const member = activeMembers.find(m => m.id === memberId);
    if (!monthBreakdown || !member) return;

    const monthProjects = state.projects.filter(p => p.month === selectedMonth && p.type === 'client');
    const projectBonuses = monthProjects
      .map(p => {
        const dist = p.distribution.find(d => d.memberId === memberId);
        return dist && dist.finalBonus > 0 ? { name: p.name, bonus: dist.finalBonus } : null;
      })
      .filter(Boolean) as { name: string; bonus: number }[];

    const bankPoints = member.contributionBank.currentQuarterPoints;
    const bankTier = state.settings.contributionBank.tiers.find(
      t => bankPoints >= t.minPoints && bankPoints <= t.maxPoints
    );
    const bankReward = bankTier ? Math.round(member.stipend * bankTier.rewardPercent / 100) : 0;

    const filename = `${memberName.replace(/\s+/g, '-')}-Receipt-${selectedMonth}.pdf`;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const sym = state.settings.currencySymbol;
    const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 20;

    // ── Dark background ──
    doc.setFillColor('#0D0D0D');
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const row = (left: string, right: string, highlight = false, indent = false) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(highlight ? '#73F764' : '#CCCCCC');
      doc.text(indent ? '  ' + left : left, margin, y);
      doc.text(right, pageWidth - margin, y, { align: 'right' });
      y += 6;
    };

    const divider = (thick = false) => {
      doc.setDrawColor(thick ? '#555555' : '#333333');
      doc.setLineWidth(thick ? 0.5 : 0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    const sectionTitle = (text: string) => {
      y += 2;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#888888');
      doc.text(text.toUpperCase(), margin, y);
      y += 4;
      divider();
    };

    // ── Logo / Header ──
    const billingLogo = state.billing.settings.logoBase64;
    const headerStartY = y;
    if (billingLogo) {
      try {
        const ext = billingLogo.includes('image/png') ? 'PNG' : 'JPEG';
        const ti = document.createElement('img'); ti.src = billingLogo;
        const nw = ti.naturalWidth || 400, nh = ti.naturalHeight || 120;
        const lw = Math.min(Math.max(state.billing.settings.logoWidth || 50, 20), 80);
        const lh = state.billing.settings.logoHeight && state.billing.settings.logoHeight > 0
          ? state.billing.settings.logoHeight
          : Math.min(Math.max(+(lw * nh / nw).toFixed(1), 7), 22);
        doc.addImage(billingLogo, ext, margin, y - 2, lw, lh);
        y += lh + 2;
      } catch {
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.setTextColor('#FFFFFF'); doc.text('Inspire', margin, y);
        const iw = doc.getTextWidth('Inspire');
        doc.setTextColor('#73F764'); doc.text('X', margin + iw, y);
        y += 7;
      }
    } else {
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.setTextColor('#FFFFFF'); doc.text('Inspire', margin, y);
      const iw = doc.getTextWidth('Inspire');
      doc.setTextColor('#73F764'); doc.text('X', margin + iw, y);
      y += 7;
    }

    // ── RECEIPT label — top right (aligned with logo) ──
    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor('#73F764');
    doc.text('RECEIPT', pageWidth - margin, headerStartY + 6, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#888888');
    doc.text('Monthly Earnings', pageWidth - margin, headerStartY + 13, { align: 'right' });

    // ── Green divider ──
    doc.setDrawColor('#73F764');
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ── Meta — left col left-aligned, right col right-aligned ──
    doc.setFontSize(8);
    doc.setTextColor('#888888');
    doc.text('TEAM MEMBER', margin, y);
    doc.text('ROLE', pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.setFontSize(11);
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.text(memberName, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(member.role, pageWidth - margin, y, { align: 'right' });
    y += 7;
    doc.setFontSize(8);
    doc.setTextColor('#888888');
    doc.text('MONTH', margin, y);
    doc.text('EMPLOYMENT TYPE', pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.setFontSize(11);
    doc.setTextColor('#FFFFFF');
    doc.text(monthLabel, margin, y);
    doc.text(member.type, pageWidth - margin, y, { align: 'right' });
    y += 10;

    // ── Earnings ──
    sectionTitle('Earnings Breakdown');
    row('Monthly Stipend', `${sym} ${monthBreakdown.fullStipend.toLocaleString()}`);
    row('Stipend Paid', `${sym} ${Math.round(monthBreakdown.stipendPaid).toLocaleString()}`, true);
    if (monthBreakdown.stipendDeferred > 0) {
      row('Stipend Deferred', `${sym} ${Math.round(monthBreakdown.stipendDeferred).toLocaleString()}`);
    }
    row('Project Bonuses', `${sym} ${Math.round(earnings.bonus).toLocaleString()}`, earnings.bonus > 0);
    projectBonuses.forEach(p => {
      row(p.name, `${sym} ${p.bonus.toLocaleString()}`, false, true);
    });
    y += 2;
    divider(true);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#73F764');
    doc.text('Total Received This Month', margin, y);
    doc.text(`${sym} ${Math.round(monthBreakdown.stipendPaid + earnings.bonus).toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    y += 10;

    // ── Contribution Bank ──
    sectionTitle(`Contribution Bank — ${state.currentQuarter}`);
    row('Points Accumulated This Quarter', `${bankPoints} pts`);
    row('Current Tier', bankTier ? `${bankTier.rewardPercent}% of stipend` : 'Below threshold');
    if (bankReward > 0) {
      row('Estimated Quarter-End Reward', `${sym} ${bankReward.toLocaleString()}`, true);
    }
    y += 6;

    // ── Footer ──
    divider();
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#888888');
    doc.text(`Generated by InspireX OS · ${state.settings.companyName}`, margin, y);
    doc.text(new Date().toLocaleDateString('en-GB'), pageWidth - margin, y, { align: 'right' });

    doc.save(filename);
    toast({ title: '✓ Receipt downloaded', description: `${filename} saved to your Downloads folder` });
  }, [monthlyData, selectedMonth, getMemberMonthlyEarnings, activeMembers, state.projects, state.settings, state.billing.settings, state.currentQuarter, toast]);

  // Send receipt email only
  const sendReceiptEmail = useCallback((memberId: string, memberName: string) => {
    const monthBreakdown = memberBreakdownData.find(m => m.memberId === memberId);
    const earnings = getMemberMonthlyEarnings(memberId, selectedMonth);
    const member = activeMembers.find(m => m.id === memberId);
    if (!member?.email || !monthBreakdown) return;

    const monthStr = new Date(selectedMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const bankPoints = member.contributionBank.currentQuarterPoints;
    const subject = encodeURIComponent(`${state.settings.companyName} — Earnings Receipt · ${monthStr}`);
    const body = encodeURIComponent(
      `Hi ${memberName.split(' ')[0]},\n\n` +
      `Please find your earnings breakdown for ${monthStr} below.\n\n` +
      `EARNINGS SUMMARY\n` +
      `───────────────────\n` +
      `Stipend Paid:     ${state.settings.currencySymbol} ${Math.round(monthBreakdown.stipendPaid).toLocaleString()}\n` +
      (monthBreakdown.stipendDeferred > 0 ? `Stipend Deferred: ${state.settings.currencySymbol} ${Math.round(monthBreakdown.stipendDeferred).toLocaleString()}\n` : '') +
      `Project Bonuses:  ${state.settings.currencySymbol} ${Math.round(earnings.bonus).toLocaleString()}\n` +
      `───────────────────\n` +
      `Total:            ${state.settings.currencySymbol} ${Math.round(monthBreakdown.stipendPaid + earnings.bonus).toLocaleString()}\n\n` +
      `Contribution Bank: ${bankPoints} pts this quarter\n\n` +
      `InspireX OS · ${state.settings.companyName}`
    );
    window.open(`mailto:${member.email}?subject=${subject}&body=${body}`);
    toast({ title: '✓ Email draft opened', description: `Draft ready for ${member.email} — attach the PDF receipt you downloaded` });
  }, [monthlyData, selectedMonth, getMemberMonthlyEarnings, activeMembers, state.settings, toast]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monthly Summary</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Financial overview and team earnings by month
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Label className="text-sm whitespace-nowrap">Select Month:</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-48 bg-secondary border-input"
            />
            {availableMonths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableMonths.slice(0, 6).map(m => (
                  <Button
                    key={m}
                    variant={m === selectedMonth ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMonth(m)}
                    className="text-xs"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Month Title */}
      <div className="text-xl font-medium">{monthName}</div>

      {monthlyData.totalRevenue === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No revenue found for this month.</p>
            <p className="text-sm mt-1">Record invoice payments in Billing or add projects in the Project Calculator.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* REVENUE Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Revenue</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                hasAllConfirmed ? 'bg-primary/10 text-primary' :
                hasNoneConfirmed ? 'bg-amber-500/10 text-amber-400' :
                'bg-blue-500/10 text-blue-400'
              }`}>{paymentLabel} · {totalConfirmed}/{totalCount} paid</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase">Total Received</div>
                  <div className="text-xl font-semibold mt-1">{formatCurrency(monthlyData.totalRevenue)}</div>
                  <div className={`text-xs mt-1 ${paymentColor}`}>{paymentLabel} · {totalCount} invoice{totalCount !== 1 ? 's' : ''}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase">Total Direct Expenses</div>
                  <div className="text-xl font-semibold mt-1 text-destructive">−{formatCurrency(monthlyData.totalDirectExpenses)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Project-specific costs</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border border-primary/30">
                <CardContent className="p-4">
                  <div className="text-xs text-primary uppercase">Net Profit</div>
                  <div className="text-xl font-semibold mt-1 text-primary">{formatCurrency(monthlyData.totalNetProfit)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Billing invoices breakdown */}
            {billingInvoices.length > 0 && (
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Billing Income — {billingInvoices.length} invoice{billingInvoices.length !== 1 ? 's' : ''} paid this month
                </div>
                {billingInvoices.map((inv: any) => {
                  const client = (state.billing.clients || []).find((c: any) => c.id === inv.clientId);
                  const monthPayments = (inv.payments || []).filter((p: any) => p.date?.startsWith(selectedMonth));
                  const invRevenue = monthPayments.reduce((s: number, p: any) => s + (p.mwkEquivalent || p.amount || 0), 0);
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-3 py-2 border-t border-border/50 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{inv.number}</span>
                        <span>{client?.name || '—'}</span>
                        {inv.isContractorProject && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Contractor</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">{inv.isContractorProject ? '100% retained' : `${state.settings.revenueSplit?.companyPercent ?? 60}/${state.settings.revenueSplit?.bonusPercent ?? 40} split`}</span>
                        <span className="font-semibold text-primary">{formatCurrency(invRevenue)}</span>
                      </div>
                    </div>
                  );
                })}
                {billingRevenue > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-secondary/20 text-xs font-medium">
                    <span className="text-muted-foreground">Billing subtotal</span>
                    <span>{formatCurrency(billingRevenue)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SPLIT Section */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Split</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-xs text-muted-foreground uppercase">Company Fund ({revenueSplit.companyPercent}%)</div>
                      <div className="text-xl font-semibold">{formatCurrency(monthlyData.totalCompanyContributions)}</div>
                      <div className={`text-xs mt-1 ${paymentColor}`}>{paymentLabel}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <div>
                      <div className="text-xs text-primary uppercase">Bonus Pools ({revenueSplit.bonusPercent}%)</div>
                      <div className="text-xl font-semibold text-primary">{formatCurrency(monthlyData.totalBonusPools)}</div>
                      <div className={`text-xs mt-1 ${paymentColor}`}>{paymentLabel}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* STIPENDS NOTE — now handled in Working Capital Bank */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Team Payroll</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase">Monthly Stipends Owed</div>
                  <div className="text-lg font-semibold mt-1">{formatCurrency(activeMembers.reduce((s,m) => s + m.stipend, 0))}</div>
                  <div className="text-xs text-muted-foreground mt-1">Paid from Working Capital Bank</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border border-primary/20">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase">Total Bonus Pool (40%)</div>
                  <div className="text-lg font-semibold mt-1 text-primary">{formatCurrency(monthlyData.totalBonusPools)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Distributed to team based on involvement scores
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
              💡 Stipends are paid from your <strong className="text-foreground">Working Capital Bank</strong> — not deducted from project profits. 
              Go to Working Capital to record stipend payments and track your operational expenses.
            </div>
          </div>

          {/* NET POSITION Section */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Net Position</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className={`bg-card border-border ${monthlyData.totalCompanyContributions < 0 ? 'border-destructive' : ''}`}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase">Net Retained Profit</div>
                  <div className={`text-xl font-semibold mt-1 ${monthlyData.totalCompanyContributions < 0 ? 'text-destructive' : ''}`}>
                    {formatCurrency(monthlyData.totalCompanyContributions)}
                  </div>
                  {monthlyData.totalCompanyContributions < 0 && (
                    <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Deficit warning
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-card border-border border-primary/30">
                <CardContent className="p-4">
                  <div className="text-xs text-primary uppercase">Total Bonuses Distributed</div>
                  <div className="text-xl font-semibold mt-1 text-primary">{formatCurrency(monthlyData.totalBonusPools)}</div>
                  <div className="text-xs text-muted-foreground mt-1">From 40% bonus pool · fully distributed</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs text-muted-foreground uppercase">Projected Payroll</div>
                      <div className="text-xl font-semibold">{formatCurrency(activeMembers.reduce((s,m) => s + m.stipend, 0) + monthlyData.totalBonusPools)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fund Distribution */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Fund Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={fundDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {fundDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          background: '#1e1e1e', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px'
                        }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Member Earnings Chart */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Member Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberEarnings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#9a9490" 
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9a9490" 
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => `${v/1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#1e1e1e', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px'
                        }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Bar dataKey="stipend" name="Stipend" fill="#e0a840" stackId="a" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="bonus" name="Bonus" fill="#73F764" stackId="a" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per Member Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Per Member Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {memberBreakdownData.map((m) => {
                  const earnings = getMemberMonthlyEarnings(m.memberId, selectedMonth);
                  const percentage = (m.stipendPaid / Math.max(m.fullStipend, 1)) * 100;
                  return (
                    <div key={m.memberId} className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                      <div className="w-32 flex-shrink-0">
                        <div className="font-medium text-sm">{m.memberName}</div>
                      </div>
                      <div className="flex-1 grid grid-cols-6 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Full Stipend</div>
                          <div>{formatCurrency(m.fullStipend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Paid</div>
                          <div className="text-primary">{formatCurrency(m.stipendPaid)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Deferred</div>
                          <div className={m.stipendDeferred > 0 ? 'text-amber-400' : ''}>
                            {formatCurrency(m.stipendDeferred)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Bonus</div>
                          <div className="text-primary">{formatCurrency(earnings.bonus)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Non-Rev Pts (Q)</div>
                          {m.isContract
                            ? <div className="text-muted-foreground">—</div>
                            : <div className="text-amber-400 font-medium">{m.bankPoints} pts</div>}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="font-semibold">{formatCurrency(m.stipendPaid + earnings.bonus)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                      <div className="w-16">
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground text-right mt-1">
                          {percentage.toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex gap-1 no-print">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 gap-1"
                          onClick={() => generateReceipt(m.memberId, m.memberName)}
                          title="Print / save receipt as PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Receipt
                        </Button>
                        {activeMembers.find(am => am.id === m.memberId)?.email && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 gap-1 text-primary border-primary/40"
                            onClick={() => sendReceiptEmail(m.memberId, m.memberName)}
                            title="Send receipt to email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </Button>
                        )}
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
