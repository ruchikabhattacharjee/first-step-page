import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;

  const { name, type, email, phone } = await req.json();
  if (!name || !type) {
    return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: { ownerId: tenantOf(gate), name, type, email: email || null, phone: phone || null },
  });
  return NextResponse.json({ contact }, { status: 201 });
}
