-- ============================================
-- Script para depurar el trigger de ELO
-- ============================================
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar que la función calculate_new_rating existe
SELECT 
  proname as function_name,
  pronargs as num_args
FROM pg_proc 
WHERE proname = 'calculate_new_rating';

-- 2. Verificar los últimos participantes insertados
SELECT 
  gp.id,
  gp.game_id,
  gp.user_id,
  gp.position,
  gp.score,
  gp.created_at,
  u.name as user_name
FROM game_participants gp
LEFT JOIN users u ON u.id = gp.user_id
ORDER BY gp.created_at DESC
LIMIT 5;

-- 3. Verificar si hay entradas en rating_history
SELECT 
  rh.id,
  rh.user_id,
  rh.rating,
  rh.rating_change,
  rh.game_id,
  rh.created_at,
  u.name as user_name
FROM rating_history rh
LEFT JOIN users u ON u.id = rh.user_id
ORDER BY rh.created_at DESC
LIMIT 10;

-- 4. Verificar player_stats para ver si se está actualizando
SELECT 
  ps.user_id,
  u.name,
  ps.elo_rating,
  ps.peak_rating,
  ps.rating_change,
  ps.total_games,
  ps.updated_at
FROM player_stats ps
LEFT JOIN users u ON u.id = ps.user_id
ORDER BY ps.updated_at DESC
LIMIT 5;

-- 5. Probar la función manualmente (reemplazar con IDs reales de la última partida)
-- Obtener el último game_id y user_id
DO $$
DECLARE
  test_game_id UUID;
  test_user_id UUID;
  test_position INTEGER := 1;
  test_score INTEGER := 100;
BEGIN
  -- Obtener el último game_id y user_id
  SELECT gp.game_id, gp.user_id 
  INTO test_game_id, test_user_id
  FROM game_participants gp
  ORDER BY gp.created_at DESC
  LIMIT 1;
  
  IF test_game_id IS NOT NULL AND test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Probando trigger con game_id: %, user_id: %', test_game_id, test_user_id;
    
    -- Intentar insertar un participante de prueba (esto debería activar el trigger)
    -- NOTA: Esto puede fallar si ya existe, pero eso está bien
    BEGIN
      INSERT INTO game_participants (game_id, user_id, score, position)
      VALUES (test_game_id, test_user_id, test_score, test_position)
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Participante insertado (o ya existía)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error al insertar participante: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'No se encontraron participantes para probar';
  END IF;
END $$;

-- 6. Verificar los logs de PostgreSQL (si están disponibles)
-- En Supabase, puedes ver los logs en el dashboard bajo "Logs" > "Postgres Logs"




