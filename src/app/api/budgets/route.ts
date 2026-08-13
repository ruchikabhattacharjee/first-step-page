import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

// Upsert monthly budget targets for the current business.
export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const ownerId = tenantOf(gate);

  const { month, year, targets } = await req.json();
  if (!month || !year || typeof targets !== 'object') {
    return NextResponse.json({ error: 'month, year and targets are required' }, { status: 400 });
  }

  const ops = EXPENSE_CATEGORIES.filter((c) => targets[c] !== undefined).map((category) =>
    prisma.budget.upsert({
      where: { ownerId_year_month_category: { ownerId, year, month, category } },
      update: { amount: Math.round(Number(targets[category]) || 0) },
      create: { ownerId, year, month, category, amount: Math.round(Number(targets[category]) || 0) },
    })
  );
  await prisma.$transaction(ops);

  return NextResponse.json({ success: true });
}
