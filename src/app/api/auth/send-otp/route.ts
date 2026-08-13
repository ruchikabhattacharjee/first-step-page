import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { fullName, businessName, email, password, businessType, otherBusinessType, country, currency, fyStartMonth, teamInvites } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Clean up stale unverified signups (older than 24h) so abandoned
    // registrations don't accumulate.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.user.deleteMany({ where: { isVerified: false, createdAt: { lt: dayAgo } } });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.isVerified) {
      return NextResponse.json({ error: 'User already exists and is verified. Please log in.' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const finalBusinessType = businessType === 'Other' ? otherBusinessType : businessType;

    // Create or update unverified business owner (Admin of their own business).
    const owner = existingUser
      ? await prisma.user.update({
          where: { email },
          data: {
            name: fullName, businessName, passwordHash,
            industry: finalBusinessType || '',
            country: country || 'India', currency: currency || 'INR',
            fyStartMonth: parseInt(fyStartMonth) || 4, role: 'Admin',
          },
        })
      : await prisma.user.create({
          data: {
            name: fullName, businessName, email, passwordHash,
            industry: finalBusinessType || '',
            country: country || 'India', currency: currency || 'INR',
            fyStartMonth: parseInt(fyStartMonth) || 4, role: 'Admin', isVerified: false,
          },
        });

    // Create team members if any. Invited users get a random placeholder hash
    // (never the admin's password), and join the owner's business via businessId.
    if (teamInvites && teamInvites.length > 0) {
      for (const invite of teamInvites) {
        if (invite.email) {
          const placeholderHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
          await prisma.user.upsert({
            where: { email: invite.email },
            update: { businessId: owner.id, role: invite.role },
            create: {
              name: `Invited ${invite.role}`,
              businessName,
              email: invite.email,
              passwordHash: placeholderHash,
              industry: finalBusinessType || '',
              role: invite.role,
              isVerified: false,
              businessId: owner.id,
            },
          });
        }
      }
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    // Invalidate any earlier codes for this email, then store the new one.
    await prisma.otpToken.deleteMany({ where: { email } });
    await prisma.otpToken.create({ data: { email, otp, expiresAt } });

    // Send the OTP email (forced over IPv4 — see src/lib/mailer.ts).
    await sendOtpEmail(email, otp);

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('Send OTP Error:', error);
    const isNetworkError = ['ESOCKET', 'ETIMEDOUT', 'ECONNECTION', 'ENETUNREACH'].includes(error?.code);
    return NextResponse.json(
      {
        error: isNetworkError
          ? 'Could not reach the email server. Please check your internet connection and try again.'
          : 'Failed to send OTP'
      },
      { status: 500 }
    );
  }
}
