import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// PUBLIC client — safe to use anywhere, including in the browser.
// Uses the anon key, which is restricted by Row Level Security (RLS)
// to read-only access on published tours (see supabase/schema.sql).
// ------------------------------------------------------------------
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

// ------------------------------------------------------------------
// ADMIN client — SERVER-SIDE ONLY. Never import this file from a
// component that runs in the browser. It uses the service role key,
// which bypasses RLS entirely and can insert/update/delete anything.
// Only use it inside src/pages/api/*.ts route handlers.
// ------------------------------------------------------------------
export function getSupabaseAdmin() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing. Add it to your .env file (server-side only, never expose it to the browser).'
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
