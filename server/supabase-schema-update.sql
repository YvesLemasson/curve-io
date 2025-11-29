-- Script de actualización para Supabase
-- Ejecuta este SQL si ya tienes el schema base instalado

-- 1. Agregar política INSERT para users (si no existe)
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Actualizar la función para usar SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_player_stats_on_game_end()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar o insertar estadísticas del jugador
  INSERT INTO public.player_stats (user_id, total_games, total_wins, total_score, best_score)
  VALUES (
    NEW.user_id,
    1,
    CASE WHEN NEW.position = 1 THEN 1 ELSE 0 END,
    NEW.score,
    NEW.score
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_games = player_stats.total_games + 1,
    total_wins = player_stats.total_wins + CASE WHEN NEW.position = 1 THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + NEW.score,
    best_score = GREATEST(player_stats.best_score, NEW.score),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Actualizar políticas para player_stats (eliminar y recrear)
DROP POLICY IF EXISTS "System can insert stats" ON public.player_stats;
CREATE POLICY "System can insert stats" ON public.player_stats
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update stats" ON public.player_stats;
CREATE POLICY "System can update stats" ON public.player_stats
  FOR UPDATE USING (true);

