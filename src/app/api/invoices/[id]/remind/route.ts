import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { sendInvoiceReminder } from '@/lib/mailer';
import { formatCurrency } from '@/lib/format';
import { daysOverdue } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// Email a payment reminder for an outstanding invoice straight to the customer.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const ownerId = tenantOf(gate);

  const invoice = await prisma.invoice.findFirst({ where: { id, ownerId }, include: { customer: true } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.state === 'PAID') return NextResponse.json({ error: 'This invoice is already paid' }, { status: 409 });
  if (!invoice.customer.email) {
    return NextResponse.json({ error: `${invoice.customer.name} has no email on file. Add one in Contacts first.` }, { status: 400 });
  }

  const { sent } = await sendInvoiceReminder({
    to: invoice.customer.email,
    customerName: invoice.customer.name,
    businessName: gate.businessName || 'CashFlow Pro',
    invoiceNumber: invoice.invoiceNumber,
    amountLabel: formatCurrency(invoice.totalAmount, gate.currency),
    dueDateLabel: new Date(invoice.dueDate).toLocaleDateString(),
    daysOverdue: daysOverdue(invoice.dueDate),
  });

  return NextResponse.json({
    success: true,
    sent,
    message: sent
      ? `Reminder emailed to ${invoice.customer.name}.`
      : `Reminder prepared for ${invoice.customer.name} (email not delivered on this network — see server log).`,
  });
}
