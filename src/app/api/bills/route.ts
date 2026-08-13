import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { lineItemsTotal, EXPENSE_CATEGORIES, type LineItem } from '@/lib/constants';

async function nextBillNumber(ownerId: string): Promise<string> {
  const bills = await prisma.bill.findMany({ where: { ownerId }, select: { billNumber: true } });
  const max = bills.reduce((m, b) => {
    const n = parseInt(b.billNumber.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `BILL-${String(max + 1).padStart(4, '0')}`;
}

export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const ownerId = tenantOf(gate);

  const { vendorId, vendorName, billNumber, billDate, dueDate, category, items, state } = await req.json();
  const lineItems: LineItem[] = Array.isArray(items) ? items : [];
  if (!dueDate || lineItems.length === 0) {
    return NextResponse.json({ error: 'Due date and at least one line item are required' }, { status: 400 });
  }
  const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'Other';

  let resolvedVendorId = vendorId as string | undefined;
  if (!resolvedVendorId) {
    if (!vendorName) return NextResponse.json({ error: 'Vendor is required' }, { status: 400 });
    const found = await prisma.contact.findFirst({ where: { ownerId, name: vendorName } });
    resolvedVendorId = found?.id ?? (await prisma.contact.create({ data: { ownerId, name: vendorName, type: 'VENDOR' } })).id;
  } else {
    const owned = await prisma.contact.findFirst({ where: { id: resolvedVendorId, ownerId } });
    if (!owned) return NextResponse.json({ error: 'Invalid vendor' }, { status: 400 });
  }

  const bill = await prisma.bill.create({
    data: {
      ownerId,
      billNumber: billNumber || (await nextBillNumber(ownerId)),
      vendorId: resolvedVendorId!,
      billDate: billDate ? new Date(billDate) : new Date(),
      dueDate: new Date(dueDate),
      category: cat,
      state: state === 'PENDING' ? 'PENDING' : 'DRAFT',
      items: JSON.stringify(lineItems),
      totalAmount: Math.round(lineItemsTotal(lineItems)),
    },
  });
  return NextResponse.json({ bill }, { status: 201 });
}
