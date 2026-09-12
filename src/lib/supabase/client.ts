import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../chain/config";
import type { Database } from "./types";

/**
 * One Supabase client for the app, mirroring how `providers.tsx` keeps one
 * Kit client.
 *
 * The publishable key is public by design — RLS is what protects the data,
 * not the key. The secret key must never appear in this bundle.
 */
export const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.anonKey
);
