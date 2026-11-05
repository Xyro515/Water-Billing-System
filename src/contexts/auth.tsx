import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { isTerminalSessionError } from '../lib/sessionErrors';
import type { Tables } from '../types/database.types';

type ProfileRow = Tables<'profiles'>;

type SignInResult = { error: string | null };

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<ProfileRow | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function getProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const synchronizeSession = async (nextSession: Session | null) => {
    if (!nextSession) {
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextProfile = await getProfile(nextSession.user.id);
      if (!nextProfile || !nextProfile.is_active || nextProfile.archived_at) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setProfile(null);
      } else {
        setSession(nextSession);
        setProfile(nextProfile);
      }
    } catch {
      // A profile is required for every application session. Fail closed if it
      // cannot be verified (for example, while the Data API is unavailable).
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) void synchronizeSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        setSession(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }
      // Defer database work until after the auth callback releases its lock.
      setTimeout(() => {
        if (mounted) void synchronizeSession(nextSession);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void supabase.auth.getUser().then(async ({ data, error }) => {
        if (error || !data.user || data.user.id !== session.user.id) throw error ?? new Error('Session expired.');
        const nextProfile = await getProfile(data.user.id);
        if (!nextProfile?.is_active || nextProfile.archived_at) {
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setProfile(null);
        } else {
          setProfile(nextProfile);
        }
      }).catch(async (reason) => {
        // A brief offline period must not destroy a valid mobile session. Only
        // clear credentials when Supabase confirms that the session/token is
        // missing, revoked, or otherwise unauthorized.
        if (!isTerminalSessionError(reason)) return;
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setProfile(null);
      });
    });
    return () => subscription.remove();
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    isLoading,
    session,
    profile,
    signIn: async (email, password) => {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        setIsLoading(false);
        return { error: error?.message ?? 'Unable to start a session.' };
      }

      try {
        const nextProfile = await getProfile(data.session.user.id);
        if (!nextProfile || !nextProfile.is_active || nextProfile.archived_at) {
          await supabase.auth.signOut({ scope: 'local' });
          setIsLoading(false);
          return { error: 'This account is disabled or is not authorized for this application.' };
        }
        setSession(data.session);
        setProfile(nextProfile);
        setIsLoading(false);
        return { error: null };
      } catch {
        await supabase.auth.signOut({ scope: 'local' });
        setIsLoading(false);
        return { error: 'Your account profile could not be verified. Contact an administrator.' };
      }
    },
    signOut: async () => {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setProfile(null);
    },
    refreshProfile: async () => {
      if (!session) return null;
      const nextProfile = await getProfile(session.user.id);
      if (!nextProfile?.is_active || nextProfile.archived_at) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setProfile(null);
        return null;
      }
      setProfile(nextProfile);
      return nextProfile;
    },
  }), [isLoading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
