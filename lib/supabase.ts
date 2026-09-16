import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient<any> | undefined;

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables");
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    if (!/^https?:$/.test(parsedUrl.protocol) || !parsedUrl.hostname) throw new Error();
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no es una URL válida. Usa la URL de API de tu proyecto Supabase.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient<any>(supabaseUrl, supabasePublishableKey);
  }

  return supabaseClient;
}
