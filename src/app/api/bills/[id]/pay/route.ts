import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';

type Ctx = { params: Promise<{ id: string }> };

// Mark a bill as Paid: records a negative entry in the unified ledger and
// reduces the confirmed bank balance.
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const ownerId = tenantOf(gate);

  const bill = await prisma.bill.findFirst({ where: { id, ownerId }, include: { vendor: true } });
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (bill.state === 'PAID') return NextResponse.json({ error: 'Bill already paid' }, { status: 409 });

  const { paidDate, method, amount } = await req.json();
  const paid = Number(amount) > 0 ? Math.round(Number(amount)) : bill.totalAmount;
  const when = paidDate ? new Date(paidDate) : new Date();

  await prisma.$transaction([
    prisma.bill.update({ where: { id }, data: { state: 'PAID', paidDate: when } }),
    prisma.transaction.create({
      data: {
        ownerId, date: when, amount: paid,
        description: `Bill paid — ${bill.billNumber} (${bill.vendor.name})${method ? ` via ${method}` : ''}`,
        type: 'OUT', category: bill.category, tag: 'OPERATING', billId: id,
      },
    }),
    prisma.user.update({ where: { id: ownerId }, data: { bankBalance: { decrement: paid } } }),
  ]);

  return NextResponse.json({ success: true });
}
