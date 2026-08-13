import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import './Dashboard.css';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, tenantOf } from '@/lib/auth';
import { dailyCashFlow } from '@/lib/analytics';
import { daysOverdue } from '@/lib/constants';

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const ownerId = tenantOf(user);

  const [openInvoices, openBills, allTransactions, chartData] = await Promise.all([
    prisma.invoice.findMany({ where: { ownerId, state: { in: ['SENT', 'OVERDUE'] } }, include: { customer: true }, orderBy: { dueDate: 'asc' } }),
    prisma.bill.findMany({ where: { ownerId, state: { in: ['PENDING', 'OVERDUE'] } }, include: { vendor: true }, orderBy: { dueDate: 'asc' } }),
    prisma.transaction.findMany({ where: { ownerId }, orderBy: { date: 'desc' }, take: 100 }),
    dailyCashFlow(ownerId, 30),
  ]);

  const receivables = openInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const payables = openBills.reduce((s, b) => s + b.totalAmount, 0);
  const overdueInvoices = openInvoices.filter((i) => daysOverdue(i.dueDate) > 0);
  const overdueBills = openBills.filter((b) => daysOverdue(b.dueDate) > 0);

  // Upcoming bills in the next 14 days (PRD widget).
  const in14 = Date.now() + 14 * 86400000;
  const upcomingBills = openBills.filter((b) => new Date(b.dueDate).getTime() <= in14);

  // 30-day money in/out + net change (from the daily chart series).
  const moneyIn = chartData.reduce((s, d) => s + d.Inflows, 0);
  const moneyOut = chartData.reduce((s, d) => s + d.Outflows, 0);
  const netChange = moneyIn - moneyOut;

  // Expense breakdown — last 30 days of outflows grouped by category.
  const since = Date.now() - 30 * 86400000;
  const expenseMap = new Map<string, number>();
  for (const t of allTransactions) {
    if (t.type === 'OUT' && new Date(t.date).getTime() >= since) {
      const c = t.category || 'Other';
      expenseMap.set(c, (expenseMap.get(c) || 0) + t.amount);
    }
  }
  const expenseBreakdown = [...expenseMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // AR aging buckets from open invoices.
  const aging = [
    { name: 'Current', value: 0 },
    { name: '1–30d', value: 0 },
    { name: '31–60d', value: 0 },
    { name: '60d+', value: 0 },
  ];
  for (const inv of openInvoices) {
    const d = daysOverdue(inv.dueDate);
    if (d === 0) aging[0].value += inv.totalAmount;
    else if (d <= 30) aging[1].value += inv.totalAmount;
    else if (d <= 60) aging[2].value += inv.totalAmount;
    else aging[3].value += inv.totalAmount;
  }

  // Serialise overdue/bill detail for the Action Center modal.
  const overdueInvoiceDetails = overdueInvoices.map((i) => ({
    id: i.id, invoiceNumber: i.invoiceNumber, customer: i.customer.name,
    hasEmail: !!i.customer.email, amount: i.totalAmount, dueDate: i.dueDate, daysOverdue: daysOverdue(i.dueDate),
  }));
  const billDetails = openBills.map((b) => ({
    id: b.id, billNumber: b.billNumber, vendor: b.vendor.name, category: b.category,
    amount: b.totalAmount, dueDate: b.dueDate, daysOverdue: daysOverdue(b.dueDate),
  }));

  return (
    <DashboardClient
      userName={user.name}
      businessName={user.businessName}
      currency={user.currency}
      role={user.role}
      bankBalance={user.bankBalance}
      netChange={netChange}
      moneyIn={moneyIn}
      moneyOut={moneyOut}
      receivables={receivables}
      payables={payables}
      transactions={allTransactions}
      upcomingBills={upcomingBills}
      overdueInvoices={overdueInvoiceDetails}
      overdueBillCount={overdueBills.length}
      billDetails={billDetails}
      chartData={chartData}
      expenseBreakdown={expenseBreakdown}
      aging={aging}
    />
  );
}
