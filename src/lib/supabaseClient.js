// ════════════════════════════════════════════════════════════════════════════
//  supabaseClient.js — creates the ONE Supabase client.
//
//  This is the only file in the app that calls createClient(). Everything else
//  goes through lib/db.js. Do not import this anywhere except db.js.
//
//  Credentials come from .env.local (VITE_ vars), never hardcoded. The anon key
//  is safe in the browser only because RLS (Phase 4) limits what it can do.
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev so a missing .env.local is obvious, not a silent 401.
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(url, anonKey);
