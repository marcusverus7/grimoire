import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getKv, setKv } from './db';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load cached session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const cached = getKv('supabase_session');
        if (cached) {
          const parsed = JSON.parse(cached);
          setSession(parsed);
        }
      } catch (e) {
        console.log('No cached session');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);

  // Navigate based on auth state
  useEffect(() => {
    if (!loading) {
      if (session) {
        router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
      } else {
        router.replace('/auth/login' as Parameters<typeof router.replace>[0]);
      }
    }
  }, [loading, session, router]);

  // Listen for auth changes. Wrapped defensively so a supabase init/runtime
  // error can never crash app startup — auth is non-essential to booting.
  useEffect(() => {
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
        setSession(sess ?? null);
        if (sess) {
          setKv('supabase_session', JSON.stringify(sess));
        } else {
          setKv('supabase_session', '');
        }
      });

      return () => {
        subscription?.unsubscribe();
      };
    } catch (e) {
      console.warn('Auth listener failed to attach:', e);
      return undefined;
    }
  }, []);

  // Fail loudly. A wrong password or a Supabase outage must surface to the
  // caller (the login/signup screen shows the alert), never silently succeed
  // into a fake session — that hid real auth failures and let bad credentials
  // "log in". Testers who want to skip auth use continueAsGuest() instead.
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut error (clearing local session anyway):', e);
    }
    setSession(null);
    setKv('supabase_session', '');
  };

  // Continue without an account — local guest session, no Supabase needed.
  // Lets testers (and offline users) reach the app without the auth gate.
  const continueAsGuest = () => {
    const guest = { user: { id: 'guest', email: 'guest@grimoire.local' }, access_token: 'guest' };
    setSession(guest as any);
    setKv('supabase_session', JSON.stringify(guest));
  };

  return (
    <AuthContext.Provider value={{ session, loading, signUp, signIn, signOut, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
