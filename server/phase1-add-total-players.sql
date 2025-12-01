-- ============================================
-- Agregar campo total_players a games
-- ============================================
-- Este script agrega el campo total_players para mejorar el cálculo de ELO
-- cuando hay jugadores guest (no autenticados)

-- 1. Agregar columna total_players a games
ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS total_players INTEGER;

-- 2. Actualizar trigger para usar total_players si está disponible
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
  game_total_players INTEGER;
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
  -- Primero intentar usar total_players de games (incluye guests)
  SELECT total_players INTO game_total_players
  FROM public.games
  WHERE id = NEW.game_id;
  
  -- Si total_players está disponible, usarlo; sino contar participantes autenticados
  IF game_total_players IS NOT NULL AND game_total_players > 0 THEN
    total_players_count := game_total_players;
  ELSE
    -- Fallback: contar solo participantes autenticados
    SELECT COUNT(*) INTO total_players_count
    FROM public.game_participants
    WHERE game_id = NEW.game_id;
  END IF;
  
  -- Asegurar que total_players_count sea al menos 1
  IF total_players_count < 1 THEN
    total_players_count := 1;
  END IF;
  
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

