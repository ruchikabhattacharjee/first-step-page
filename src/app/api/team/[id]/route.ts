import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireAdmin } from '@/lib/rbac';

type Ctx = { params: Promise<{ id: string }> };
const ROLES = ['Admin', 'Accountant', 'Viewer'];

const inTenant = (member: { id: string; businessId: string | null }, tenant: string) =>
  member.id === tenant || member.businessId === tenant;

// Change a member's role.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const tenant = tenantOf(gate);

  if (id === tenant) return NextResponse.json({ error: "The business owner's role can't be changed." }, { status: 400 });

  const member = await prisma.user.findUnique({ where: { id } });
  if (!member || !inTenant(member, tenant)) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

  const { role } = await req.json();
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });

  const updated = await prisma.user.update({ where: { id }, data: { role } });
  const { passwordHash, ...safe } = updated;
  return NextResponse.json({ member: safe });
}

// Remove a member from the business.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const tenant = tenantOf(gate);

  if (id === tenant) return NextResponse.json({ error: "The business owner can't be removed." }, { status: 400 });
  if (id === gate.id) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });

  const member = await prisma.user.findUnique({ where: { id } });
  if (!member || !inTenant(member, tenant)) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
