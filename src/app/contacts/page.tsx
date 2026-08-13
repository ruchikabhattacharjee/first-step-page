import ContactsClient from './ContactsClient';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, tenantOf } from '@/lib/auth';
import { canWrite } from '@/lib/rbac';

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const ownerId = tenantOf(user);

  const contacts = await prisma.contact.findMany({
    where: { ownerId },
    include: { invoices: true, bills: true },
    orderBy: { name: 'asc' },
  });

  const enriched = contacts.map((c) => {
    const totalInvoiced = c.invoices.reduce((a, i) => a + i.totalAmount, 0);
    const totalBilled = c.bills.reduce((a, b) => a + b.totalAmount, 0);
    const unpaidInvoices = c.invoices.filter((i) => i.state !== 'PAID').reduce((a, i) => a + i.totalAmount, 0);
    const unpaidBills = c.bills.filter((b) => b.state !== 'PAID').reduce((a, b) => a + b.totalAmount, 0);
    const activeNetBalance = unpaidInvoices - unpaidBills;

    const history = [
      ...c.invoices.map((i) => ({ id: `inv-${i.id}`, date: i.issueDate, type: `Invoice ${i.invoiceNumber} (${i.state})`, amount: i.totalAmount })),
      ...c.bills.map((b) => ({ id: `bill-${b.id}`, date: b.billDate, type: `Bill ${b.billNumber} (${b.state})`, amount: -b.totalAmount })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const { invoices, bills, ...rest } = c;
    return { ...rest, totalInvoiced, totalBilled, activeNetBalance, history };
  });

  return <ContactsClient initialContacts={enriched} currency={user.currency} canWrite={canWrite(user.role)} />;
}
