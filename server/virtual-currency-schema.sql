-- Schema para sistema de moneda virtual (Loops)
-- Ejecutar este SQL en el SQL Editor de Supabase después de premium-colors-schema.sql

-- Tabla de moneda virtual del usuario
-- Nota: La columna se llama "curves" internamente para mantener compatibilidad,
-- pero la moneda se llama "Loops" en la UI
CREATE TABLE IF NOT EXISTS public.user_currency (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  curves INTEGER NOT NULL DEFAULT 0 CHECK (curves >= 0), -- Internamente "curves", pero representa "Loops"
  total_earned INTEGER NOT NULL DEFAULT 0, -- Total ganado históricamente
  total_spent INTEGER NOT NULL DEFAULT 0, -- Total gastado históricamente
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de transacciones de moneda (historial)
CREATE TABLE IF NOT EXISTS public.currency_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positivo = ganado, Negativo = gastado
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'purchase', 'reward', 'refund')),
  source TEXT, -- 'game_win', 'game_play', 'daily_login', 'item_purchase', etc.
  description TEXT,
  related_item_id UUID REFERENCES public.premium_items(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar columna de precio en moneda virtual (Loops) a premium_items
ALTER TABLE public.premium_items 
ADD COLUMN IF NOT EXISTS price_curves INTEGER DEFAULT 0 CHECK (price_curves >= 0); -- Precio en Loops

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_user_currency_user ON public.user_currency(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_user ON public.currency_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_date ON public.currency_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type ON public.currency_transactions(type);

-- Habilitar RLS
ALTER TABLE public.user_currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_currency
-- Los usuarios pueden leer su propia moneda
CREATE POLICY "Users can read own currency" ON public.user_currency
  FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios pueden actualizar su propia moneda (a través de funciones)
-- Nota: Las actualizaciones se harán mediante funciones SECURITY DEFINER

-- Políticas RLS para currency_transactions
-- Los usuarios pueden leer sus propias transacciones
CREATE POLICY "Users can read own transactions" ON public.currency_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Función para agregar Loops a un usuario
CREATE OR REPLACE FUNCTION add_curves(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'earn',
  p_source TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Validar cantidad positiva
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Insertar o actualizar balance del usuario
  INSERT INTO public.user_currency (user_id, curves, total_earned, last_updated)
  VALUES (p_user_id, p_amount, p_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    curves = user_currency.curves + p_amount,
    total_earned = user_currency.total_earned + p_amount,
    last_updated = NOW()
  RETURNING curves INTO v_new_balance;

  -- Registrar transacción
  INSERT INTO public.currency_transactions (user_id, amount, type, source, description)
  VALUES (p_user_id, p_amount, p_type, p_source, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para gastar Loops de un usuario
CREATE OR REPLACE FUNCTION spend_curves(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'spend',
  p_source TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_item_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Validar cantidad positiva
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Obtener balance actual
  SELECT COALESCE(curves, 0) INTO v_current_balance
  FROM public.user_currency
  WHERE user_id = p_user_id;

  -- Verificar que tenga suficiente Loops
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient loops. Current balance: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- Actualizar balance
  UPDATE public.user_currency
  SET 
    curves = curves - p_amount,
    total_spent = total_spent + p_amount,
    last_updated = NOW()
  WHERE user_id = p_user_id
  RETURNING curves INTO v_new_balance;

  -- Si no existe registro, crear uno (no debería pasar, pero por seguridad)
  IF v_new_balance IS NULL THEN
    INSERT INTO public.user_currency (user_id, curves, total_spent, last_updated)
    VALUES (p_user_id, 0, p_amount, NOW())
    RETURNING curves INTO v_new_balance;
  END IF;

  -- Registrar transacción
  INSERT INTO public.currency_transactions (user_id, amount, type, source, description, related_item_id)
  VALUES (p_user_id, -p_amount, p_type, p_source, p_description, p_item_id);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el balance de Loops de un usuario
CREATE OR REPLACE FUNCTION get_user_curves(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(curves, 0) INTO v_balance
  FROM public.user_currency
  WHERE user_id = p_user_id;

  -- Si no existe, crear registro con balance 0
  IF v_balance IS NULL THEN
    INSERT INTO public.user_currency (user_id, curves, last_updated)
    VALUES (p_user_id, 0, NOW())
    RETURNING curves INTO v_balance;
  END IF;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar precios de items premium existentes con precios en Loops
-- (Ajusta estos valores según tu economía del juego)
UPDATE public.premium_items SET price_curves = 
  CASE rarity
    WHEN 'common' THEN 50
    WHEN 'rare' THEN 150
    WHEN 'epic' THEN 300
    WHEN 'legendary' THEN 500
    ELSE 100
  END
WHERE price_curves = 0 OR price_curves IS NULL;

-- Dar Loops iniciales a usuarios nuevos (opcional - puedes ajustar o eliminar)
-- Esto se puede hacer con un trigger cuando se crea un usuario
CREATE OR REPLACE FUNCTION give_starter_curves()
RETURNS TRIGGER AS $$
BEGIN
  -- Dar 100 Loops a nuevos usuarios
  INSERT INTO public.user_currency (user_id, curves, total_earned, last_updated)
  VALUES (NEW.id, 100, 100, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Registrar transacción
  INSERT INTO public.currency_transactions (user_id, amount, type, source, description)
  VALUES (NEW.id, 100, 'reward', 'starter_bonus', 'Welcome bonus');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para dar moneda inicial (opcional - comenta si no quieres esto)
-- CREATE TRIGGER give_starter_curves_trigger
--   AFTER INSERT ON public.users
--   FOR EACH ROW
--   EXECUTE FUNCTION give_starter_curves();

