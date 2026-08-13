import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * The tenant (business) id a user's data lives under. Invited team members
 * share their inviter's tenant; a solo owner is their own tenant.
 */
export function tenantOf(user: { id: string; businessId: string | null }): string {
  return user.businessId ?? user.id;
}

/**
 * Resolve the currently logged-in user from the `auth_token` cookie.
 * Returns `null` when there is no valid session. Use this in Server
 * Components and route handlers to personalise data per account.
 */
export async function getCurrentUser() {
  const token = (await cookies()).get('auth_token')?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
    return await prisma.user.findUnique({ where: { id: payload.userId } });
  } catch {
    return null;
  }
}
