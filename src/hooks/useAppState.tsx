import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  AppState,
  TeamMember,
  Project,
  WorkLogEntry,
  SystemSettings,
  CommitmentData,
  MonthlyStipendBreakdown,
  ContributionBankTier,
  WCTransaction,
  WCCategory,
  BillingState,
  BillingClient,
  BillingDocument,
  BillingSettings,
  BillingPayment,
  InvoiceStatus,
  Expense,
  RecurringSchedule,
  AppNotification,
  TaskProject,
  TaskProjectScore,
  ProjectDistribution,
} from '@/types';
import { 
  DEFAULT_SETTINGS, 
  DEFAULT_MEMBERS, 
  DEFAULT_BILLING_SETTINGS,
  getCurrentQuarter
} from '@/types';

const STORAGE_KEY = 'inspirex_os_v1';
const SETTINGS_KEY = 'inspirex_settings';

// Generate IDs for default members
const generateDefaultMembers = (): TeamMember[] => {
  return DEFAULT_MEMBERS.map((m, i) => ({
    ...m,
    id: `member_${i + 1}`,
  }));
};

const initialBillingState: BillingState = {
  clients: [],
  documents: [],
  expenses: [],
  recurringSchedules: [],
  settings: DEFAULT_BILLING_SETTINGS,
  counters: { quote: 0, invoice: 0, receipt: 0 },
};

const initialState: AppState = {
  members: generateDefaultMembers(),
  projects: [],
  taskProjects: [],
  workLog: [],
  settings: DEFAULT_SETTINGS,
  wcTransactions: [],
  wcBalance: 0,
  retainedProfit: 0,
  bonusBankBalance: 0,
  bonusBankTransactions: [],
  currentQuarter: getCurrentQuarter(),
  lastAutoTransferMonth: '',
  notifications: [],
  billing: initialBillingState,
};

type Action =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'LOAD_SETTINGS'; payload: SystemSettings }
  | { type: 'RESET_STATE' }
  | { type: 'ADD_MEMBER'; payload: TeamMember }
  | { type: 'UPDATE_MEMBER'; payload: TeamMember }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'ADD_WORK_LOG'; payload: WorkLogEntry }
  | { type: 'UPDATE_WORK_LOG'; payload: WorkLogEntry }
  | { type: 'REMOVE_WORK_LOG'; payload: string }
  | { type: 'BULK_ADD_WORK_LOG'; payload: WorkLogEntry[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<SystemSettings> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'IMPORT_DATA'; payload: AppState }
  | { type: 'CLEAR_ALL_DATA' }
  | { type: 'UPDATE_CONTRIBUTION_BANK'; payload: { memberId: string; points: number; quarter: string } }
  | { type: 'SET_QUARTERLY_RELIABILITY'; payload: { memberId: string; quarter: string; score: number } }
  | { type: 'SET_QUARTERLY_NOTE'; payload: { memberId: string; quarter: string; note: string } }
  | { type: 'PAY_DEFERRED_STIPENDS'; payload: { month: string; amount: number } }
  | { type: 'RESET_QUARTER_POINTS' }
  | { type: 'ADD_WC_TRANSACTION'; payload: import('@/types').WCTransaction }
  | { type: 'SET_WC_BALANCE'; payload: number }
  | { type: 'CLEAR_WC_DATA' }
  | { type: 'ADD_BONUS_BANK_TRANSACTION'; payload: import('@/types').BonusBankTransaction }
  | { type: 'DELETE_BONUS_BANK_TRANSACTION'; payload: string }
  | { type: 'CLEAR_BONUS_BANK_DATA' }
  | { type: 'LINK_PAYMENT_TO_WC'; payload: { projectId: string; paymentId: string; wcTransactionId: string } }
  | { type: 'DELETE_WC_TRANSACTION'; payload: string }
  | { type: 'EDIT_WC_TRANSACTION'; payload: { id: string; description: string; category: import('@/types').WCCategory; date: string } }
  | { type: 'PAY_MEMBER_STIPEND'; payload: { memberId: string; amount: number; wcTransactionId: string } }
  | { type: 'UPDATE_RETAINED_PROFIT'; payload: number }
  | { type: 'BILLING_ADD_CLIENT'; payload: BillingClient }
  | { type: 'BILLING_UPDATE_CLIENT'; payload: BillingClient }
  | { type: 'BILLING_DELETE_CLIENT'; payload: string }
  | { type: 'BILLING_ADD_DOCUMENT'; payload: BillingDocument }
  | { type: 'BILLING_UPDATE_DOCUMENT'; payload: BillingDocument }
  | { type: 'BILLING_DELETE_DOCUMENT'; payload: string }
  | { type: 'BILLING_UPDATE_SETTINGS'; payload: Partial<BillingSettings> }
  | { type: 'BILLING_ADD_PAYMENT'; payload: { documentId: string; payment: BillingPayment } }
  | { type: 'SYNC_PROJECT_PAYMENT_STATUS'; payload: { projectId: string; paidAmount: number; status: 'projected' | 'partial' | 'confirmed' } }
  | { type: 'ADD_RETAINED_PROFIT'; payload: number }
  | { type: 'MARK_AUTO_TRANSFER_HANDLED'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: AppNotification }
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'REVERSE_NOTIFICATION'; payload: string }
  | { type: 'RECURRING_ADD'; payload: RecurringSchedule }
  | { type: 'RECURRING_UPDATE'; payload: RecurringSchedule }
  | { type: 'RECURRING_DELETE'; payload: string }
  | { type: 'EXPENSE_ADD'; payload: Expense }
  | { type: 'EXPENSE_UPDATE'; payload: Expense }
  | { type: 'EXPENSE_DELETE'; payload: string }
  | { type: 'ADD_PROJECT_TASK'; payload: { taskProjectId: string; task: import('@/types').ProjectTask } }
  | { type: 'UPDATE_PROJECT_TASK'; payload: { taskProjectId: string; taskId: string; updates: Partial<import('@/types').ProjectTask> } }
  | { type: 'DELETE_PROJECT_TASK'; payload: { taskProjectId: string; taskId: string } }
  | { type: 'ADD_TASK_PROJECT'; payload: TaskProject }
  | { type: 'UPDATE_TASK_PROJECT'; payload: TaskProject }
  | { type: 'DELETE_TASK_PROJECT'; payload: string }
  | { type: 'SAVE_PROJECT_SCORES'; payload: { taskProjectId: string; scores: TaskProjectScore[] } };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return {
        ...action.payload,
        wcTransactions: action.payload.wcTransactions || [],
        wcBalance: action.payload.wcBalance || 0,
        retainedProfit: action.payload.retainedProfit || 0,
        bonusBankBalance: action.payload.bonusBankBalance || 0,
        bonusBankTransactions: action.payload.bonusBankTransactions || [],
        billing: {
          clients: action.payload.billing?.clients || [],
          documents: action.payload.billing?.documents || [],
          expenses: action.payload.billing?.expenses || [],
          recurringSchedules: action.payload.billing?.recurringSchedules || [],
          settings: {
            ...DEFAULT_BILLING_SETTINGS,
            ...(action.payload.billing?.settings || {}),
            logoWidth: action.payload.billing?.settings?.logoWidth ?? 50,
            logoHeight: action.payload.billing?.settings?.logoHeight ?? 0,
            reminderBefore7: action.payload.billing?.settings?.reminderBefore7 ?? true,
            reminderOnDue: action.payload.billing?.settings?.reminderOnDue ?? true,
            reminderAfter7: action.payload.billing?.settings?.reminderAfter7 ?? true,
            reminderAfter14: action.payload.billing?.settings?.reminderAfter14 ?? false,
            invoicePrefix: action.payload.billing?.settings?.invoicePrefix ?? 'INV',
            quotePrefix: action.payload.billing?.settings?.quotePrefix ?? 'QT',
            receiptPrefix: action.payload.billing?.settings?.receiptPrefix ?? 'RCP',
            companyCode: action.payload.billing?.settings?.companyCode ?? 'INSPX',
            invoiceStartNumber: action.payload.billing?.settings?.invoiceStartNumber ?? 1,
            emailSignature: action.payload.billing?.settings?.emailSignature ?? '',
          },
          counters: action.payload.billing?.counters || { quote: 0, invoice: 0, receipt: 0 },
        },
        members: (action.payload.members || []).map((m: any) => ({
          quarterlyNotes: {},
          ...m,
        })),
        projects: (action.payload.projects || []).map((p: any) => ({
          payments: [],
          paymentStatus: 'projected',
          paidAmount: 0,
          tasks: [],
          ...p,
        })),
        taskProjects: action.payload.taskProjects || [],
        notifications: action.payload.notifications || [],
        lastAutoTransferMonth: action.payload.lastAutoTransferMonth || '',
        settings: {
          ...DEFAULT_SETTINGS,
          ...(action.payload.settings || {}),
          workingCapital: {
            ...DEFAULT_SETTINGS.workingCapital,
            ...((action.payload.settings || {}).workingCapital || {}),
            runwayRedThreshold: ((action.payload.settings || {}).workingCapital || {}).runwayRedThreshold ?? 3,
            runwayAmberThreshold: ((action.payload.settings || {}).workingCapital || {}).runwayAmberThreshold ?? 6,
          },
        },
      };
    case 'LOAD_SETTINGS':
      return { ...state, settings: action.payload };
    case 'RESET_STATE':
      return { ...initialState, settings: state.settings };
    case 'ADD_MEMBER':
      return { ...state, members: [...state.members, action.payload] };
    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map(m => m.id === action.payload.id ? action.payload : m),
      };
    case 'REMOVE_MEMBER':
      return {
        ...state,
        members: state.members.map(m => m.id === action.payload ? { ...m, isActive: false } : m),
      };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, {
        ...action.payload,
        paymentStatus: action.payload.paymentStatus || 'projected',
        paidAmount: action.payload.paidAmount || 0,
      }] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p),
      };
    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
      };
    case 'ADD_PROJECT_TASK':
      return {
        ...state,
        taskProjects: (state.taskProjects || []).map(tp =>
          tp.id === action.payload.taskProjectId
            ? { ...tp, tasks: [...(tp.tasks || []), action.payload.task] }
            : tp
        ),
      };
    case 'UPDATE_PROJECT_TASK':
      return {
        ...state,
        taskProjects: (state.taskProjects || []).map(tp =>
          tp.id === action.payload.taskProjectId
            ? { ...tp, tasks: (tp.tasks || []).map(t => t.id === action.payload.taskId ? { ...t, ...action.payload.updates } : t) }
            : tp
        ),
      };
    case 'DELETE_PROJECT_TASK':
      return {
        ...state,
        taskProjects: (state.taskProjects || []).map(tp =>
          tp.id === action.payload.taskProjectId
            ? { ...tp, tasks: (tp.tasks || []).filter(t => t.id !== action.payload.taskId) }
            : tp
        ),
      };
    case 'ADD_TASK_PROJECT':
      return { ...state, taskProjects: [...(state.taskProjects || []), action.payload] };
    case 'UPDATE_TASK_PROJECT':
      return { ...state, taskProjects: (state.taskProjects || []).map(tp => tp.id === action.payload.id ? action.payload : tp) };
    case 'DELETE_TASK_PROJECT':
      return { ...state, taskProjects: (state.taskProjects || []).filter(tp => tp.id !== action.payload) };
    case 'SAVE_PROJECT_SCORES': {
      const { taskProjectId, scores } = action.payload;
      const taskProject = (state.taskProjects || []).find(tp => tp.id === taskProjectId);
      const updatedTaskProjects = (state.taskProjects || []).map(tp =>
        tp.id === taskProjectId ? { ...tp, scores } : tp
      );
      // Update matching Calculator project distribution if linked by billingInvoiceId
      let updatedProjects = state.projects;
      if (taskProject?.billingInvoiceId) {
        const linkedProject = state.projects.find(p => p.billingInvoiceId === taskProject.billingInvoiceId);
        if (linkedProject) {
          const totalPts = scores.reduce((s, sc) => s + sc.totalPoints, 0);
          const newDist: ProjectDistribution[] = scores
            .filter(sc => sc.totalPoints > 0)
            .map(sc => {
              const member = state.members.find(m => m.id === sc.memberId);
              const share = totalPts > 0 ? sc.totalPoints / totalPts : 0;
              const base = linkedProject.bonusPool * share;
              return {
                memberId: sc.memberId,
                memberName: member?.name || '',
                scores: { deliverables: sc.deliverables, responsibility: sc.responsibility, quality: sc.quality },
                totalScore: sc.totalPoints,
                sharePercent: share * 100,
                baseBonus: Math.round(base),
                performanceMultiplier: 1.0,
                finalBonus: Math.round(base),
              };
            });
          // Fix rounding drift: ensure sum of finalBonus equals the pool exactly.
          // Math.round on each member's share can drift the sum by ±N — absorb it into the largest share.
          if (newDist.length > 0) {
            const targetPool = Math.round(linkedProject.bonusPool);
            const sum = newDist.reduce((s, d) => s + d.finalBonus, 0);
            const drift = targetPool - sum;
            if (drift !== 0) {
              const largestIdx = newDist.reduce(
                (maxI, d, i, arr) => d.finalBonus > arr[maxI].finalBonus ? i : maxI, 0);
              newDist[largestIdx] = {
                ...newDist[largestIdx],
                baseBonus: newDist[largestIdx].baseBonus + drift,
                finalBonus: newDist[largestIdx].finalBonus + drift,
              };
            }
          }
          updatedProjects = state.projects.map(p =>
            p.id === linkedProject.id ? { ...p, distribution: newDist } : p
          );
        }
      }
      return { ...state, taskProjects: updatedTaskProjects, projects: updatedProjects };
    }
    case 'ADD_WORK_LOG':
      return { ...state, workLog: [...state.workLog, action.payload] };
    case 'UPDATE_WORK_LOG':
      return {
        ...state,
        workLog: state.workLog.map(e => e.id === action.payload.id ? action.payload : e),
      };
    case 'REMOVE_WORK_LOG':
      return {
        ...state,
        workLog: state.workLog.filter(e => e.id !== action.payload),
      };
    case 'BULK_ADD_WORK_LOG':
      return { ...state, workLog: [...state.workLog, ...action.payload] };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'RESET_SETTINGS':
      return { ...state, settings: DEFAULT_SETTINGS };
    case 'IMPORT_DATA':
      return { ...action.payload };
    case 'CLEAR_ALL_DATA':
      return { ...initialState, settings: state.settings };
    case 'UPDATE_CONTRIBUTION_BANK':
      return {
        ...state,
        members: state.members.map(m => {
          if (m.id !== action.payload.memberId) return m;
          return {
            ...m,
            contributionBank: {
              ...m.contributionBank,
              currentQuarterPoints: m.contributionBank.currentQuarterPoints + action.payload.points,
            },
          };
        }),
      };
    case 'SET_QUARTERLY_RELIABILITY': {
      const { memberId, quarter, score } = action.payload;
      return {
        ...state,
        members: state.members.map(m => {
          if (m.id !== memberId) return m;
          if (score === -1) {
            // Clear override — remove key
            const newReliability = { ...m.quarterlyReliability };
            delete newReliability[quarter];
            return { ...m, quarterlyReliability: newReliability };
          }
          return {
            ...m,
            quarterlyReliability: { ...m.quarterlyReliability, [quarter]: score },
          };
        }),
      };
    }
    case 'SET_QUARTERLY_NOTE': {
      const { memberId, quarter, note } = action.payload;
      return {
        ...state,
        members: state.members.map(m =>
          m.id !== memberId ? m : {
            ...m,
            quarterlyNotes: { ...m.quarterlyNotes, [quarter]: note },
          }
        ),
      };
    }
    case 'PAY_DEFERRED_STIPENDS':
      return {
        ...state,
        members: state.members.map(m => ({ ...m, deferredStipendBalance: 0 })),
      };
    case 'RESET_QUARTER_POINTS':
      return {
        ...state,
        members: state.members.map(m => ({
          ...m,
          contributionBank: { ...m.contributionBank, currentQuarterPoints: 0 },
        })),
      };
    case 'ADD_WC_TRANSACTION': {
      const isFromProfit = action.payload.category === 'profit_to_wc_operations' ||
                           action.payload.category === 'profit_to_wc_capital';
      const isToRetained = action.payload.category === 'client_to_retained';
      const newBalance = action.payload.type === 'inflow'
        ? state.wcBalance + action.payload.amount
        : state.wcBalance - action.payload.amount;
      const updatedTx = { ...action.payload, balanceAfter: newBalance };
      return {
        ...state,
        wcTransactions: [...state.wcTransactions, updatedTx],
        wcBalance: newBalance,
        retainedProfit: isFromProfit
          ? Math.max(0, state.retainedProfit - action.payload.amount)
          : isToRetained
          ? state.retainedProfit + action.payload.amount
          : state.retainedProfit,
      };
    }
    case 'SET_WC_BALANCE':
      return { ...state, wcBalance: action.payload };
    case 'CLEAR_WC_DATA':
      return { ...state, wcTransactions: [], wcBalance: 0, retainedProfit: 0 };

    case 'ADD_BONUS_BANK_TRANSACTION': {
      const newBalance = action.payload.type === 'credit'
        ? (state.bonusBankBalance || 0) + action.payload.amount
        : (state.bonusBankBalance || 0) - action.payload.amount;
      return {
        ...state,
        bonusBankTransactions: [...(state.bonusBankTransactions || []), { ...action.payload, balanceAfter: newBalance }],
        bonusBankBalance: newBalance,
      };
    }
    case 'DELETE_BONUS_BANK_TRANSACTION': {
      const txId = action.payload;
      const remaining = (state.bonusBankTransactions || []).filter(t => t.id !== txId);
      // Recalculate running balanceAfter chronologically
      const sorted = [...remaining].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let running = 0;
      const recalculated = sorted.map(t => {
        running = t.type === 'credit' ? running + t.amount : running - t.amount;
        return { ...t, balanceAfter: running };
      });
      return {
        ...state,
        bonusBankTransactions: recalculated,
        bonusBankBalance: recalculated.length > 0 ? recalculated[recalculated.length - 1].balanceAfter : 0,
      };
    }
    case 'CLEAR_BONUS_BANK_DATA':
      return { ...state, bonusBankTransactions: [], bonusBankBalance: 0 };

    case 'UPDATE_RETAINED_PROFIT':
      return { ...state, retainedProfit: action.payload };

    case 'PAY_MEMBER_STIPEND': {
      const { memberId, amount } = action.payload;
      return {
        ...state,
        members: state.members.map(m => {
          if (m.id !== memberId) return m;
          const fullStipend = m.stipend;
          const deferred = m.deferredStipendBalance || 0;
          const totalOwed = fullStipend + deferred;
          const shortfall = Math.max(0, totalOwed - amount);
          // If paying less than owed, add shortfall to deferred
          // If paying more than stipend, reduce existing deferred
          const newDeferred = amount >= totalOwed ? 0 : shortfall;
          return { ...m, deferredStipendBalance: newDeferred };
        }),
      };
    }

    case 'DELETE_WC_TRANSACTION': {
      const txId = action.payload;
      const txToDelete = state.wcTransactions.find(t => t.id === txId);
      if (!txToDelete) return state;

      // Remove the transaction
      const remaining = state.wcTransactions.filter(t => t.id !== txId);

      // Recalculate balanceAfter for all subsequent transactions chronologically
      const sorted = [...remaining].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      let runningBalance = 0;
      const recalculated = sorted.map(t => {
        runningBalance = t.type === 'inflow'
          ? runningBalance + t.amount
          : runningBalance - t.amount;
        return { ...t, balanceAfter: runningBalance };
      });

      // Unlink from project payment if linked
      const updatedProjects = state.projects.map(p => ({
        ...p,
        payments: (p.payments || []).map(pay =>
          pay.wcTransactionId === txId ? { ...pay, wcTransactionId: undefined } : pay
        ),
      }));

      // Recalculate retained profit if was a profit transfer or client-to-retained
      let newRetained = state.retainedProfit;
      if (txToDelete.category === 'profit_to_wc_operations' || txToDelete.category === 'profit_to_wc_capital') {
        newRetained = state.retainedProfit + txToDelete.amount;
      } else if (txToDelete.category === 'client_to_retained') {
        newRetained = Math.max(0, state.retainedProfit - txToDelete.amount);
      }

      return {
        ...state,
        wcTransactions: recalculated,
        wcBalance: recalculated.length > 0 ? recalculated[recalculated.length - 1].balanceAfter : 0,
        retainedProfit: newRetained,
        projects: updatedProjects,
      };
    }

    case 'EDIT_WC_TRANSACTION': {
      const { id, description, category, date } = action.payload;
      return {
        ...state,
        wcTransactions: state.wcTransactions.map(t =>
          t.id === id ? { ...t, description, category, date } : t
        ),
      };
    }





    case 'LINK_PAYMENT_TO_WC':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                payments: (p.payments || []).map(pay =>
                  pay.id === action.payload.paymentId
                    ? { ...pay, wcTransactionId: action.payload.wcTransactionId }
                    : pay
                ),
              }
            : p
        ),
      };
    case 'BILLING_ADD_CLIENT':
      return { ...state, billing: { ...state.billing, clients: [...state.billing.clients, action.payload] } };
    case 'BILLING_UPDATE_CLIENT':
      return { ...state, billing: { ...state.billing, clients: state.billing.clients.map(c => c.id === action.payload.id ? action.payload : c) } };
    case 'BILLING_DELETE_CLIENT':
      return { ...state, billing: { ...state.billing, clients: state.billing.clients.filter(c => c.id !== action.payload) } };
    case 'BILLING_ADD_DOCUMENT': {
      const doc = action.payload;
      const counters = { ...state.billing.counters };
      const seq = parseInt(doc.number.split('-').at(-1) || '0');
      if (doc.type === 'quote') counters.quote = Math.max(counters.quote, seq);
      if (doc.type === 'invoice' || doc.type === 'proforma') counters.invoice = Math.max(counters.invoice, seq);
      if (doc.type === 'receipt') counters.receipt = Math.max(counters.receipt, seq);
      return { ...state, billing: { ...state.billing, documents: [...state.billing.documents, doc], counters } };
    }
    case 'BILLING_UPDATE_DOCUMENT':
      return { ...state, billing: { ...state.billing, documents: state.billing.documents.map(d => d.id === action.payload.id ? action.payload : d) } };
    case 'BILLING_DELETE_DOCUMENT': {
      const docId = action.payload;
      const docToDelete = state.billing.documents.find(d => d.id === docId);
      if (!docToDelete) return state;

      // Also remove receipts linked to this invoice
      const linkedReceiptIds = new Set(
        state.billing.documents
          .filter(d => d.type === 'receipt' && (d as any).sourceInvoiceId === docId)
          .map(d => d.id)
      );
      const docIdsToRemove = new Set([docId, ...linkedReceiptIds]);

      // Remove auto-generated WC inflow transactions for this document (matched by doc number in description)
      const wcTxIdsToRemove = new Set(
        state.wcTransactions
          .filter(t => t.autoGenerated && t.description.includes(docToDelete.number))
          .map(t => t.id)
      );

      const remainingWC = state.wcTransactions.filter(t => !wcTxIdsToRemove.has(t.id));
      const sortedWC = [...remainingWC].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let runningBalance = 0;
      const recalculatedWC = sortedWC.map(t => {
        runningBalance = t.type === 'inflow' ? runningBalance + t.amount : runningBalance - t.amount;
        return { ...t, balanceAfter: runningBalance };
      });

      // Reset linked project payment status
      const updatedProjects = state.projects.map(p =>
        (p as any).billingInvoiceId === docId
          ? { ...p, paidAmount: 0, paymentStatus: 'projected' as const }
          : p
      );

      return {
        ...state,
        billing: { ...state.billing, documents: state.billing.documents.filter(d => !docIdsToRemove.has(d.id)) },
        wcTransactions: recalculatedWC,
        wcBalance: recalculatedWC.length > 0 ? recalculatedWC[recalculatedWC.length - 1].balanceAfter : 0,
        projects: updatedProjects,
      };
    }
    case 'BILLING_UPDATE_SETTINGS':
      return { ...state, billing: { ...state.billing, settings: { ...state.billing.settings, ...action.payload } } };
    case 'BILLING_ADD_PAYMENT': {
      const { documentId, payment } = action.payload;
      return {
        ...state,
        billing: {
          ...state.billing,
          documents: state.billing.documents.map(d => {
            if (d.id !== documentId) return d;
            const payments = [...d.payments, payment];
            const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
            const status: InvoiceStatus = totalPaid >= d.total ? 'paid' : totalPaid > 0 ? 'partial' : d.status as InvoiceStatus;
            return { ...d, payments, status, updatedAt: new Date().toISOString() };
          }),
        },
      };
    }
    case 'ADD_RETAINED_PROFIT':
      return { ...state, retainedProfit: state.retainedProfit + action.payload };
    case 'MARK_AUTO_TRANSFER_HANDLED':
      return { ...state, lastAutoTransferMonth: action.payload };
    case 'ADD_NOTIFICATION':
      // Don't duplicate — check if same type+actionData key exists unread
      return { ...state, notifications: [action.payload, ...(state.notifications || [])] };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: (state.notifications || []).map(n => n.id === action.payload ? { ...n, dismissed: true } : n) };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: (state.notifications || []).map(n => n.id === action.payload ? { ...n, read: true } : n) };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, notifications: (state.notifications || []).map(n => ({ ...n, read: true })) };
    case 'REVERSE_NOTIFICATION':
      return { ...state, notifications: (state.notifications || []).map(n => n.id === action.payload ? { ...n, reversedAt: new Date().toISOString() } : n) };
    case 'SYNC_PROJECT_PAYMENT_STATUS':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, paidAmount: action.payload.paidAmount, paymentStatus: action.payload.status }
            : p
        ),
      };
    case 'RECURRING_ADD':
      return { ...state, billing: { ...state.billing, recurringSchedules: [...(state.billing.recurringSchedules || []), action.payload] } };
    case 'RECURRING_UPDATE':
      return { ...state, billing: { ...state.billing, recurringSchedules: (state.billing.recurringSchedules || []).map((r: RecurringSchedule) => r.id === action.payload.id ? action.payload : r) } };
    case 'RECURRING_DELETE':
      return { ...state, billing: { ...state.billing, recurringSchedules: (state.billing.recurringSchedules || []).filter((r: RecurringSchedule) => r.id !== action.payload) } };
    case 'EXPENSE_ADD':
      return { ...state, billing: { ...state.billing, expenses: [...(state.billing.expenses || []), action.payload] } };
    case 'EXPENSE_UPDATE':
      return { ...state, billing: { ...state.billing, expenses: (state.billing.expenses || []).map((e: Expense) => e.id === action.payload.id ? action.payload : e) } };
    case 'EXPENSE_DELETE':
      return { ...state, billing: { ...state.billing, expenses: (state.billing.expenses || []).filter((e: Expense) => e.id !== action.payload) } };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  formatCurrency: (amount: number) => string;
  getActiveMembers: () => TeamMember[];
  getMemberById: (id: string) => TeamMember | undefined;
  getMemberWorkLog: (memberId: string, days?: number) => WorkLogEntry[];
  getMemberPoints: (memberId: string, days?: number) => { client: number; internal: number; impression: number; total: number };
  getCommitmentData: (memberId: string) => CommitmentData;
  getMonthlyProjects: (month: string) => Project[];
  getMonthlySummary: (month: string) => Record<string, any> & { memberBreakdown: MonthlyStipendBreakdown[] };
  getContributionBankReward: (memberId: string) => { points: number; tier: ContributionBankTier | null; rewardAmount: number };
  getTotalDeferredStipends: () => number;
  getMemberMonthlyEarnings: (memberId: string, month: string) => { stipend: number; bonus: number; total: number };
  exportData: () => string;
  importData: (json: string) => boolean;
  getCurrentQuarter: () => string;
  addWCTransaction: (type: 'inflow' | 'outflow', category: WCCategory, amount: number, description: string, reference?: string, auto?: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      // Load settings separately — deep merge to preserve new nested keys
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
          // Deep merge nested objects so new keys (workingCapital etc) always exist
          revenueSplit: { ...DEFAULT_SETTINGS.revenueSplit, ...(parsedSettings.revenueSplit || {}) },
          scoringWeights: { ...DEFAULT_SETTINGS.scoringWeights, ...(parsedSettings.scoringWeights || {}) },
          commitmentWeights: { ...DEFAULT_SETTINGS.commitmentWeights, ...(parsedSettings.commitmentWeights || {}) },
          contributionBank: { ...DEFAULT_SETTINGS.contributionBank, ...(parsedSettings.contributionBank || {}) },
          stipendProtection: { ...DEFAULT_SETTINGS.stipendProtection, ...(parsedSettings.stipendProtection || {}) },
          workingCapital: {
            ...DEFAULT_SETTINGS.workingCapital,
            ...(parsedSettings.workingCapital || {}),
            runwayRedThreshold: (parsedSettings.workingCapital || {}).runwayRedThreshold ?? 3,
            runwayAmberThreshold: (parsedSettings.workingCapital || {}).runwayAmberThreshold ?? 6,
          },
        };
        dispatch({ type: 'LOAD_SETTINGS', payload: mergedSettings });
      }
      
      // Load main state
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old data structure if needed
        const migrated = migrateOldData(parsed);
        dispatch({ type: 'LOAD_STATE', payload: { ...initialState, ...migrated } });
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (isLoaded && state.settings.autoSave) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      } catch (e) {
        console.error('Failed to save state:', e);
      }
    }
  }, [state, isLoaded]);

  // Migrate old data to new structure
  const migrateOldData = (data: any): Partial<AppState> => {
    // If old work log has 'hours', convert to 'points' structure
    if (data.workLog && Array.isArray(data.workLog)) {
      data.workLog = data.workLog.map((entry: any) => {
        if (entry.hours !== undefined && entry.points === undefined) {
          return {
            ...entry,
            scores: entry.scores || { deliverables: 0, responsibility: 0, quality: 0 },
            totalPoints: entry.hours || 0,
          };
        }
        return entry;
      });
    }
    
    // Ensure members have new fields
    if (data.members && Array.isArray(data.members)) {
      data.members = data.members.map((m: any) => ({
        deferredStipendBalance: 0,
        contributionBank: { currentQuarterPoints: 0, pendingRewards: 0 },
        quarterlyReliability: {},
        ...m,
      }));
    }
    
    return data;
  };

  const formatCurrency = useCallback((amount: number): string => {
    return `${state.settings.currencySymbol} ${Math.round(amount).toLocaleString()}`;
  }, [state.settings.currencySymbol]);

  const getActiveMembers = useCallback(() => {
    return state.members.filter(m => m.isActive);
  }, [state.members]);

  const getMemberById = useCallback((id: string) => {
    return state.members.find(m => m.id === id);
  }, [state.members]);

  const getMemberWorkLog = useCallback((memberId: string, days: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return state.workLog.filter(e => {
      if (e.memberId !== memberId) return false;
      const entryDate = new Date(e.date);
      return entryDate >= cutoffDate;
    });
  }, [state.workLog]);

  const getMemberPoints = useCallback((memberId: string, days: number = 30) => {
    const logs = getMemberWorkLog(memberId, days);
    
    const client = logs
      .filter(e => e.type === 'client')
      .reduce((sum, e) => sum + e.totalPoints, 0);
    const internal = logs
      .filter(e => e.type === 'internal')
      .reduce((sum, e) => sum + e.totalPoints, 0);
    const impression = logs
      .filter(e => e.type === 'impression')
      .reduce((sum, e) => sum + e.totalPoints, 0);
    
    return { client, internal, impression, total: client + internal + impression };
  }, [getMemberWorkLog]);


  const getCommitmentData = useCallback((memberId: string): CommitmentData => {
    const member = getMemberById(memberId);
    if (!member) return {
      memberId, memberName: '', role: '', type: 'Part-time' as const,
      clientPoints: 0, internalPoints: 0, impressionPoints: 0, totalPoints: 0,
      projectsInvolved: 0, totalActiveProjects: 0, projectParticipationRate: 0,
      reliabilityScore: 0, reliabilityOverride: null, score: 0,
      status: 'review' as const, multiplier: 0.8, trend: 'stable' as const,
      contributionBankPoints: 0,
    };

    // Use all work log entries (not just 30 days) for quarterly view
    const quarterLogs = state.workLog.filter(e => {
      if (e.memberId !== memberId) return false;
      const d = new Date(e.date); const q = Math.floor(d.getMonth()/3)+1; return `${d.getFullYear()}-Q${q}` === state.currentQuarter;
    });
    const prevQuarterLogs = state.workLog.filter(e => {
      if (e.memberId !== memberId) return false;
      // Simple: entries not in current quarter
      const d = new Date(e.date); const q = Math.floor(d.getMonth()/3)+1; return `${d.getFullYear()}-Q${q}` !== state.currentQuarter;
    });

    const clientPoints = quarterLogs.filter(e => e.type === 'client').reduce((s, e) => s + e.totalPoints, 0);
    const internalPoints = quarterLogs.filter(e => e.type === 'internal').reduce((s, e) => s + e.totalPoints, 0);
    const impressionPoints = quarterLogs.filter(e => e.type === 'impression').reduce((s, e) => s + e.totalPoints, 0);
    const totalPoints = clientPoints + internalPoints + impressionPoints;

    // Project participation this quarter
    const projectsInvolved = new Set(quarterLogs.map(e => e.projectId).filter(Boolean)).size;
    const totalActiveProjects = new Set(
      state.workLog
        .filter(e => (() => { const d = new Date(e.date); const q = Math.floor(d.getMonth()/3)+1; return `${d.getFullYear()}-Q${q}`; })() === state.currentQuarter)
        .map(e => e.projectId)
        .filter(Boolean)
    ).size;
    const projectParticipationRate = totalActiveProjects > 0 ? projectsInvolved / totalActiveProjects : 0;

    // AUTO-CALCULATED reliability from scoring data
    // Average of all dimension scores as % of max possible across all quarter entries
    const maxPossiblePerEntry = 100; // max D+R+Q = 35+35+30 = 100
    const autoReliability = quarterLogs.length > 0
      ? Math.round((quarterLogs.reduce((s, e) => s + e.totalPoints, 0) / (quarterLogs.length * maxPossiblePerEntry)) * 100)
      : 0;

    // Founder override (1-10 scale) if set, else use auto
    const currentQuarter = getCurrentQuarter();
    const overrideRaw = member.quarterlyReliability[currentQuarter];
    const reliabilityOverride = overrideRaw !== undefined ? overrideRaw : null;
    // Convert override from 1-10 to 0-100 scale, or use auto
    const reliabilityScore = reliabilityOverride !== null
      ? Math.round((reliabilityOverride / 10) * 100)
      : autoReliability;

    // Simple founder-override multiplier only
    // No automated formula — founder sets a 1-10 rating per member per quarter
    // 8-10 → Excellent → 1.1x | 4-7 → Good → 1.0x | 1-3 → Review → 0.85x | no override → 1.0x
    const score = reliabilityOverride !== null ? Math.round((reliabilityOverride / 10) * 100) : 50;

    let status: 'excellent' | 'good' | 'review' = 'good';
    let multiplier = 1.0;

    if (reliabilityOverride !== null) {
      if (reliabilityOverride >= 8) { status = 'excellent'; multiplier = 1.1; }
      else if (reliabilityOverride >= 4) { status = 'good'; multiplier = 1.0; }
      else { status = 'review'; multiplier = 0.85; }
    }

    // Trend: compare current quarter points to previous
    const prevPoints = prevQuarterLogs.reduce((s, e) => s + e.totalPoints, 0);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (totalPoints > prevPoints * 1.2) trend = 'improving';
    else if (totalPoints < prevPoints * 0.8 && prevPoints > 0) trend = 'declining';

    return {
      memberId,
      memberName: member.name,
      role: member.role,
      type: member.type,
      clientPoints,
      internalPoints,
      impressionPoints,
      totalPoints,
      projectsInvolved,
      totalActiveProjects,
      projectParticipationRate,
      reliabilityScore,
      reliabilityOverride,
      score,
      status,
      multiplier,
      trend,
      contributionBankPoints: member.contributionBank.currentQuarterPoints,
    };
  }, [getMemberById, state.workLog, state.settings, state.currentQuarter]);



  const getMonthlyProjects = useCallback((month: string) => {
    return state.projects.filter(p => p.month === month);
  }, [state.projects]);

  const getMonthlySummary = useCallback((month: string) => {
    const projects = getMonthlyProjects(month);
    const clientProjects = projects.filter(p => p.type === 'client');
    const activeMembers = getActiveMembers();

    const totalRevenue = clientProjects.reduce((sum, p) => sum + p.revenue, 0);
    const totalDirectExpenses = clientProjects.reduce((sum, p) => sum + p.directExpenses, 0);
    const totalNetProfit = clientProjects.reduce((sum, p) => sum + p.netProfit, 0);
    const totalCompanyContributions = clientProjects.reduce((sum, p) => sum + p.companyContribution, 0);
    const totalBonusPools = clientProjects.reduce((sum, p) => sum + p.bonusPool, 0);
    // Actual bonuses earned (sum of finalBonus — may be less than pool due to multipliers)
    const totalActualBonuses = clientProjects.reduce((sum, p) =>
      sum + p.distribution.reduce((s, d) => s + (d.finalBonus || 0), 0), 0);

    // ── Billing invoices not already linked to a Project Calculator project ──
    const linkedInvoiceIds = new Set(projects.map((p: any) => p.billingInvoiceId).filter(Boolean));
    const companyPct = (state.settings.revenueSplit?.companyPercent ?? 60) / 100;
    const bonusPct  = (state.settings.revenueSplit?.bonusPercent  ?? 40) / 100;

    const billingInvoices = ((state.billing?.documents || []) as any[]).filter((doc: any) =>
      doc.type === 'invoice' &&
      !linkedInvoiceIds.has(doc.id) &&
      (doc.payments || []).some((p: any) => p.date?.startsWith(month))
    );

    const billingRevenue = billingInvoices.reduce((sum: number, doc: any) => {
      const monthPayments = (doc.payments || []).filter((p: any) => p.date?.startsWith(month));
      return sum + monthPayments.reduce((s: number, p: any) => s + (p.mwkEquivalent || p.amount || 0), 0);
    }, 0);

    const billingExpenses = ((state.billing?.expenses || []) as any[])
      .filter((e: any) => billingInvoices.some((inv: any) => inv.id === e.invoiceId) && e.date?.startsWith(month))
      .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    const billingNetProfit = billingRevenue - billingExpenses;

    const billingCompanyContribution = billingInvoices.reduce((sum: number, doc: any) => {
      const monthPayments = (doc.payments || []).filter((p: any) => p.date?.startsWith(month));
      const rev = monthPayments.reduce((s: number, p: any) => s + (p.mwkEquivalent || p.amount || 0), 0);
      return sum + (doc.isContractorProject ? rev : rev * companyPct);
    }, 0);

    const billingBonusPool = billingInvoices.reduce((sum: number, doc: any) => {
      const monthPayments = (doc.payments || []).filter((p: any) => p.date?.startsWith(month));
      const rev = monthPayments.reduce((s: number, p: any) => s + (p.mwkEquivalent || p.amount || 0), 0);
      return sum + (doc.isContractorProject ? 0 : rev * bonusPct);
    }, 0);

    // Per-member bonus breakdown
    const memberBreakdown: MonthlyStipendBreakdown[] = activeMembers.map(m => {
      let bonus = 0;
      clientProjects.forEach(p => {
        const dist = p.distribution.find(d => d.memberId === m.id);
        if (dist) bonus += dist.finalBonus;
      });
      // Find actual stipend paid from WC this month
      const stipendTxs = (state.wcTransactions || []).filter(t =>
        t.category === 'salary' &&
        t.reference === m.id &&
        t.date.startsWith(month)
      );
      const actualPaid = stipendTxs.reduce((s, t) => s + t.amount, 0);
      const stipendPaid = actualPaid > 0 ? actualPaid : m.stipend;
      const stipendDeferred = m.deferredStipendBalance || 0;
      return {
        memberId: m.id,
        memberName: m.name,
        fullStipend: m.stipend,
        stipendPaid,
        stipendDeferred,
      };
    });
    return {
      totalRevenue:               totalRevenue + billingRevenue,
      totalDirectExpenses:        totalDirectExpenses + billingExpenses,
      totalNetProfit:             totalNetProfit + billingNetProfit,
      totalCompanyContributions:  totalCompanyContributions + billingCompanyContribution,
      totalBonusPools:            totalBonusPools + billingBonusPool,
      netCompanyFund:             totalCompanyContributions + billingCompanyContribution,
      totalActualBonuses,
      memberBreakdown,
      projects,
      // Billing-only invoice data (for display in Monthly Summary)
      billingInvoices,
      billingRevenue,
      billingExpenses,
      billingCompanyContribution,
      billingBonusPool,
    };
  }, [getMonthlyProjects, getActiveMembers, state.billing, state.settings.revenueSplit, state.wcTransactions]);

    const getContributionBankReward = useCallback((memberId: string) => {
    const member = getMemberById(memberId);
    if (!member) return { points: 0, tier: null, rewardAmount: 0 };
    
    const points = member.contributionBank.currentQuarterPoints;
    const { tiers } = state.settings.contributionBank;
    
    // Find the tier for this point total
    const tier = tiers.find(t => points >= t.minPoints && points <= t.maxPoints) || null;
    
    // Calculate reward amount as percentage of stipend
    const rewardAmount = (tier && member.stipend > 0) ? (member.stipend * tier.rewardPercent) / 100 : 0;
    
    return { points, tier, rewardAmount };
  }, [getMemberById, state.settings]);

  const getTotalDeferredStipends = useCallback(() => {
    return state.members.reduce((sum, m) => sum + m.deferredStipendBalance, 0);
  }, [state.members]);

  const getMemberMonthlyEarnings = useCallback((memberId: string, month: string) => {
    const member = getMemberById(memberId);
    if (!member) return { stipend: 0, bonus: 0, total: 0 };
    
    // Stipend is always paid in full from Working Capital
    const stipendPaid = member.stipend;
    
    // Get bonus earned from projects
    const monthProjects = state.projects.filter(p => p.month === month);
    let bonus = 0;
    monthProjects.forEach(p => {
      const dist = p.distribution.find(d => d.memberId === memberId);
      if (dist) bonus += dist.finalBonus;
    });
    
    return { stipend: stipendPaid, bonus, total: stipendPaid + bonus };
  }, [getMemberById, state.projects]);

  const addWCTransaction = useCallback((
    type: 'inflow' | 'outflow',
    category: WCCategory,
    amount: number,
    description: string,
    reference?: string,
    auto = false
  ) => {
    const tx: WCTransaction = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      type,
      category,
      amount,
      description,
      reference,
      balanceAfter: 0, // updated by reducer
      autoGenerated: Boolean(auto),
    };
    dispatch({ type: 'ADD_WC_TRANSACTION', payload: tx });
  }, [dispatch]);



  const exportData = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importData = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      dispatch({ type: 'IMPORT_DATA', payload: data });
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  }, []);

  if (!isLoaded) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Loading InspireX OS...</div>
    </div>;
  }

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      formatCurrency,
      getActiveMembers,
      getMemberById,
      getMemberWorkLog,
      getMemberPoints,
      getCommitmentData,
      getMonthlyProjects,
      getMonthlySummary,
      getContributionBankReward,
      getTotalDeferredStipends,
      getMemberMonthlyEarnings,
      exportData,
      importData,
      getCurrentQuarter,
      addWCTransaction,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
