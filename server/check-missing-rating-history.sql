-- ============================================
-- Verificar participantes sin entradas en rating_history
-- ============================================

-- 1. Encontrar participantes que no tienen entrada en rating_history
SELECT 
  gp.id as participant_id,
  gp.game_id,
  gp.user_id,
  gp.position,
  gp.score,
  gp.created_at as participant_created_at,
  u.name as user_name,
  CASE 
    WHEN rh.id IS NULL THEN 'MISSING ❌'
    ELSE 'EXISTS ✅'
  END as rating_history_status
FROM game_participants gp
LEFT JOIN users u ON u.id = gp.user_id
LEFT JOIN rating_history rh ON rh.user_id = gp.user_id AND rh.game_id = gp.game_id
WHERE rh.id IS NULL  -- Solo los que NO tienen entrada en rating_history
ORDER BY gp.created_at DESC
LIMIT 10;

-- 2. Verificar si estos participantes tienen player_stats actualizados
SELECT 
  gp.user_id,
  u.name,
  gp.game_id,
  gp.position,
  gp.score,
  ps.elo_rating,
  ps.rating_change,
  ps.total_games,
  ps.updated_at as stats_updated_at,
  gp.created_at as participant_created_at
FROM game_participants gp
LEFT JOIN users u ON u.id = gp.user_id
LEFT JOIN player_stats ps ON ps.user_id = gp.user_id
LEFT JOIN rating_history rh ON rh.user_id = gp.user_id AND rh.game_id = gp.game_id
WHERE rh.id IS NULL
ORDER BY gp.created_at DESC
LIMIT 10;

-- 3. Si hay participantes sin rating_history, podemos intentar procesarlos manualmente
-- (Descomenta y ajusta los valores si es necesario)
/*
DO $$
DECLARE
  participant_record RECORD;
  new_rating INTEGER;
  old_rating INTEGER;
  rating_change INTEGER;
  opponent_ratings INTEGER[];
  total_players_count INTEGER;
BEGIN
  -- Procesar cada participante sin rating_history
  FOR participant_record IN 
    SELECT gp.*
    FROM game_participants gp
    LEFT JOIN rating_history rh ON rh.user_id = gp.user_id AND rh.game_id = gp.game_id
    WHERE rh.id IS NULL
    ORDER BY gp.created_at DESC
    LIMIT 5
  LOOP
    BEGIN
      -- Obtener rating actual
      SELECT elo_rating INTO old_rating
      FROM player_stats
      WHERE user_id = participant_record.user_id;
      
      IF old_rating IS NULL THEN
        old_rating := 1000;
      END IF;
      
      -- Obtener ratings de oponentes
      SELECT ARRAY_AGG(ps.elo_rating) INTO opponent_ratings
      FROM game_participants gp2
      LEFT JOIN player_stats ps ON ps.user_id = gp2.user_id
      WHERE gp2.game_id = participant_record.game_id 
        AND gp2.user_id != participant_record.user_id
        AND ps.elo_rating IS NOT NULL;
      
      IF opponent_ratings IS NULL OR array_length(opponent_ratings, 1) = 0 THEN
        opponent_ratings := ARRAY[1000];
      END IF;
      
      -- Obtener total de jugadores
      SELECT COUNT(*) INTO total_players_count
      FROM game_participants
      WHERE game_id = participant_record.game_id;
      
      IF total_players_count < 1 THEN
        total_players_count := 1;
      END IF;
      
      -- Calcular nuevo rating
      new_rating := calculate_new_rating(
        old_rating,
        opponent_ratings,
        COALESCE(participant_record.position, 1),
        total_players_count
      );
      
      rating_change := new_rating - old_rating;
      
      -- Actualizar player_stats
      INSERT INTO player_stats (
        user_id, total_games, total_wins, total_score, best_score,
        elo_rating, peak_rating, rating_change
      )
      VALUES (
        participant_record.user_id,
        1,
        CASE WHEN COALESCE(participant_record.position, 1) = 1 THEN 1 ELSE 0 END,
        COALESCE(participant_record.score, 0),
        COALESCE(participant_record.score, 0),
        new_rating,
        new_rating,
        rating_change
      )
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = player_stats.total_games + 1,
        total_wins = player_stats.total_wins + CASE WHEN COALESCE(participant_record.position, 1) = 1 THEN 1 ELSE 0 END,
        total_score = player_stats.total_score + COALESCE(participant_record.score, 0),
        best_score = GREATEST(player_stats.best_score, COALESCE(participant_record.score, 0)),
        elo_rating = new_rating,
        peak_rating = GREATEST(player_stats.peak_rating, new_rating),
        rating_change = rating_change,
        updated_at = NOW();
      
      -- Insertar en rating_history
      INSERT INTO rating_history (user_id, rating, rating_change, game_id)
      VALUES (participant_record.user_id, new_rating, rating_change, participant_record.game_id);
      
      RAISE NOTICE 'Procesado: user_id %, game_id %, rating: %, change: %', 
        participant_record.user_id, participant_record.game_id, new_rating, rating_change;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error procesando participante %: %', participant_record.id, SQLERRM;
    END;
  END LOOP;
END $$;
*/






