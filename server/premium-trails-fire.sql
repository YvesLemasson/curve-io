-- Script para crear trails de fuego
-- Ejecutar en el SQL Editor de Supabase

-- Insertar trails de fuego con diferentes rarezas
-- El nombre contiene "Fire" para que el servidor pueda identificarlo como tipo 'fire'

INSERT INTO public.premium_items (
  name,
  description,
  type,
  color_value, -- No se usa para fire, pero requerido por el schema
  price_usd,
  price_loops, -- Precio en Loops (moneda virtual)
  rarity,
  is_active,
  display_order
) VALUES
-- Trail de fuego común
('Fire Trail', 'Una estela ardiente de fuego con gradiente rojo-naranja-amarillo', 'trail', '#ff0000', 0.99, 150, 'rare', true, 100),

-- Trail de fuego épico (más intenso)
('Inferno Trail', 'Fuego infernal con resplandor intenso', 'trail', '#ff4400', 0.99, 300, 'epic', true, 101),

-- Trail de fuego legendario (máxima intensidad)
('Hellfire Trail', 'El fuego del infierno mismo', 'trail', '#ff6600', 0.99, 500, 'legendary', true, 102)

ON CONFLICT DO NOTHING;

-- Nota: El servidor detectará el tipo 'fire' basándose en el nombre que contiene "Fire"
-- La configuración del efecto (glowIntensity, etc.) se aplicará por defecto en el código.



