import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireAdmin } from '@/lib/rbac';

// Danger zone: wipe all business records for the tenant (keeps user accounts).
// Useful for starting from a clean slate while testing.
export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const ownerId = tenantOf(gate);

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { ownerId } }),
    prisma.invoice.deleteMany({ where: { ownerId } }),
    prisma.bill.deleteMany({ where: { ownerId } }),
    prisma.contact.deleteMany({ where: { ownerId } }),
    prisma.budget.deleteMany({ where: { ownerId } }),
    prisma.user.update({ where: { id: ownerId }, data: { bankBalance: 0, openingReceivables: 0, openingPayables: 0 } }),
  ]);

  return NextResponse.json({ success: true });
}
