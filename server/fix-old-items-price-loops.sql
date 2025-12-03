-- ============================================
-- FIX: Actualizar price_loops de items antiguos que no lo tienen
-- ============================================
-- Este script asegura que todos los items tengan price_loops correcto
-- Ejecuta este script en el SQL Editor de Supabase

-- Actualizar items que tienen price_loops = 0 o NULL
UPDATE public.premium_items 
SET price_loops = 
  CASE rarity
    WHEN 'common' THEN 50
    WHEN 'rare' THEN 150
    WHEN 'epic' THEN 300
    WHEN 'legendary' THEN 500
    ELSE 100
  END
WHERE (price_loops = 0 OR price_loops IS NULL) AND is_active = true AND type = 'color';

-- Verificar que todos los items tienen price_loops
-- SELECT name, rarity, price_loops, display_order
-- FROM public.premium_items 
-- WHERE type = 'color' AND is_active = true
-- ORDER BY price_loops, display_order;




