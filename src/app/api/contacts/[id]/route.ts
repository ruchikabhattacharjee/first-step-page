import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, ownerId: tenantOf(gate) } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { name, type, email, phone } = await req.json();
  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      type: type ?? existing.type,
      email: email === undefined ? existing.email : email || null,
      phone: phone === undefined ? existing.phone : phone || null,
    },
  });
  return NextResponse.json({ contact });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, ownerId: tenantOf(gate) } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Block deletion if the contact is still referenced by invoices/bills.
  const refs = await prisma.invoice.count({ where: { customerId: id } })
    + await prisma.bill.count({ where: { vendorId: id } });
  if (refs > 0) {
    return NextResponse.json({ error: 'Cannot delete a contact with linked invoices or bills.' }, { status: 409 });
  }

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
