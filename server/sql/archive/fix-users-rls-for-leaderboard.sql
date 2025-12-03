-- Fix: Permitir leer nombres de usuarios para el leaderboard
-- Ejecutar este SQL en el SQL Editor de Supabase

-- Agregar política para que cualquiera pueda leer nombres de usuarios (para leaderboard)
-- Esto es necesario para que el JOIN funcione correctamente
DROP POLICY IF EXISTS "Anyone can read user names for leaderboard" ON public.users;
CREATE POLICY "Anyone can read user names for leaderboard" ON public.users
  FOR SELECT USING (true);

-- Nota: Esta política permite leer TODOS los campos de users, incluyendo name, id, email, etc.
-- Si quieres ser más restrictivo y solo permitir leer name e id, puedes usar:
-- CREATE POLICY "Anyone can read user names for leaderboard" ON public.users
--   FOR SELECT USING (true)
--   WITH CHECK (true);






