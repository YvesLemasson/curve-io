-- ============================================
-- SCRIPT PARA AGREGAR LOOPS A USUARIO DE PRUEBA
-- ============================================
-- 
-- FORMA MÁS FÁCIL (desde el navegador):
-- 1. Abre la consola del navegador (F12)
-- 2. Asegúrate de estar autenticado
-- 3. Ejecuta: await window.testLoops.addTestLoops(1000)
-- 4. Para ver tu balance: await window.testLoops.getMyLoops()
--
-- FORMA ALTERNATIVA (desde Supabase SQL Editor):
-- Reemplaza 'TU_USER_ID_AQUI' con el UUID de tu usuario de prueba
-- Puedes obtener tu user_id con: SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com';

-- ============================================
-- OPCIÓN 1: Agregar loops usando la función add_loops (RECOMENDADO)
-- ============================================
-- Esta es la forma recomendada porque registra la transacción

-- Ejemplo: Agregar 1000 loops a tu usuario
-- SELECT add_loops(
--   'TU_USER_ID_AQUI'::UUID,
--   1000,
--   'reward',
--   'test_bonus',
--   'Loops de prueba para testing'
-- );

-- ============================================
-- OPCIÓN 2: Actualizar directamente la tabla (más rápido pero no registra transacción)
-- ============================================
-- INSERT INTO public.user_currency (user_id, loops, total_earned, last_updated)
-- VALUES ('TU_USER_ID_AQUI'::UUID, 1000, 1000, NOW())
-- ON CONFLICT (user_id) DO UPDATE SET
--   loops = user_currency.loops + 1000,
--   total_earned = user_currency.total_earned + 1000,
--   last_updated = NOW();

-- ============================================
-- OPCIÓN 3: Ver tu balance actual
-- ============================================
-- SELECT loops, total_earned, total_spent, last_updated
-- FROM public.user_currency
-- WHERE user_id = 'TU_USER_ID_AQUI'::UUID;

-- ============================================
-- OPCIÓN 4: Ver todas tus transacciones
-- ============================================
-- SELECT * FROM public.currency_transactions
-- WHERE user_id = 'TU_USER_ID_AQUI'::UUID
-- ORDER BY created_at DESC
-- LIMIT 20;

-- ============================================
-- OPCIÓN 5: Buscar tu user_id por email o nombre
-- ============================================
-- SELECT id, email, name FROM public.users
-- WHERE email = 'tu-email@ejemplo.com';
-- -- O
-- SELECT id, email, name FROM public.users
-- WHERE name ILIKE '%tu-nombre%';

