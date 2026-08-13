import BillsClient from './BillsClient';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, tenantOf } from '@/lib/auth';
import { liveBillState } from '@/lib/constants';
import { canWrite } from '@/lib/rbac';

export default async function BillsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const ownerId = tenantOf(user);

  const [rawBills, vendors] = await Promise.all([
    prisma.bill.findMany({ where: { ownerId }, include: { vendor: true }, orderBy: { dueDate: 'asc' } }),
    prisma.contact.findMany({ where: { ownerId, type: { in: ['VENDOR', 'BOTH'] } }, orderBy: { name: 'asc' } }),
  ]);

  const bills = rawBills.map((b) => ({ ...b, state: liveBillState(b) }));

  const totalBillsDue = bills.filter((b) => b.state !== 'PAID' && b.state !== 'DRAFT').reduce((a, b) => a + b.totalAmount, 0);
  const overduePayables = bills.filter((b) => b.state === 'OVERDUE').reduce((a, b) => a + b.totalAmount, 0);

  const now = new Date();
  const paidThisMonth = bills
    .filter((b) => b.state === 'PAID' && b.paidDate && new Date(b.paidDate).getMonth() === now.getMonth() && new Date(b.paidDate).getFullYear() === now.getFullYear())
    .reduce((a, b) => a + b.totalAmount, 0);

  const pending = bills.filter((b) => b.state === 'PENDING' || b.state === 'OVERDUE');
  const largestUpcoming = pending.length ? Math.max(...pending.map((b) => b.totalAmount)) : 0;

  const kpis = { totalBillsDue, overduePayables, paidThisMonth, largestUpcoming };

  return (
    <BillsClient
      initialBills={bills}
      vendors={vendors}
      kpis={kpis}
      currency={user.currency}
      canWrite={canWrite(user.role)}
    />
  );
}
