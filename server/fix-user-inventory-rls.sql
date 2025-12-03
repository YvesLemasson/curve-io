-- ============================================
-- FIX: Agregar políticas RLS faltantes para user_inventory y purchases
-- ============================================
-- Este script corrige el error "new row violates row-level security policy"
-- que ocurre al intentar comprar items premium
--
-- Ejecuta este script en el SQL Editor de Supabase

-- ============================================
-- 1. POLÍTICA INSERT PARA user_inventory
-- ============================================
-- Permite a los usuarios agregar items a su propio inventario (cuando compran)
DROP POLICY IF EXISTS "Users can insert own inventory" ON public.user_inventory;
CREATE POLICY "Users can insert own inventory" ON public.user_inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. POLÍTICA INSERT PARA purchases
-- ============================================
-- Permite a los usuarios registrar sus propias compras
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. VERIFICAR POLÍTICAS EXISTENTES (opcional)
-- ============================================
-- Puedes ejecutar esto para ver todas las políticas de user_inventory:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'user_inventory';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Los usuarios podrán agregar items a su inventario al comprar
-- 2. Los usuarios podrán registrar sus compras en la tabla purchases
-- 3. El error 403/406 debería desaparecer




