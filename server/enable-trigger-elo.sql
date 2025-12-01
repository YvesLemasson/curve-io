-- ============================================
-- Habilitar el trigger de ELO
-- ============================================
-- El trigger existe pero está deshabilitado (enabled: 0)
-- Este script lo habilita

-- IMPORTANTE: Ejecuta este comando primero (descomenta si está comentado)
ALTER TABLE public.game_participants 
  ENABLE TRIGGER update_stats_on_participant_insert;

-- Verificar que el trigger está habilitado
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

