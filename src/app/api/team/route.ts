import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { tenantOf, getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/rbac';
import { sendMail } from '@/lib/mailer';

const ROLES = ['Admin', 'Accountant', 'Viewer'];

const safe = (u: any) => {
  const { passwordHash, ...rest } = u;
  return rest;
};

// List everyone in the current tenant (owner + invited members).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const tenant = tenantOf(user);

  const members = await prisma.user.findMany({
    where: { OR: [{ id: tenant }, { businessId: tenant }] },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    ownerId: tenant,
    canManage: user.role === 'Admin',
    members: members.map((m) => safe({ ...m, isOwner: m.id === tenant })),
  });
}

// Invite a team member: creates their account under this tenant with a
// temporary password and emails them credentials.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const tenant = tenantOf(gate);

  const { name, email, role } = await req.json();
  if (!name || !email || !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Name, email and a valid role are required.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 });

  const tempPassword = randomBytes(6).toString('base64url'); // ~8 chars
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const member = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      businessId: tenant,
      businessName: gate.businessName,
      industry: gate.industry,
      country: gate.country,
      currency: gate.currency,
      fyStartMonth: gate.fyStartMonth,
      isVerified: true, // invited members skip OTP; they sign in with temp creds
      setupComplete: true,
    },
  });

  const { sent } = await sendMail({
    to: email,
    subject: `You've been added to ${gate.businessName} on CashFlow Pro`,
    text: `Hi ${name},\n\n${gate.name} added you to ${gate.businessName} as ${role}.\n\nSign in at the app with:\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease change it after logging in.`,
    html: `<p>Hi ${name},</p><p><strong>${gate.name}</strong> added you to <strong>${gate.businessName}</strong> as <strong>${role}</strong> on CashFlow Pro.</p><p>Sign in with:</p><ul><li>Email: <strong>${email}</strong></li><li>Temporary password: <strong>${tempPassword}</strong></li></ul><p>Please change your password after logging in.</p>`,
  });

  return NextResponse.json({
    member: safe(member),
    tempPassword, // surfaced to the admin so they can share it if email is blocked
    emailed: sent,
  }, { status: 201 });
}
