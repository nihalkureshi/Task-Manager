import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_KEY. Add them in Vercel Environment Variables."
    );
  }

  client = createClient(url, key);
  return client;
}

// Lazy proxy so build does not require env vars at import time.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getSupabaseBrowserClient();
    const value = instance[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
