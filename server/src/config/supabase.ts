// Configuración de Supabase para el servidor
import { createClient } from '@supabase/supabase-js';

// Obtener variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key (bypasses RLS)

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Cliente de Supabase con service role key (para operaciones del servidor)
// Este cliente puede bypass RLS, así que úsalo con cuidado
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Tipos para TypeScript (se generarán automáticamente con Supabase CLI si lo usas)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          google_id: string | null;
          email: string | null;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          google_id?: string | null;
          email?: string | null;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          google_id?: string | null;
          email?: string | null;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          started_at: string;
          ended_at: string | null;
          status: string;
          winner_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          started_at?: string;
          ended_at?: string | null;
          status?: string;
          winner_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          started_at?: string;
          ended_at?: string | null;
          status?: string;
          winner_id?: string | null;
          created_at?: string;
        };
      };
      game_participants: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          score: number;
          position: number | null;
          eliminated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          score?: number;
          position?: number | null;
          eliminated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          user_id?: string;
          score?: number;
          position?: number | null;
          eliminated_at?: string | null;
          created_at?: string;
        };
      };
      player_stats: {
        Row: {
          user_id: string;
          total_games: number;
          total_wins: number;
          total_score: number;
          best_score: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_games?: number;
          total_wins?: number;
          total_score?: number;
          best_score?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_games?: number;
          total_wins?: number;
          total_score?: number;
          best_score?: number;
          updated_at?: string;
        };
      };
    };
  };
}

