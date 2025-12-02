-- Schema para sistema de colores premium
-- Ejecutar este SQL en el SQL Editor de Supabase después de supabase-schema.sql

-- Tabla de items premium
CREATE TABLE IF NOT EXISTS public.premium_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('color', 'trail', 'skin', 'effect')),
  color_value TEXT NOT NULL, -- El valor del color (hex, gradiente, etc.)
  price_usd DECIMAL(10, 2) NOT NULL DEFAULT 0.99,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_limited BOOLEAN DEFAULT FALSE,
  available_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de inventario del usuario (qué items tiene)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.premium_items(id) ON DELETE CASCADE,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, item_id)
);

-- Tabla de compras (historial de transacciones)
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.premium_items(id) ON DELETE CASCADE,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_provider TEXT, -- 'stripe', 'paypal', etc.
  payment_id TEXT, -- ID de la transacción del proveedor
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_premium_items_type ON public.premium_items(type);
CREATE INDEX IF NOT EXISTS idx_premium_items_active ON public.premium_items(is_active);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON public.user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item ON public.user_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_item ON public.purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(purchase_date DESC);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_premium_items_updated_at BEFORE UPDATE ON public.premium_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.premium_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para premium_items
-- Cualquiera puede leer items activos
CREATE POLICY "Anyone can read active premium items" ON public.premium_items
  FOR SELECT USING (is_active = true);

-- Políticas RLS para user_inventory
-- Los usuarios pueden leer su propio inventario
CREATE POLICY "Users can read own inventory" ON public.user_inventory
  FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios pueden agregar items a su propio inventario (cuando compran)
CREATE POLICY "Users can insert own inventory" ON public.user_inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar su propio inventario (equipar/desequipar)
CREATE POLICY "Users can update own inventory" ON public.user_inventory
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para purchases
-- Los usuarios pueden leer sus propias compras
CREATE POLICY "Users can read own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios pueden registrar sus propias compras
CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Función helper para verificar si un usuario tiene un item
CREATE OR REPLACE FUNCTION user_has_item(p_user_id UUID, p_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_inventory
    WHERE user_id = p_user_id AND item_id = p_item_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insertar algunos colores premium de ejemplo
INSERT INTO public.premium_items (name, description, type, color_value, price_usd, rarity) VALUES
  ('Gold', 'Shining gold color', 'color', '#FFD700', 1.99, 'rare'),
  ('Silver', 'Elegant silver color', 'color', '#C0C0C0', 1.99, 'rare'),
  ('Platinum', 'Premium platinum color', 'color', '#E5E4E2', 2.99, 'epic'),
  ('Neon Pink', 'Bright neon pink', 'color', '#FF10F0', 1.99, 'rare'),
  ('Neon Green', 'Electric neon green', 'color', '#39FF14', 1.99, 'rare'),
  ('Neon Blue', 'Vibrant neon blue', 'color', '#1F51FF', 1.99, 'rare'),
  ('Rainbow', 'Animated rainbow gradient', 'color', 'rainbow', 4.99, 'legendary'),
  ('Fire', 'Burning fire effect', 'color', '#FF4500', 2.99, 'epic'),
  ('Ice', 'Cool ice blue', 'color', '#00FFFF', 2.99, 'epic'),
  ('Cosmic Purple', 'Deep cosmic purple', 'color', '#8A2BE2', 1.99, 'rare')
ON CONFLICT DO NOTHING;


