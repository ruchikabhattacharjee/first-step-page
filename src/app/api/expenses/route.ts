import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

// Quick Expense Logger — records an immediate out-of-pocket cost directly in
// the ledger, bypassing the bill workflow, and reduces the bank balance.
export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const ownerId = tenantOf(gate);

  const { date, category, amount, description } = await req.json();
  const value = Math.round(Number(amount));
  if (!value || value <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 });
  const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'Other';

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        ownerId, date: date ? new Date(date) : new Date(), amount: value,
        description: description || `${cat} expense`, type: 'OUT', category: cat, tag: 'OPERATING',
      },
    }),
    prisma.user.update({ where: { id: ownerId }, data: { bankBalance: { decrement: value } } }),
  ]);

  return NextResponse.json({ success: true }, { status: 201 });
}
