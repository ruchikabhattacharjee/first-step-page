import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';

export type Role = 'Admin' | 'Accountant' | 'Viewer';

/** Admins and Accountants can mutate data; Viewers are read-only. */
export function canWrite(role: string): boolean {
  return role === 'Admin' || role === 'Accountant';
}

/**
 * Guard for read access: returns the user, or a 401 response.
 * Usage: `const gate = await requireUser(); if (gate instanceof NextResponse) return gate;`
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return user;
}

/** Guard for write access: returns the user, or a 401/403 response. */
export async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!canWrite(user.role)) {
    return NextResponse.json(
      { error: 'Your role has read-only access. Ask an Admin to make changes.' },
      { status: 403 }
    );
  }
  return user;
}

/** Guard for team/admin-only actions: returns the user, or a 401/403 response. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'Admin') {
    return NextResponse.json({ error: 'Only an Admin can manage the team.' }, { status: 403 });
  }
  return user;
}
