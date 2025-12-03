-- ============================================
-- Crear la función calculate_new_rating si no existe
-- ============================================
-- Esta función es necesaria para que el trigger funcione

CREATE OR REPLACE FUNCTION calculate_new_rating(
  current_rating INTEGER,
  opponent_ratings INTEGER[],
  final_position INTEGER, -- 1 = ganador, 2 = segundo, etc.
  total_players INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  k_factor INTEGER := 30; -- Factor de volatilidad (ajustable según experiencia)
  expected_score NUMERIC := 0;
  actual_score NUMERIC;
  avg_opponent_rating NUMERIC;
  rating_change INTEGER;
BEGIN
  -- Si no hay oponentes, usar rating promedio (1000)
  IF opponent_ratings IS NULL OR array_length(opponent_ratings, 1) = 0 THEN
    avg_opponent_rating := 1000;
  ELSE
    -- Calcular rating promedio de oponentes
    SELECT AVG(r) INTO avg_opponent_rating 
    FROM unnest(opponent_ratings) AS r;
  END IF;
  
  -- Calcular resultado esperado (fórmula Elo estándar)
  -- E = 1 / (1 + 10^((R_opponent - R_player) / 400))
  expected_score := 1.0 / (1.0 + POWER(10.0, (avg_opponent_rating - current_rating) / 400.0));
  
  -- Calcular resultado real (normalizado 0-1)
  -- El ganador obtiene 1.0, segundo 0.8, tercero 0.6, etc.
  -- Fórmula: 1.0 - ((final_position - 1) * 0.2 / (total_players - 1))
  IF total_players <= 1 THEN
    actual_score := 1.0;
  ELSE
    actual_score := 1.0 - ((final_position - 1) * 0.2 / (total_players - 1));
    -- Asegurar que actual_score esté entre 0 y 1
    actual_score := GREATEST(0.0, LEAST(1.0, actual_score));
  END IF;
  
  -- Calcular cambio de rating
  -- Nuevo Rating = Rating Actual + K × (Resultado Real - Resultado Esperado)
  rating_change := ROUND(k_factor * (actual_score - expected_score));
  
  -- Retornar nuevo rating (asegurar que no sea negativo)
  RETURN GREATEST(0, current_rating + rating_change);
END;
$$ LANGUAGE plpgsql;

-- Verificar que se creó correctamente
SELECT 
  'calculate_new_rating' as function_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'calculate_new_rating'
    ) THEN 'EXISTS ✅'
    ELSE 'MISSING ❌'
  END as status,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'calculate_new_rating';





