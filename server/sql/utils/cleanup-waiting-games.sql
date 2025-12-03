-- ============================================
-- Limpiar partidas antiguas en estado "waiting"
-- ============================================
-- Ejecutar en el SQL Editor de Supabase

-- 1. Ver partidas en estado "waiting" o "lobby"
SELECT 
  id,
  status,
  created_at,
  started_at,
  ended_at,
  (SELECT COUNT(*) FROM game_participants WHERE game_id = games.id) as participants_count
FROM games
WHERE status IN ('waiting', 'lobby')
ORDER BY created_at DESC;

-- 2. Cambiar todas las partidas antiguas en "waiting" a "finished"
-- (Esto evitará que se reutilicen)
UPDATE games
SET 
  status = 'finished',
  ended_at = NOW()
WHERE status IN ('waiting', 'lobby')
  AND created_at < NOW() - INTERVAL '1 hour';  -- Partidas de hace más de 1 hora

-- 3. Verificar que se actualizaron
SELECT 
  id,
  status,
  created_at,
  ended_at
FROM games
WHERE status IN ('waiting', 'lobby')
ORDER BY created_at DESC;

