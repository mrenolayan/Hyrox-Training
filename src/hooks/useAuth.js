import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "../lib/db.js";

// Wraps the Supabase session (via db.js — hooks never import Supabase) and
// resolves who the user is.
//   role: undefined = still resolving · null = signed out
//         'coach' | 'athlete' | 'unlinked' once known
export default function useAuth(inviteToken) {
  const [session, setSession]         = useState(undefined);
  const [role, setRole]               = useState(undefined);
  const [profile, setProfile]         = useState(null); // coach or athlete row
  const [inviteError, setInviteError] = useState(null);
  const inviteHandled = useRef(false); // accept once, even if session refires

  useEffect(() => {
    db.getSession().then(setSession).catch(() => setSession(null));
    return db.onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setRole(null); setProfile(null); return; }
    let cancelled = false;
    (async () => {
      try {
        // one-time links between the auth account and existing rows
        await db.linkCoachAuthId(session.user.id, session.user.email);
        if (inviteToken && !inviteHandled.current) {
          inviteHandled.current = true;
          try { await db.acceptInvite(inviteToken); }
          catch (e) { if (!cancelled) setInviteError(e.message); }
        }
        await db.linkAthleteAuthId(); // email-match fallback; no-op if linked
        const res = await db.getCurrentUserRole();
        if (!cancelled) {
          setRole(res.role ?? "unlinked");
          setProfile(res.coach ?? res.athlete ?? null);
        }
      } catch {
        if (!cancelled) { setRole("unlinked"); setProfile(null); }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const signInWithMagicLink = useCallback(
    (email, redirectTo) => db.sendMagicLink(email, redirectTo), []);
  const verifyOtpCode = useCallback(
    (email, token) => db.verifyOtpCode(email, token), []);
  const signOut = useCallback(() => db.signOut(), []);

  const loading = session === undefined || (!!session && role === undefined);
  return { session, user: session?.user ?? null, role, profile, loading,
           inviteError, signInWithMagicLink, verifyOtpCode, signOut };
}
