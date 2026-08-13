import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSession, sessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const tokenRecord = await prisma.otpToken.findFirst({
      where: { email, otp, purpose: 'SIGNUP' },
      orderBy: { createdAt: 'desc' }
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
    }

    // Verify User
    const user = await prisma.user.update({
      where: { email },
      data: { isVerified: true }
    });

    // Delete used OTPs
    await prisma.otpToken.deleteMany({ where: { email } });

    // Generate JWT and set cookie
    const token = signSession({ userId: user.id, email: user.email, role: user.role });
    const cookieString = sessionCookie(token);

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', cookieString);
    return response;

  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
