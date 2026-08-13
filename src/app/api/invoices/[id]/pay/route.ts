import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';

type Ctx = { params: Promise<{ id: string }> };

// Mark an invoice as Paid: records a positive collection in the unified ledger
// and bumps the confirmed bank balance.
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const ownerId = tenantOf(gate);

  const invoice = await prisma.invoice.findFirst({ where: { id, ownerId }, include: { customer: true } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.state === 'PAID') return NextResponse.json({ error: 'Invoice already paid' }, { status: 409 });

  const { paidDate, method, amount } = await req.json();
  const received = Number(amount) > 0 ? Math.round(Number(amount)) : invoice.totalAmount;
  const when = paidDate ? new Date(paidDate) : new Date();

  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: { state: 'PAID', paidDate: when } }),
    prisma.transaction.create({
      data: {
        ownerId, date: when, amount: received,
        description: `Collection — ${invoice.invoiceNumber} (${invoice.customer.name})${method ? ` via ${method}` : ''}`,
        type: 'IN', category: 'Collections', tag: 'OPERATING', invoiceId: id,
      },
    }),
    prisma.user.update({ where: { id: ownerId }, data: { bankBalance: { increment: received } } }),
  ]);

  return NextResponse.json({ success: true });
}
