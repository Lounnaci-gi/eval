import { NextResponse } from 'next/server';
import { verifyAccessToken } from './jwt';

export function withAuth(req: Request): { userId?: string; error?: Response } {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
  }
  const token = auth.split(' ')[1];
  try {
    const payload = verifyAccessToken(token) as any;
    return { userId: payload.userId };
  } catch (e) {
    return { error: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 }) };
  }
}
