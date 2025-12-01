-- ============================================
-- FASE 1: Sistema de Rating/MMR (Elo)
-- ============================================
-- Este script implementa el sistema básico de rating Elo/MMR
-- Ejecutar en el SQL Editor de Supabase

-- 1. Agregar columnas de rating a player_stats
ALTER TABLE public.player_stats 
  ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS peak_rating INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS rating_change INTEGER DEFAULT 0;

-- Inicializar ratings existentes si no tienen valor
UPDATE public.player_stats 
SET 
  elo_rating = COALESCE(elo_rating, 1000),
  peak_rating = COALESCE(peak_rating, 1000)
WHERE elo_rating IS NULL OR peak_rating IS NULL;

-- 2. Crear tabla de historial de rating
CREATE TABLE IF NOT EXISTS public.rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  rating_change INTEGER NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON public.rating_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_game ON public.rating_history(game_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_elo ON public.player_stats(elo_rating DESC);

-- 3. Crear función para calcular nuevo rating (Elo)
CREATE OR REPLACE FUNCTION calculate_new_rating(
  current_rating INTEGER,
  opponent_ratings INTEGER[],
  final_position INTEGER, -- 1 = ganador, 2 = segundo, etc.
  total_players INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  k_factor INTEGER := 30; -- Factor de volatilidad (ajustable según experiencia)
  expected_score NUMERIC := 0;
  actual_score NUMERIC;
  avg_opponent_rating NUMERIC;
  rating_change INTEGER;
BEGIN
  -- Si no hay oponentes, usar rating promedio (1000)
  IF opponent_ratings IS NULL OR array_length(opponent_ratings, 1) = 0 THEN
    avg_opponent_rating := 1000;
  ELSE
    -- Calcular rating promedio de oponentes
    SELECT AVG(r) INTO avg_opponent_rating 
    FROM unnest(opponent_ratings) AS r;
  END IF;
  
  -- Calcular resultado esperado (fórmula Elo estándar)
  -- E = 1 / (1 + 10^((R_opponent - R_player) / 400))
  expected_score := 1.0 / (1.0 + POWER(10.0, (avg_opponent_rating - current_rating) / 400.0));
  
  -- Calcular resultado real (normalizado 0-1)
  -- El ganador obtiene 1.0, segundo 0.8, tercero 0.6, etc.
  -- Fórmula: 1.0 - ((final_position - 1) * 0.2 / (total_players - 1))
  IF total_players <= 1 THEN
    actual_score := 1.0;
  ELSE
    actual_score := 1.0 - ((final_position - 1) * 0.2 / (total_players - 1));
    -- Asegurar que actual_score esté entre 0 y 1
    actual_score := GREATEST(0.0, LEAST(1.0, actual_score));
  END IF;
  
  -- Calcular cambio de rating
  -- Nuevo Rating = Rating Actual + K × (Resultado Real - Resultado Esperado)
  rating_change := ROUND(k_factor * (actual_score - expected_score));
  
  -- Retornar nuevo rating (asegurar que no sea negativo)
  RETURN GREATEST(0, current_rating + rating_change);
END;
$$ LANGUAGE plpgsql;

-- 4. Actualizar función de trigger para incluir sistema de rating
CREATE OR REPLACE FUNCTION update_player_stats_with_rating()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_rating INTEGER;
  old_rating INTEGER;
  rating_change INTEGER;
  is_winner BOOLEAN;
  opponent_ratings INTEGER[];
  total_players_count INTEGER;
BEGIN
  -- Obtener rating actual del jugador
  SELECT elo_rating INTO old_rating
  FROM public.player_stats
  WHERE user_id = NEW.user_id;
  
  -- Si no existe, usar rating inicial (1000)
  IF old_rating IS NULL THEN
    old_rating := 1000;
  END IF;
  
  -- Obtener ratings de oponentes (todos los demás participantes en la partida)
  SELECT ARRAY_AGG(ps.elo_rating) INTO opponent_ratings
  FROM public.game_participants gp
  LEFT JOIN public.player_stats ps ON ps.user_id = gp.user_id
  WHERE gp.game_id = NEW.game_id 
    AND gp.user_id != NEW.user_id
    AND ps.elo_rating IS NOT NULL;
  
  -- Si no hay ratings de oponentes, usar 1000 como default
  IF opponent_ratings IS NULL OR array_length(opponent_ratings, 1) = 0 THEN
    opponent_ratings := ARRAY[1000];
  END IF;
  
  -- Obtener total de jugadores en la partida
  SELECT COUNT(*) INTO total_players_count
  FROM public.game_participants
  WHERE game_id = NEW.game_id;
  
  -- Calcular nuevo rating usando la función
  new_rating := calculate_new_rating(
    old_rating,
    opponent_ratings,
    NEW.position,
    total_players_count
  );
  
  rating_change := new_rating - old_rating;
  is_winner := NEW.position = 1;
  
  -- Actualizar o insertar estadísticas del jugador
  INSERT INTO public.player_stats (
    user_id, 
    total_games, 
    total_wins, 
    total_score, 
    best_score,
    elo_rating,
    peak_rating,
    rating_change
  )
  VALUES (
    NEW.user_id,
    1,
    CASE WHEN is_winner THEN 1 ELSE 0 END,
    NEW.score,
    NEW.score,
    new_rating,
    new_rating, -- peak_rating se actualizará con GREATEST en el UPDATE
    rating_change
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_games = player_stats.total_games + 1,
    total_wins = player_stats.total_wins + CASE WHEN is_winner THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + NEW.score,
    best_score = GREATEST(player_stats.best_score, NEW.score),
    elo_rating = new_rating,
    peak_rating = GREATEST(player_stats.peak_rating, new_rating),
    rating_change = rating_change,
    updated_at = NOW();
  
  -- Guardar en historial de rating
  INSERT INTO public.rating_history (user_id, rating, rating_change, game_id)
  VALUES (NEW.user_id, new_rating, rating_change, NEW.game_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Reemplazar trigger existente con el nuevo
DROP TRIGGER IF EXISTS update_stats_on_participant_insert ON public.game_participants;
CREATE TRIGGER update_stats_on_participant_insert
  AFTER INSERT ON public.game_participants
  FOR EACH ROW EXECUTE FUNCTION update_player_stats_with_rating();

-- 6. Políticas RLS para rating_history
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer el historial de rating (para gráficos y estadísticas)
CREATE POLICY "Anyone can read rating history" ON public.rating_history
  FOR SELECT USING (true);

-- El sistema puede insertar en rating_history (a través del trigger)
CREATE POLICY "System can insert rating history" ON public.rating_history
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Verificación
-- ============================================
-- Para verificar que todo funciona, puedes ejecutar:
-- SELECT * FROM player_stats LIMIT 5;
-- SELECT * FROM rating_history ORDER BY created_at DESC LIMIT 10;

