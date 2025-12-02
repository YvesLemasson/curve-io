-- ============================================
-- Verificar si se están creando nuevas partidas
-- ============================================

-- 1. Ver las últimas partidas creadas
SELECT 
  g.id,
  g.status,
  g.started_at,
  g.ended_at,
  g.total_players,
  COUNT(gp.id) as participants_count
FROM games g
LEFT JOIN game_participants gp ON gp.game_id = g.id
GROUP BY g.id, g.status, g.started_at, g.ended_at, g.total_players
ORDER BY g.created_at DESC
LIMIT 10;

-- 2. Verificar si hay participantes duplicados en la misma partida
SELECT 
  gp.game_id,
  gp.user_id,
  u.name,
  COUNT(*) as duplicate_count,
  MIN(gp.created_at) as first_insert,
  MAX(gp.created_at) as last_insert
FROM game_participants gp
LEFT JOIN users u ON u.id = gp.user_id
GROUP BY gp.game_id, gp.user_id, u.name
HAVING COUNT(*) > 1
ORDER BY MAX(gp.created_at) DESC;

-- 3. Verificar la última partida y sus participantes
SELECT 
  g.id as game_id,
  g.status,
  g.started_at,
  g.ended_at,
  g.total_players,
  gp.user_id,
  u.name,
  gp.position,
  gp.score,
  gp.created_at as participant_created_at,
  CASE 
    WHEN rh.id IS NULL THEN 'NO tiene rating_history'
    ELSE 'SÍ tiene rating_history'
  END as rating_history_status
FROM games g
LEFT JOIN game_participants gp ON gp.game_id = g.id
LEFT JOIN users u ON u.id = gp.user_id
LEFT JOIN rating_history rh ON rh.user_id = gp.user_id AND rh.game_id = g.id
WHERE g.id = (SELECT id FROM games ORDER BY created_at DESC LIMIT 1)
ORDER BY gp.created_at DESC;


