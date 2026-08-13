import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { lineItemsTotal, EXPENSE_CATEGORIES, type LineItem } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const ownerId = tenantOf(gate);

  const existing = await prisma.bill.findFirst({ where: { id, ownerId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.state === 'PAID') return NextResponse.json({ error: 'Paid bills cannot be edited.' }, { status: 409 });

  const { billDate, dueDate, category, items, state } = await req.json();
  const lineItems: LineItem[] | undefined = Array.isArray(items) ? items : undefined;

  const bill = await prisma.bill.update({
    where: { id },
    data: {
      billDate: billDate ? new Date(billDate) : existing.billDate,
      dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
      category: category && EXPENSE_CATEGORIES.includes(category) ? category : existing.category,
      state: state && ['DRAFT', 'PENDING'].includes(state) ? state : existing.state,
      items: lineItems ? JSON.stringify(lineItems) : existing.items,
      totalAmount: lineItems ? Math.round(lineItemsTotal(lineItems)) : existing.totalAmount,
    },
  });
  return NextResponse.json({ bill });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const existing = await prisma.bill.findFirst({ where: { id, ownerId: tenantOf(gate) } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.transaction.deleteMany({ where: { billId: id } });
  await prisma.bill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
