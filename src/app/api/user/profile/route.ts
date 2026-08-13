import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();

  // Whitelist the fields a user is allowed to change. Email is intentionally
  // excluded — changing it would require re-verification.
  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.businessName === 'string') data.businessName = body.businessName.trim();
  if (typeof body.industry === 'string') data.industry = body.industry;
  if (typeof body.country === 'string') data.country = body.country;
  if (typeof body.currency === 'string') data.currency = body.currency;
  if (body.fyStartMonth !== undefined) data.fyStartMonth = parseInt(body.fyStartMonth) || current.fyStartMonth;
  if (body.bankBalance !== undefined) data.bankBalance = parseFloat(body.bankBalance) || 0;
  if (body.setupComplete !== undefined) data.setupComplete = Boolean(body.setupComplete);

  const updated = await prisma.user.update({ where: { id: current.id }, data });
  const { passwordHash, ...safe } = updated;
  return NextResponse.json({ user: safe });
}
