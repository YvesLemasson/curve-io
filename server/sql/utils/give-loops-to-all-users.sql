-- Script para dar 500 loops a todos los jugadores registrados
-- Ejecutar este SQL en el SQL Editor de Supabase

-- ============================================
-- DAR 500 LOOPS A TODOS LOS USUARIOS
-- ============================================

DO $$
DECLARE
  user_record RECORD;
  loops_added INTEGER := 0;
  total_users INTEGER := 0;
BEGIN
  -- Contar total de usuarios
  SELECT COUNT(*) INTO total_users FROM public.users;
  
  RAISE NOTICE 'Total de usuarios encontrados: %', total_users;
  
  -- Iterar sobre todos los usuarios y darles 500 loops
  FOR user_record IN 
    SELECT id FROM public.users
  LOOP
    -- Llamar a la función add_loops para cada usuario
    PERFORM add_loops(
      p_user_id := user_record.id,
      p_amount := 500,
      p_type := 'reward',
      p_source := 'admin_bonus',
      p_description := 'Regalo de 500 Loops para todos los jugadores'
    );
    
    loops_added := loops_added + 1;
    
    -- Log cada 100 usuarios para seguimiento
    IF loops_added % 100 = 0 THEN
      RAISE NOTICE 'Procesados % de % usuarios...', loops_added, total_users;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Completado: Se han otorgado 500 Loops a % usuarios', loops_added;
END $$;

-- ============================================
-- VERIFICACIÓN (OPCIONAL)
-- ============================================
-- Descomenta las siguientes líneas para verificar los resultados:

-- Ver cuántos usuarios recibieron los loops
-- SELECT 
--   COUNT(*) as usuarios_con_loops,
--   SUM(loops) as total_loops_distribuidos,
--   AVG(loops) as promedio_loops_por_usuario
-- FROM public.user_currency;

-- Ver las transacciones recientes de este regalo
-- SELECT 
--   u.name,
--   u.email,
--   ct.amount,
--   ct.description,
--   ct.created_at
-- FROM public.currency_transactions ct
-- JOIN public.users u ON ct.user_id = u.id
-- WHERE ct.source = 'admin_bonus'
--   AND ct.description = 'Regalo de 500 Loops para todos los jugadores'
-- ORDER BY ct.created_at DESC
-- LIMIT 20;

