-- ============================================
-- Script para verificar y corregir el trigger de ELO
-- ============================================
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar que el trigger existe y está activo
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgrelid::regclass as table_name,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgname = 'update_stats_on_participant_insert';

-- 2. Verificar que la función existe
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE proname = 'update_player_stats_with_rating';

-- 3. Verificar las últimas inserciones en game_participants
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

-- 4. Verificar si hay entradas en rating_history
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

-- 5. Verificar player_stats para ver si rating_change se está actualizando
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

-- 6. Si el trigger no está usando la función correcta, recrearlo:
-- (Descomentar si es necesario)
/*
DROP TRIGGER IF EXISTS update_stats_on_participant_insert ON public.game_participants;
CREATE TRIGGER update_stats_on_participant_insert
  AFTER INSERT ON public.game_participants
  FOR EACH ROW EXECUTE FUNCTION update_player_stats_with_rating();
*/

-- 7. Probar el trigger manualmente (reemplazar con IDs reales):
-- (Solo para testing, no ejecutar en producción)
/*
-- Insertar un participante de prueba para verificar que el trigger funciona
-- NOTA: Esto creará datos de prueba, úsalo solo para debugging
INSERT INTO game_participants (game_id, user_id, score, position)
VALUES (
  (SELECT id FROM games ORDER BY created_at DESC LIMIT 1),
  (SELECT id FROM users LIMIT 1),
  100,
  1
);
*/






