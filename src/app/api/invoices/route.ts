import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { lineItemsTotal, type LineItem } from '@/lib/constants';

async function nextInvoiceNumber(ownerId: string): Promise<string> {
  const invoices = await prisma.invoice.findMany({ where: { ownerId }, select: { invoiceNumber: true } });
  const max = invoices.reduce((m, i) => {
    const n = parseInt(i.invoiceNumber.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const ownerId = tenantOf(gate);

  const { customerId, customerName, issueDate, dueDate, items, state } = await req.json();
  const lineItems: LineItem[] = Array.isArray(items) ? items : [];
  if (!dueDate || lineItems.length === 0) {
    return NextResponse.json({ error: 'Due date and at least one line item are required' }, { status: 400 });
  }

  // Resolve the customer: by id, or find/create by name within this business.
  let resolvedCustomerId = customerId as string | undefined;
  if (!resolvedCustomerId) {
    if (!customerName) return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    const found = await prisma.contact.findFirst({ where: { ownerId, name: customerName } });
    resolvedCustomerId = found?.id ?? (await prisma.contact.create({ data: { ownerId, name: customerName, type: 'CUSTOMER' } })).id;
  } else {
    const owned = await prisma.contact.findFirst({ where: { id: resolvedCustomerId, ownerId } });
    if (!owned) return NextResponse.json({ error: 'Invalid customer' }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      ownerId,
      invoiceNumber: await nextInvoiceNumber(ownerId),
      customerId: resolvedCustomerId!,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: new Date(dueDate),
      state: state === 'SENT' ? 'SENT' : 'DRAFT',
      items: JSON.stringify(lineItems),
      totalAmount: Math.round(lineItemsTotal(lineItems)),
    },
  });
  return NextResponse.json({ invoice }, { status: 201 });
}
