-- ============================================
-- Agregar colores removidos de la lista gratuita como items premium
-- ============================================
-- Estos colores ya no son gratuitos, deben comprarse con loops
-- Ejecuta este script en el SQL Editor de Supabase

-- ============================================
-- Colores que fueron removidos de la lista gratuita (ahora son premium)
-- ============================================
INSERT INTO public.premium_items (name, description, type, color_value, price_usd, price_loops, rarity, is_active, display_order) VALUES
  ('Rosa', 'Color rosa vibrante', 'color', '#ff0080', 0.99, 50, 'common', true, 10),
  ('Verde Claro', 'Verde claro brillante', 'color', '#00ff80', 0.99, 50, 'common', true, 11),
  ('Azul Claro', 'Azul claro suave', 'color', '#0080ff', 0.99, 50, 'common', true, 12),
  ('Rosa Claro', 'Rosa claro pastel', 'color', '#ff8080', 0.99, 50, 'common', true, 13),
  ('Verde Menta', 'Verde menta refrescante', 'color', '#80ff80', 0.99, 50, 'common', true, 14),
  ('Azul Suave', 'Azul suave y relajante', 'color', '#8080ff', 0.99, 50, 'common', true, 15),
  ('Amarillo Claro', 'Amarillo claro brillante', 'color', '#ffff80', 0.99, 50, 'common', true, 16),
  ('Rosa Magenta', 'Rosa magenta intenso', 'color', '#ff80ff', 0.99, 50, 'common', true, 17)
ON CONFLICT DO NOTHING;

-- ============================================
-- Colores adicionales premium
-- ============================================
INSERT INTO public.premium_items (name, description, type, color_value, price_usd, price_loops, rarity, is_active, display_order) VALUES
  -- Colores básicos premium
  ('Blanco', 'Blanco puro y brillante', 'color', '#ffffff', 1.49, 75, 'common', true, 20),
  ('Negro', 'Negro profundo y elegante', 'color', '#000000', 1.49, 75, 'common', true, 21),
  ('Gris', 'Gris neutro y versátil', 'color', '#808080', 0.99, 50, 'common', true, 22),
  ('Gris Claro', 'Gris claro suave', 'color', '#c0c0c0', 0.99, 50, 'common', true, 23),
  ('Gris Oscuro', 'Gris oscuro elegante', 'color', '#404040', 0.99, 50, 'common', true, 24),
  
  -- Colores neón adicionales
  ('Neon Amarillo', 'Amarillo neón eléctrico', 'color', '#ffff00', 1.99, 100, 'rare', true, 30),
  ('Neon Naranja', 'Naranja neón intenso', 'color', '#ff6600', 1.99, 100, 'rare', true, 31),
  ('Neon Rojo', 'Rojo neón vibrante', 'color', '#ff0000', 1.99, 100, 'rare', true, 32),
  ('Neon Verde Limón', 'Verde limón neón brillante', 'color', '#ccff00', 1.99, 100, 'rare', true, 33),
  ('Neon Cian', 'Cian neón eléctrico', 'color', '#00ffff', 1.99, 100, 'rare', true, 34),
  ('Neon Púrpura', 'Púrpura neón intenso', 'color', '#cc00ff', 1.99, 100, 'rare', true, 35),
  
  -- Colores pastel
  ('Rosa Pastel', 'Rosa pastel suave', 'color', '#ffb3d9', 1.49, 75, 'common', true, 40),
  ('Azul Pastel', 'Azul pastel relajante', 'color', '#b3d9ff', 1.49, 75, 'common', true, 41),
  ('Verde Pastel', 'Verde pastel fresco', 'color', '#b3ffb3', 1.49, 75, 'common', true, 42),
  ('Amarillo Pastel', 'Amarillo pastel suave', 'color', '#ffffb3', 1.49, 75, 'common', true, 43),
  ('Lavanda', 'Lavanda pastel elegante', 'color', '#e6ccff', 1.49, 75, 'common', true, 44),
  ('Melocotón', 'Melocotón pastel cálido', 'color', '#ffccb3', 1.49, 75, 'common', true, 45),
  
  -- Colores vibrantes
  ('Coral', 'Coral vibrante y cálido', 'color', '#ff7f50', 1.99, 100, 'rare', true, 50),
  ('Turquesa', 'Turquesa brillante', 'color', '#40e0d0', 1.99, 100, 'rare', true, 51),
  ('Fucsia', 'Fucsia intenso y llamativo', 'color', '#ff00ff', 1.99, 100, 'rare', true, 52),
  ('Lima', 'Lima brillante y fresco', 'color', '#32cd32', 1.99, 100, 'rare', true, 53),
  ('Salmón', 'Salmón suave y cálido', 'color', '#fa8072', 1.99, 100, 'rare', true, 54),
  ('Esmeralda', 'Verde esmeralda profundo', 'color', '#50c878', 1.99, 100, 'rare', true, 55),
  ('Zafiro', 'Azul zafiro intenso', 'color', '#0f52ba', 1.99, 100, 'rare', true, 56),
  ('Rubí', 'Rojo rubí profundo', 'color', '#e0115f', 1.99, 100, 'rare', true, 57),
  
  -- Colores oscuros premium
  ('Rojo Oscuro', 'Rojo oscuro profundo', 'color', '#8b0000', 1.99, 100, 'rare', true, 60),
  ('Verde Oscuro', 'Verde oscuro forestal', 'color', '#006400', 1.99, 100, 'rare', true, 61),
  ('Azul Oscuro', 'Azul oscuro marino', 'color', '#000080', 1.99, 100, 'rare', true, 62),
  ('Púrpura Oscuro', 'Púrpura oscuro real', 'color', '#4b0082', 1.99, 100, 'rare', true, 63),
  ('Marrón', 'Marrón tierra cálido', 'color', '#8b4513', 1.99, 100, 'rare', true, 64),
  
  -- Colores especiales
  ('Dorado', 'Dorado brillante premium', 'color', '#ffd700', 2.99, 150, 'epic', true, 70),
  ('Plateado', 'Plateado elegante', 'color', '#c0c0c0', 2.99, 150, 'epic', true, 71),
  ('Bronce', 'Bronce cálido', 'color', '#cd7f32', 2.49, 125, 'epic', true, 72),
  ('Cobre', 'Cobre brillante', 'color', '#b87333', 2.49, 125, 'epic', true, 73)
ON CONFLICT DO NOTHING;

-- ============================================
-- Verificar que se agregaron correctamente
-- ============================================
-- SELECT name, color_value, price_loops, rarity, display_order
-- FROM public.premium_items 
-- WHERE type = 'color' AND is_active = true
-- ORDER BY display_order;

-- Verificar cantidad total de colores premium
-- SELECT COUNT(*) as total_colores_premium
-- FROM public.premium_items 
-- WHERE type = 'color' AND is_active = true;

