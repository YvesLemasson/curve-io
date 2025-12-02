-- ============================================
-- Script mejorado para corregir el trigger de ELO
-- ============================================
-- Versión con mejor manejo de errores y logging

-- 1. Asegurar que la función calculate_new_rating existe
-- (Si no existe, ejecutar primero phase1-rating-migration.sql)

-- 2. Recrear la función con mejor manejo de errores
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
  error_message TEXT;
BEGIN
  -- Obtener rating actual del jugador
  BEGIN
    SELECT elo_rating INTO old_rating
    FROM public.player_stats
    WHERE user_id = NEW.user_id;
    
    -- Si no existe, usar rating inicial (1000)
    IF old_rating IS NULL THEN
      old_rating := 1000;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    old_rating := 1000;
    RAISE WARNING 'Error obteniendo rating actual, usando 1000: %', SQLERRM;
  END;
  
  -- Obtener ratings de oponentes
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    opponent_ratings := ARRAY[1000];
    RAISE WARNING 'Error obteniendo ratings de oponentes, usando 1000: %', SQLERRM;
  END;
  
  -- Obtener total de jugadores en la partida
  BEGIN
    SELECT total_players INTO game_total_players
    FROM public.games
    WHERE id = NEW.game_id;
    
    IF game_total_players IS NOT NULL AND game_total_players > 0 THEN
      total_players_count := game_total_players;
    ELSE
      SELECT COUNT(*) INTO total_players_count
      FROM public.game_participants
      WHERE game_id = NEW.game_id;
    END IF;
    
    IF total_players_count < 1 THEN
      total_players_count := 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    total_players_count := 1;
    RAISE WARNING 'Error obteniendo total de jugadores, usando 1: %', SQLERRM;
  END;
  
  -- Calcular nuevo rating
  BEGIN
    new_rating := calculate_new_rating(
      old_rating,
      opponent_ratings,
      COALESCE(NEW.position, 1),
      total_players_count
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error calculando nuevo rating: %. old_rating: %, opponent_ratings: %, position: %, total_players: %', 
      SQLERRM, old_rating, opponent_ratings, NEW.position, total_players_count;
  END;
  
  rating_change := new_rating - old_rating;
  is_winner := COALESCE(NEW.position, 1) = 1;
  
  -- Actualizar o insertar estadísticas del jugador
  BEGIN
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
      COALESCE(NEW.score, 0),
      COALESCE(NEW.score, 0),
      new_rating,
      new_rating,
      rating_change
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_games = player_stats.total_games + 1,
      total_wins = player_stats.total_wins + CASE WHEN is_winner THEN 1 ELSE 0 END,
      total_score = player_stats.total_score + COALESCE(NEW.score, 0),
      best_score = GREATEST(player_stats.best_score, COALESCE(NEW.score, 0)),
      elo_rating = new_rating,
      peak_rating = GREATEST(player_stats.peak_rating, new_rating),
      rating_change = rating_change,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error actualizando player_stats: %', SQLERRM;
  END;
  
  -- Guardar en historial de rating
  BEGIN
    INSERT INTO public.rating_history (user_id, rating, rating_change, game_id)
    VALUES (NEW.user_id, new_rating, rating_change, NEW.game_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error insertando en rating_history: %. user_id: %, rating: %, rating_change: %, game_id: %', 
      SQLERRM, NEW.user_id, new_rating, rating_change, NEW.game_id;
    -- No fallar el trigger si solo falla el historial
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error completo
    GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
    RAISE EXCEPTION 'Error en update_player_stats_with_rating: %. user_id: %, game_id: %, position: %, score: %', 
      error_message, NEW.user_id, NEW.game_id, NEW.position, NEW.score;
END;
$$ LANGUAGE plpgsql;

-- 3. Eliminar y recrear el trigger
DROP TRIGGER IF EXISTS update_stats_on_participant_insert ON public.game_participants;

CREATE TRIGGER update_stats_on_participant_insert
  AFTER INSERT ON public.game_participants
  FOR EACH ROW EXECUTE FUNCTION update_player_stats_with_rating();

-- 4. Habilitar el trigger
ALTER TABLE public.game_participants 
  ENABLE TRIGGER update_stats_on_participant_insert;

-- 5. Verificar que todo está correcto
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN 'Enabled (Origin)'
    WHEN 'D' THEN 'Disabled'
    WHEN 'R' THEN 'Replica'
    WHEN 'A' THEN 'Always'
    ELSE 'Unknown'
  END as enabled_status,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'update_stats_on_participant_insert';




