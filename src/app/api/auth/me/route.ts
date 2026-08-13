import { NextResponse } from 'next/server';
import { getCurrentUser, tenantOf } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { passwordHash, ...safe } = user;

  // The bank balance is a business-level figure stored on the owner's row.
  // Invited members should see the tenant's balance, not their own (which is 0).
  const tenant = tenantOf(user);
  if (tenant !== user.id) {
    const owner = await prisma.user.findUnique({ where: { id: tenant }, select: { bankBalance: true } });
    if (owner) safe.bankBalance = owner.bankBalance;
  }

  return NextResponse.json({ user: safe });
}
