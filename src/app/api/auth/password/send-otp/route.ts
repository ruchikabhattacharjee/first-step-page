import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';

// Send a one-time code for a password change / reset. Used by both the
// in-profile "Change Password" flow and the login "Forgot password" flow.
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // Only generate + send a code when the account actually exists and is
  // verified. We always return success so the endpoint can't be used to probe
  // which emails are registered.
  if (user && user.isVerified) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    await prisma.otpToken.deleteMany({ where: { email } });
    await prisma.otpToken.create({ data: { email, otp, expiresAt } });

    const { sent } = await sendMail({
      to: email,
      subject: 'Your CashFlow Pro password reset code',
      text: `Your password reset code is: ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<h3>Password reset</h3><p>Your 6-digit code is: <strong>${otp}</strong></p><p>It expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>`,
    });
    if (!sent && process.env.NODE_ENV !== 'production') {
      console.warn(`[mailer] DEV FALLBACK — password reset OTP for ${email} is: ${otp}`);
    }
  }

  return NextResponse.json({ success: true });
}
