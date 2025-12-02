-- Schema para sistema de moneda virtual "Loops"
-- Ejecutar este SQL en el SQL Editor de Supabase después de premium-colors-schema.sql
-- Este archivo crea el sistema completo de moneda virtual "Loops"

-- ============================================
-- 1. TABLA DE MONEDA VIRTUAL DEL USUARIO
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_currency (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  loops INTEGER NOT NULL DEFAULT 0 CHECK (loops >= 0), -- Balance de Loops
  total_earned INTEGER NOT NULL DEFAULT 0, -- Total ganado históricamente
  total_spent INTEGER NOT NULL DEFAULT 0, -- Total gastado históricamente
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TABLA DE TRANSACCIONES DE MONEDA
-- ============================================
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

-- ============================================
-- 3. AGREGAR COLUMNA DE PRECIO EN LOOPS A PREMIUM_ITEMS
-- ============================================
-- Si la columna ya existe, no hará nada (IF NOT EXISTS)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'premium_items' 
    AND column_name = 'price_loops'
  ) THEN
    ALTER TABLE public.premium_items 
    ADD COLUMN price_loops INTEGER DEFAULT 0 CHECK (price_loops >= 0);
  END IF;
END $$;

-- ============================================
-- 4. ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_currency_user ON public.user_currency(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_user ON public.currency_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_date ON public.currency_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type ON public.currency_transactions(type);

-- ============================================
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.user_currency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. POLÍTICAS RLS
-- ============================================

-- Políticas para user_currency
DROP POLICY IF EXISTS "Users can read own currency" ON public.user_currency;
CREATE POLICY "Users can read own currency" ON public.user_currency
  FOR SELECT USING (auth.uid() = user_id);

-- Políticas para currency_transactions
DROP POLICY IF EXISTS "Users can read own transactions" ON public.currency_transactions;
CREATE POLICY "Users can read own transactions" ON public.currency_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 7. FUNCIONES PARA MANEJAR LOOPS
-- ============================================

-- Función para agregar Loops a un usuario
CREATE OR REPLACE FUNCTION add_loops(
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
  INSERT INTO public.user_currency (user_id, loops, total_earned, last_updated)
  VALUES (p_user_id, p_amount, p_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    loops = user_currency.loops + p_amount,
    total_earned = user_currency.total_earned + p_amount,
    last_updated = NOW()
  RETURNING loops INTO v_new_balance;

  -- Registrar transacción
  INSERT INTO public.currency_transactions (user_id, amount, type, source, description)
  VALUES (p_user_id, p_amount, p_type, p_source, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para gastar Loops de un usuario
CREATE OR REPLACE FUNCTION spend_loops(
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
  SELECT COALESCE(loops, 0) INTO v_current_balance
  FROM public.user_currency
  WHERE user_id = p_user_id;

  -- Verificar que tenga suficiente Loops
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient loops. Current balance: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- Actualizar balance
  UPDATE public.user_currency
  SET 
    loops = loops - p_amount,
    total_spent = total_spent + p_amount,
    last_updated = NOW()
  WHERE user_id = p_user_id
  RETURNING loops INTO v_new_balance;

  -- Si no existe registro, crear uno (no debería pasar, pero por seguridad)
  IF v_new_balance IS NULL THEN
    INSERT INTO public.user_currency (user_id, loops, total_spent, last_updated)
    VALUES (p_user_id, 0, p_amount, NOW())
    RETURNING loops INTO v_new_balance;
  END IF;

  -- Registrar transacción
  INSERT INTO public.currency_transactions (user_id, amount, type, source, description, related_item_id)
  VALUES (p_user_id, -p_amount, p_type, p_source, p_description, p_item_id);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el balance de Loops de un usuario
CREATE OR REPLACE FUNCTION get_user_loops(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(loops, 0) INTO v_balance
  FROM public.user_currency
  WHERE user_id = p_user_id;

  -- Si no existe, crear registro con balance 0
  IF v_balance IS NULL THEN
    INSERT INTO public.user_currency (user_id, loops, last_updated)
    VALUES (p_user_id, 0, NOW())
    RETURNING loops INTO v_balance;
  END IF;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. ACTUALIZAR PRECIOS DE ITEMS EXISTENTES CON PRECIOS EN LOOPS
-- ============================================
-- Solo actualiza items que no tienen precio en Loops (price_loops = 0 o NULL)
UPDATE public.premium_items 
SET price_loops = 
  CASE rarity
    WHEN 'common' THEN 50
    WHEN 'rare' THEN 150
    WHEN 'epic' THEN 300
    WHEN 'legendary' THEN 500
    ELSE 100
  END
WHERE (price_loops = 0 OR price_loops IS NULL) AND is_active = true;

-- ============================================
-- 9. FUNCIÓN PARA DAR LOOPS INICIALES (OPCIONAL)
-- ============================================
-- Esta función se puede usar con un trigger para dar Loops a nuevos usuarios
-- Por ahora está comentada, puedes activarla si quieres

CREATE OR REPLACE FUNCTION give_starter_loops()
RETURNS TRIGGER AS $$
BEGIN
  -- Dar 100 Loops a nuevos usuarios
  INSERT INTO public.user_currency (user_id, loops, total_earned, last_updated)
  VALUES (NEW.id, 100, 100, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Registrar transacción
  INSERT INTO public.currency_transactions (user_id, amount, type, source, description)
  VALUES (NEW.id, 100, 'reward', 'starter_bonus', 'Welcome bonus - 100 Loops');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para dar Loops iniciales (DESACTIVADO por defecto)
-- Descomenta las siguientes líneas si quieres activarlo:
-- DROP TRIGGER IF EXISTS give_starter_loops_trigger ON public.users;
-- CREATE TRIGGER give_starter_loops_trigger
--   AFTER INSERT ON public.users
--   FOR EACH ROW
--   EXECUTE FUNCTION give_starter_loops();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Los usuarios podrán tener balance de Loops
-- 2. Los items premium tendrán precios en Loops (price_loops)
-- 3. Las funciones estarán listas para usar desde el cliente
