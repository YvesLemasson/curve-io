// Contexto de autenticación con Supabase
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Usar window.location.origin para que funcione tanto en desarrollo como producción
    const redirectTo = `${window.location.origin}/auth/callback`;
    
    console.log('Iniciando login con Google, redirectTo:', redirectTo);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    // Primero limpiar el estado local inmediatamente (mejor UX)
    // Esto asegura que la UI se actualice de inmediato
    setSession(null);
    setUser(null);
    
    try {
      // Verificar si hay una sesión antes de intentar cerrar sesión en el servidor
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Intentar cerrar sesión en el servidor de forma silenciosa
        // Si falla, no importa porque ya limpiamos el estado local
        supabase.auth.signOut().catch((error) => {
          // Solo loggear el error en modo desarrollo, no afectar la UX
          if (import.meta.env.DEV) {
            console.warn('Error signing out from server (ignored):', error.message);
          }
        });
      }
    } catch (err: any) {
      // Si hay cualquier error, ignorarlo completamente
      // El usuario ya está "deslogueado" localmente
      if (import.meta.env.DEV) {
        console.warn('Unexpected error during sign out (ignored):', err?.message || err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

