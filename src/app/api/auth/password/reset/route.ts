import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Validate the emailed OTP and set a new password. Works for both the logged-in
// "change password" flow and the logged-out "forgot password" flow.
export async function POST(req: NextRequest) {
  const { email, otp, newPassword } = await req.json();

  if (!email || !otp || !newPassword) {
    return NextResponse.json({ error: 'Email, code and new password are required' }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const tokenRecord = await prisma.otpToken.findFirst({
    where: { email, otp: String(otp) },
    orderBy: { createdAt: 'desc' },
  });
  if (!tokenRecord) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  if (tokenRecord.expiresAt < new Date()) return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  await prisma.otpToken.deleteMany({ where: { email } });

  return NextResponse.json({ success: true });
}
