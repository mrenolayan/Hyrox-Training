// ════════════════════════════════════════════════════════════════════════════
//  auth.js — invite & role business logic. Pure functions: no React, no
//  Supabase, no I/O. The session wrappers that used to live here talk to
//  Supabase, so they moved to db.js in Phase 8 — db.js is the only boundary.
// ════════════════════════════════════════════════════════════════════════════

export const INVITE_TTL_DAYS = 30;

// 48-hex-char random token. crypto.getRandomValues is the browser's CSPRNG —
// unguessable, unlike Math.random().
export function generateInviteToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isInviteExpired(invite, now = new Date()) {
  return new Date(invite.expires_at).getTime() < now.getTime();
}

// 'accepted' | 'expired' | 'pending' | null — drives the dashboard status chip.
export function inviteStatus(invite, now = new Date()) {
  if (!invite) return null;
  if (invite.accepted_at) return "accepted";
  if (isInviteExpired(invite, now)) return "expired";
  return "pending";
}

// An athlete can be re-invited; the newest invite is the meaningful one.
export function latestInvite(invites) {
  if (!invites?.length) return null;
  return [...invites].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )[0];
}

// Coach wins if an email somehow matches both a coach and an athlete row.
export function resolveRole({ coach, athlete }) {
  if (coach) return "coach";
  if (athlete) return "athlete";
  return null;
}

export function inviteUrl(origin, pathname, token) {
  return `${origin}${pathname}?invite=${token}`;
}
