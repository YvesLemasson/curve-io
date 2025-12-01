-- Fix para el error "column reference rating_change is ambiguous"
-- El problema está en la línea 164 del trigger update_player_stats_with_rating
-- donde rating_change = rating_change es ambiguo

-- Recrear la función con la corrección
CREATE OR REPLACE FUNCTION update_player_stats_with_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_rating INTEGER;
  old_rating INTEGER;
  rating_change_var INTEGER;  -- Renombrar variable para evitar ambigüedad
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
  
  rating_change_var := new_rating - old_rating;  -- Usar variable renombrada
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
    rating_change_var  -- Usar variable renombrada
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_games = player_stats.total_games + 1,
    total_wins = player_stats.total_wins + CASE WHEN is_winner THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + NEW.score,
    best_score = GREATEST(player_stats.best_score, NEW.score),
    elo_rating = new_rating,
    peak_rating = GREATEST(player_stats.peak_rating, new_rating),
    rating_change = rating_change_var,  -- Usar variable renombrada para evitar ambigüedad
    updated_at = NOW();
  
  -- Guardar en historial de rating
  INSERT INTO public.rating_history (user_id, rating, rating_change, game_id)
  VALUES (NEW.user_id, new_rating, rating_change_var, NEW.game_id);  -- Usar variable renombrada
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en update_player_stats_with_rating: %', SQLERRM;
    RAISE WARNING 'user_id: %, game_id: %, position: %, score: %', NEW.user_id, NEW.game_id, NEW.position, NEW.score;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

