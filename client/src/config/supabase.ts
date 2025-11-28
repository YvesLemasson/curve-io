// Configuración de Supabase para el cliente
import { createClient } from '@supabase/supabase-js';

// Obtener variables de entorno (Vite usa import.meta.env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

// Cliente de Supabase para el cliente (usa anon key, respeta RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

