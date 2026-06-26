// ════════════════════════════════════════════════════════════════════════════
//  auth.js — thin wrapper around Supabase Auth.
//
//  Only this file and db.js import supabaseClient. All other modules (including
//  App.jsx) call these named functions instead.
// ════════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabaseClient.js";

// Send a magic-link email. The link lands back at window.location.origin.
export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw new Error(`sendMagicLink: ${error.message}`);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`signOut: ${error.message}`);
}

// Returns the current Supabase session, or null if not logged in.
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`getSession: ${error.message}`);
  return data.session;
}

// Subscribe to auth state changes. Returns an unsubscribe function.
// callback(session) — session is null when signed out.
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}
