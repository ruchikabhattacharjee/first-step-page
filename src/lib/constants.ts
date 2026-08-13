// Shared domain vocabulary for CashFlow Pro.

export const INVOICE_STATES = ['DRAFT', 'SENT', 'OVERDUE', 'PAID'] as const;
export const BILL_STATES = ['DRAFT', 'PENDING', 'OVERDUE', 'PAID'] as const;

export const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Raw Materials', 'Marketing', 'Software', 'Other',
] as const;

export const CASHFLOW_TAGS = ['OPERATING', 'INVESTING', 'FINANCING'] as const;

export type LineItem = { desc: string; qty: number; unitPrice: number; taxRate: number };

/** Total of a line-item list including per-line tax. */
export function lineItemsTotal(items: LineItem[]): number {
  return items.reduce((sum, it) => {
    const base = (it.qty || 0) * (it.unitPrice || 0);
    return sum + base + base * ((it.taxRate || 0) / 100);
  }, 0);
}

/** Whole days an item is past its due date (0 if not yet due). */
export function daysOverdue(dueDate: Date | string, asOf: Date = new Date()): number {
  const due = new Date(dueDate).getTime();
  const diff = Math.floor((asOf.getTime() - due) / (1000 * 3600 * 24));
  return Math.max(0, diff);
}

/** PRD aging matrix → a status-pill class name. */
export function agingClass(dueDate: Date | string, state: string): string {
  if (state === 'PAID') return 'status-green';
  if (state === 'DRAFT') return 'status-gray';
  const d = daysOverdue(dueDate);
  if (d === 0) return 'status-green';
  if (d <= 30) return 'status-yellow';
  if (d <= 60) return 'status-orange';
  return 'status-red';
}

/**
 * Recompute the live state of an AR/AP record from its dates. An item flips to
 * OVERDUE the moment the system date passes the due date with no payment.
 */
export function liveInvoiceState(inv: { state: string; dueDate: Date | string }): string {
  if (inv.state === 'PAID' || inv.state === 'DRAFT') return inv.state;
  return daysOverdue(inv.dueDate) > 0 ? 'OVERDUE' : 'SENT';
}

export function liveBillState(bill: { state: string; dueDate: Date | string }): string {
  if (bill.state === 'PAID' || bill.state === 'DRAFT') return bill.state;
  return daysOverdue(bill.dueDate) > 0 ? 'OVERDUE' : 'PENDING';
}

/** Map a due date to its AR realization-probability weight (PRD forecasting). */
export function realizationWeight(dueDate: Date | string, state: string): number {
  if (state === 'OVERDUE' || daysOverdue(dueDate) > 0) return 0.3; // already overdue
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 3600 * 24));
  if (days <= 7) return 0.9; // due very soon
  if (days <= 21) return 0.7; // due in a few weeks
  return 0.5; // due later
}
