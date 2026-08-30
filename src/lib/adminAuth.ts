import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase';

export async function requireAdmin(request: Request): Promise<{ admin: SupabaseClient; userId: string; email?: string }> {
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw new Error('UNAUTHORIZED: Missing admin session.');

  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error('UNAUTHORIZED: Invalid or expired admin session.');

  const { data: row, error: adminError } = await admin
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError || !row) throw new Error('FORBIDDEN: This account is not authorized as an administrator.');
  return { admin, userId: userData.user.id, email: userData.user.email || undefined };
}

export function adminErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const status = message.startsWith('UNAUTHORIZED:') ? 401 : message.startsWith('FORBIDDEN:') ? 403 : 500;
  return new Response(JSON.stringify({ error: message.replace(/^(UNAUTHORIZED|FORBIDDEN):\s*/, '') }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
