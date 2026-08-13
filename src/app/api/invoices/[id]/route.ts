import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { lineItemsTotal, type LineItem } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const ownerId = tenantOf(gate);

  const existing = await prisma.invoice.findFirst({ where: { id, ownerId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.state === 'PAID') {
    return NextResponse.json({ error: 'Paid invoices cannot be edited.' }, { status: 409 });
  }

  const { dueDate, issueDate, items, state } = await req.json();
  const lineItems: LineItem[] | undefined = Array.isArray(items) ? items : undefined;

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      issueDate: issueDate ? new Date(issueDate) : existing.issueDate,
      dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
      state: state && ['DRAFT', 'SENT'].includes(state) ? state : existing.state,
      items: lineItems ? JSON.stringify(lineItems) : existing.items,
      totalAmount: lineItems ? Math.round(lineItemsTotal(lineItems)) : existing.totalAmount,
    },
  });
  return NextResponse.json({ invoice });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const existing = await prisma.invoice.findFirst({ where: { id, ownerId: tenantOf(gate) } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove any linked payment transactions first, then the invoice.
  await prisma.transaction.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
