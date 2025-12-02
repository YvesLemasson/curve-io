-- Script para crear 16 variantes del efecto de partículas con diferentes colores de trail
-- Ejecutar en el SQL Editor de Supabase

-- Primero, asegurarse de que la tabla premium_items tenga soporte para trails
-- (La tabla ya existe según premium-colors-schema.sql)

-- Insertar 16 trails de partículas con diferentes colores
-- Cada uno tiene el mismo efecto pero con diferente color de trail base

INSERT INTO public.premium_items (
  name,
  description,
  type,
  color_value, -- Almacenamos el color del trail aquí
  price_usd,
  price_loops, -- Precio en Loops (moneda virtual)
  rarity,
  is_active,
  display_order
) VALUES
-- Colores básicos vibrantes
('Particle Trail - Red', 'Trail de partículas con línea roja', 'trail', '#ff0000', 0.99, 50, 'common', true, 1),
('Particle Trail - Blue', 'Trail de partículas con línea azul', 'trail', '#0000ff', 0.99, 50, 'common', true, 2),
('Particle Trail - Green', 'Trail de partículas con línea verde', 'trail', '#00ff00', 0.99, 50, 'common', true, 3),
('Particle Trail - Yellow', 'Trail de partículas con línea amarilla', 'trail', '#ffff00', 0.99, 50, 'common', true, 4),
('Particle Trail - Purple', 'Trail de partículas con línea morada', 'trail', '#8000ff', 0.99, 50, 'common', true, 5),
('Particle Trail - Orange', 'Trail de partículas con línea naranja', 'trail', '#ff8000', 0.99, 50, 'common', true, 6),
('Particle Trail - Cyan', 'Trail de partículas con línea cyan', 'trail', '#00ffff', 0.99, 50, 'common', true, 7),
('Particle Trail - Magenta', 'Trail de partículas con línea magenta', 'trail', '#ff00ff', 0.99, 50, 'common', true, 8),

-- Colores más raros
('Particle Trail - Pink', 'Trail de partículas con línea rosa', 'trail', '#ff69b4', 0.99, 75, 'rare', true, 9),
('Particle Trail - Lime', 'Trail de partículas con línea lima', 'trail', '#00ff00', 0.99, 75, 'rare', true, 10),
('Particle Trail - Gold', 'Trail de partículas con línea dorada', 'trail', '#ffd700', 0.99, 75, 'rare', true, 11),
('Particle Trail - Turquoise', 'Trail de partículas con línea turquesa', 'trail', '#40e0d0', 0.99, 75, 'rare', true, 12),

-- Colores épicos
('Particle Trail - Neon Green', 'Trail de partículas con línea verde neón', 'trail', '#39ff14', 0.99, 100, 'epic', true, 13),
('Particle Trail - Electric Blue', 'Trail de partículas con línea azul eléctrico', 'trail', '#00ffff', 0.99, 100, 'epic', true, 14),
('Particle Trail - Hot Pink', 'Trail de partículas con línea rosa intenso', 'trail', '#ff1493', 0.99, 100, 'epic', true, 15),
('Particle Trail - Neon Purple', 'Trail de partículas con línea morado neón', 'trail', '#bf00ff', 0.99, 100, 'epic', true, 16)

ON CONFLICT DO NOTHING;

-- Nota: La configuración del trail (particleCount, particleSize, etc.) se aplicará
-- por defecto en el código. El color_value almacena el color del trail base.
-- Todos usan el mismo efecto 'particles' con la misma configuración.


