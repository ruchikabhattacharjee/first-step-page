import InvoicesClient from './InvoicesClient';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, tenantOf } from '@/lib/auth';
import { liveInvoiceState } from '@/lib/constants';
import { canWrite } from '@/lib/rbac';

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const ownerId = tenantOf(user);

  const [rawInvoices, customers] = await Promise.all([
    prisma.invoice.findMany({ where: { ownerId }, include: { customer: true }, orderBy: { issueDate: 'desc' } }),
    prisma.contact.findMany({ where: { ownerId, type: { in: ['CUSTOMER', 'BOTH'] } }, orderBy: { name: 'asc' } }),
  ]);

  // Apply the live state machine (SENT → OVERDUE once past due).
  const invoices = rawInvoices.map((i) => ({ ...i, state: liveInvoiceState(i) }));

  const totalReceivables = invoices.filter((i) => i.state !== 'PAID' && i.state !== 'DRAFT').reduce((a, i) => a + i.totalAmount, 0);
  const overdueAggregate = invoices.filter((i) => i.state === 'OVERDUE').reduce((a, i) => a + i.totalAmount, 0);

  const now = new Date();
  const collectedThisMonth = invoices
    .filter((i) => i.state === 'PAID' && i.paidDate && new Date(i.paidDate).getMonth() === now.getMonth() && new Date(i.paidDate).getFullYear() === now.getFullYear())
    .reduce((a, i) => a + i.totalAmount, 0);

  // DSO: average days from issue to payment across paid invoices.
  const paid = invoices.filter((i) => i.state === 'PAID' && i.paidDate);
  const dso = paid.length
    ? Math.round(paid.reduce((a, i) => a + Math.max(0, (new Date(i.paidDate!).getTime() - new Date(i.issueDate).getTime()) / 86400000), 0) / paid.length)
    : 0;

  const kpis = { totalReceivables, overdueAggregate, collectedThisMonth, dso };

  return (
    <InvoicesClient
      initialInvoices={invoices}
      customers={customers}
      kpis={kpis}
      currency={user.currency}
      canWrite={canWrite(user.role)}
    />
  );
}
