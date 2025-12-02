-- ============================================
-- Script para probar el trigger manualmente
-- ============================================
-- Este script inserta un participante de prueba para verificar que el trigger funciona

-- 1. Verificar que calculate_new_rating existe
SELECT 
  proname as function_name,
  pronargs as num_arguments,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'calculate_new_rating';

-- 2. Obtener el último game_id y user_id para probar
SELECT 
  gp.game_id,
  gp.user_id,
  u.name,
  gp.position,
  gp.score,
  gp.created_at
FROM game_participants gp
LEFT JOIN users u ON u.id = gp.user_id
ORDER BY gp.created_at DESC
LIMIT 1;

-- 3. Verificar el estado actual de player_stats antes de la prueba
SELECT 
  ps.user_id,
  u.name,
  ps.elo_rating,
  ps.rating_change,
  ps.total_games
FROM player_stats ps
LEFT JOIN users u ON u.id = ps.user_id
ORDER BY ps.updated_at DESC
LIMIT 1;

-- 4. Contar entradas actuales en rating_history
SELECT COUNT(*) as total_entries FROM rating_history;

-- 5. PROBAR EL TRIGGER MANUALMENTE
-- IMPORTANTE: Reemplaza los valores con los del paso 2
-- Descomenta y ajusta estos valores:
/*
DO $$
DECLARE
  test_game_id UUID := 'TU_GAME_ID_AQUI';  -- Reemplaza con un game_id real
  test_user_id UUID := 'TU_USER_ID_AQUI';  -- Reemplaza con un user_id real
  test_position INTEGER := 1;
  test_score INTEGER := 100;
  rating_before INTEGER;
  rating_after INTEGER;
  entries_before INTEGER;
  entries_after INTEGER;
BEGIN
  -- Obtener estado antes
  SELECT elo_rating INTO rating_before
  FROM player_stats
  WHERE user_id = test_user_id;
  
  SELECT COUNT(*) INTO entries_before
  FROM rating_history
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'ANTES - Rating: %, Entradas en historial: %', rating_before, entries_before;
  
  -- Insertar participante (esto debería activar el trigger)
  BEGIN
    INSERT INTO game_participants (game_id, user_id, score, position)
    VALUES (test_game_id, test_user_id, test_score, test_position)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Participante insertado';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error al insertar: %', SQLERRM;
  END;
  
  -- Esperar un momento
  PERFORM pg_sleep(1);
  
  -- Obtener estado después
  SELECT elo_rating INTO rating_after
  FROM player_stats
  WHERE user_id = test_user_id;
  
  SELECT COUNT(*) INTO entries_after
  FROM rating_history
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'DESPUÉS - Rating: %, Entradas en historial: %', rating_after, entries_after;
  RAISE NOTICE 'Cambio de rating: %', rating_after - rating_before;
  RAISE NOTICE 'Nuevas entradas en historial: %', entries_after - entries_before;
END $$;
*/

-- 6. Verificar si hay errores recientes en los logs
-- (Esto requiere acceso a los logs de PostgreSQL)
-- En Supabase: Dashboard > Logs > Postgres Logs
-- Busca mensajes que contengan "update_player_stats_with_rating" o "WARNING"




