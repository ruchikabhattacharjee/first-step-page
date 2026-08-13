import { NextResponse } from 'next/server';

export async function POST() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookieString = `auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`;

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', cookieString);
  return response;
}
