import { prisma } from './prisma';
import { realizationWeight, daysOverdue, EXPENSE_CATEGORIES } from './constants';

type Txn = { date: Date; amount: number; type: string; tag: string; category: string | null };

const isIn = (t: Txn) => t.type === 'IN';
const signed = (t: Txn) => (isIn(t) ? t.amount : -t.amount);

/** Last-30-day daily inflow vs outflow series for the dashboard chart. */
export async function dailyCashFlow(ownerId: string, days = 30) {
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
  const txns = await prisma.transaction.findMany({ where: { ownerId, date: { gte: from } }, select: { date: true, amount: true, type: true } });

  const buckets: { name: string; Inflows: number; Outflows: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from); d.setDate(from.getDate() + i);
    buckets.push({ name: `${d.getDate()}/${d.getMonth() + 1}`, Inflows: 0, Outflows: 0 });
  }
  for (const t of txns) {
    const idx = Math.floor((new Date(t.date).setHours(0, 0, 0, 0) - from.getTime()) / 86400000);
    if (idx >= 0 && idx < days) {
      if (t.type === 'IN') buckets[idx].Inflows += t.amount;
      else buckets[idx].Outflows += t.amount;
    }
  }
  return buckets;
}

/** PRD "Statement of Cash Flows": grouped by tag with reconciling opening/closing. */
export async function cashFlowStatement(ownerId: string, from: Date, to: Date) {
  const [currentUser, periodTxns, afterStart] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { bankBalance: true } }),
    prisma.transaction.findMany({ where: { ownerId, date: { gte: from, lte: to } } }),
    prisma.transaction.findMany({ where: { ownerId, date: { gte: from } }, select: { amount: true, type: true } }),
  ]);

  const group = (tag: string) => {
    const g = periodTxns.filter((t) => t.tag === tag);
    return {
      in: g.filter(isIn).reduce((s, t) => s + t.amount, 0),
      out: g.filter((t) => !isIn(t)).reduce((s, t) => s + t.amount, 0),
    };
  };

  const operating = group('OPERATING');
  const investing = group('INVESTING');
  const financing = group('FINANCING');
  const netPeriod = periodTxns.reduce((s, t) => s + signed(t as Txn), 0);

  // opening reconciles so that opening + netPeriod == balance as of `to`.
  const current = currentUser?.bankBalance ?? 0;
  const afterStartNet = afterStart.reduce((s, t) => s + (t.type === 'IN' ? t.amount : -t.amount), 0);
  const opening = Math.round(current - afterStartNet);
  const closing = Math.round(opening + netPeriod);

  return { opening, operating, investing, financing, closing };
}

/**
 * Budget vs Actuals for a given month/year. If the requested month has no
 * budget targets (e.g. the demo ledger was generated in an earlier month),
 * fall back to the most recent month that does — and compute actuals for that
 * same month — so the view is always populated with meaningful data.
 */
export async function budgetVsActuals(ownerId: string, month: number, year: number) {
  let effMonth = month, effYear = year;
  let budgets = await prisma.budget.findMany({ where: { ownerId, month, year } });
  if (budgets.length === 0) {
    const latest = await prisma.budget.findFirst({ where: { ownerId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    if (latest) {
      effMonth = latest.month; effYear = latest.year;
      budgets = await prisma.budget.findMany({ where: { ownerId, month: effMonth, year: effYear } });
    }
  }
  const from = new Date(effYear, effMonth - 1, 1);
  const to = new Date(effYear, effMonth, 0, 23, 59, 59);
  const txns = await prisma.transaction.findMany({ where: { ownerId, type: 'OUT', date: { gte: from, lte: to } } });

  const budgetMap = new Map(budgets.map((b) => [b.category, b.amount]));
  const actualMap = new Map<string, number>();
  for (const t of txns) {
    const c = EXPENSE_CATEGORIES.includes((t.category || '') as any) ? (t.category as string) : 'Other';
    actualMap.set(c, (actualMap.get(c) || 0) + t.amount);
  }

  return EXPENSE_CATEGORIES
    .map((category) => ({ category, budget: budgetMap.get(category) || 0, actual: actualMap.get(category) || 0 }))
    .filter((r) => r.budget > 0 || r.actual > 0);
}

/**
 * Risk-adjusted balance forecast out to `horizon` days.
 * Confirmed path discounts receivables by realization probability; best case
 * assumes full collection; worst case assumes heavy slippage. Bills are 100%
 * outflows on their due dates. Recurring operating burn is projected forward.
 */
export async function forecast(ownerId: string, horizon: number) {
  const [user, openInvoices, openBills, recentTxns] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { bankBalance: true } }),
    prisma.invoice.findMany({ where: { ownerId, state: { in: ['SENT', 'OVERDUE'] } }, select: { totalAmount: true, dueDate: true, state: true } }),
    prisma.bill.findMany({ where: { ownerId, state: { in: ['PENDING', 'OVERDUE'] } }, select: { totalAmount: true, dueDate: true } }),
    prisma.transaction.findMany({ where: { ownerId, date: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { amount: true, type: true, invoiceId: true, billId: true } }),
  ]);

  const baseline = user?.bankBalance ?? 0;

  // Recurring daily operating burn = avg net of the last 30 days EXCLUDING
  // one-off invoice/bill settlements (those are modelled explicitly below).
  const recurring = recentTxns.filter((t) => !t.invoiceId && !t.billId);
  const recurringNet = recurring.reduce((s, t) => s + (t.type === 'IN' ? t.amount : -t.amount), 0);
  const dailyBurn = recurringNet / 30;

  const dayIndex = (due: Date) => {
    const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
    return Math.min(Math.max(d, 0), horizon); // overdue → day 0
  };

  // Pre-bucket expected events per day.
  const inflow = { confirmed: new Array(horizon + 1).fill(0), best: new Array(horizon + 1).fill(0), worst: new Array(horizon + 1).fill(0) };
  const outflow = new Array(horizon + 1).fill(0);

  for (const inv of openInvoices) {
    const idx = dayIndex(inv.dueDate);
    const w = realizationWeight(inv.dueDate, inv.state);
    inflow.confirmed[idx] += inv.totalAmount * w;
    inflow.best[idx] += inv.totalAmount; // optimal collection
    inflow.worst[idx] += inv.totalAmount * (daysOverdue(inv.dueDate) > 0 ? 0.1 : w * 0.5);
  }
  for (const b of openBills) outflow[dayIndex(b.dueDate)] += b.totalAmount;

  const series: { day: string; confirmed: number; bestCase: number; worstCase: number }[] = [];
  let confirmed = baseline, best = baseline, worst = baseline;
  for (let d = 0; d <= horizon; d++) {
    confirmed += dailyBurn + inflow.confirmed[d] - outflow[d];
    best += Math.max(dailyBurn, 0) + inflow.best[d] - outflow[d];
    worst += Math.min(dailyBurn, dailyBurn * 1.3) + inflow.worst[d] - outflow[d];
    if (d === 0 || d % 5 === 0 || d === horizon) {
      series.push({ day: String(d), confirmed: Math.round(confirmed), bestCase: Math.round(best), worstCase: Math.round(worst) });
    }
  }

  // Plain-text insights.
  const overdue = openInvoices.filter((i) => daysOverdue(i.dueDate) > 0);
  const overdueTotal = overdue.reduce((s, i) => s + i.totalAmount, 0);
  const worstFloor = Math.min(...series.map((s) => s.worstCase));
  const insights: string[] = [];
  if (overdue.length) insights.push(`${overdue.length} invoice${overdue.length > 1 ? 's' : ''} worth ₹${overdueTotal.toLocaleString('en-IN')} are overdue and weigh on near-term inflows.`);
  if (worstFloor < 0) {
    const breach = series.find((s) => s.worstCase < 0);
    insights.push(`Worst-case balance dips below ₹0 around day ${breach?.day} — a potential liquidity risk if collections slip.`);
  } else {
    insights.push('Even in the worst case, projected balance stays above ₹0 across the horizon.');
  }

  return { series, insights, baseline };
}
