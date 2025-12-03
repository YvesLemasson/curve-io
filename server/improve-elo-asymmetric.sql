-- Mejora del sistema ELO: Sistema asimétrico
-- - Ganar contra oponentes débiles → pocos puntos
-- - Perder contra oponentes débiles → muchos puntos perdidos
-- - Ganar contra oponentes fuertes → muchos puntos
-- - Perder contra oponentes fuertes → pocos puntos perdidos

CREATE OR REPLACE FUNCTION calculate_new_rating(
  current_rating INTEGER,
  opponent_ratings INTEGER[],
  final_position INTEGER, -- 1 = ganador, 2 = segundo, etc.
  total_players INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  k_factor_win INTEGER := 25;  -- Factor K cuando ganas (resultado esperado o mejor)
  k_factor_loss INTEGER := 40;  -- Factor K cuando pierdes (resultado peor de lo esperado) - MÁS PENALIZACIÓN
  expected_score NUMERIC := 0;
  actual_score NUMERIC;
  avg_opponent_rating NUMERIC;
  rating_change NUMERIC;  -- Usar NUMERIC para cálculos más precisos
  is_underdog BOOLEAN;     -- ¿Eres el más débil?
  is_favorite BOOLEAN;     -- ¿Eres el favorito?
BEGIN
  -- Si no hay oponentes, usar rating promedio (1000)
  IF opponent_ratings IS NULL OR array_length(opponent_ratings, 1) = 0 THEN
    avg_opponent_rating := 1000;
  ELSE
    -- Calcular rating promedio de oponentes
    SELECT AVG(r) INTO avg_opponent_rating 
    FROM unnest(opponent_ratings) AS r;
  END IF;
  
  -- Determinar si eres favorito o underdog
  is_favorite := current_rating > avg_opponent_rating;
  is_underdog := current_rating < avg_opponent_rating;
  
  -- Calcular resultado esperado (fórmula Elo estándar)
  -- E = 1 / (1 + 10^((R_opponent - R_player) / 400))
  expected_score := 1.0 / (1.0 + POWER(10.0, (avg_opponent_rating - current_rating) / 400.0));
  
  -- Calcular resultado real (normalizado 0-1)
  -- Distribución más agresiva: mayor diferencia entre posiciones
  -- 1º lugar: 1.0, último: 0.0 (en lugar de 0.8)
  IF total_players <= 1 THEN
    actual_score := 1.0;
  ELSE
    -- Fórmula mejorada: más penalización para malas posiciones
    -- Último lugar ahora da 0.0 en lugar de ~0.8
    actual_score := 1.0 - ((final_position - 1.0) / (total_players - 1.0));
    -- Asegurar que actual_score esté entre 0 y 1
    actual_score := GREATEST(0.0, LEAST(1.0, actual_score));
  END IF;
  
  -- Calcular cambio de rating con sistema asimétrico
  IF actual_score >= expected_score THEN
    -- GANASTE (resultado igual o mejor de lo esperado)
    -- Usar K más bajo si eres favorito (ganar contra débiles no da mucho)
    -- Usar K más alto si eres underdog (ganar contra fuertes da mucho)
    IF is_favorite THEN
      -- Favorito que gana: usar K bajo (ganar contra débiles no debería dar mucho)
      rating_change := k_factor_win * (actual_score - expected_score);
    ELSE
      -- Underdog que gana: usar K más alto (ganar contra fuertes es impresionante)
      rating_change := k_factor_loss * (actual_score - expected_score);
    END IF;
  ELSE
    -- PERDISTE (resultado peor de lo esperado)
    -- Usar K más alto si eres favorito (perder contra débiles es muy malo)
    -- Usar K más bajo si eres underdog (perder contra fuertes es esperado)
    IF is_favorite THEN
      -- Favorito que pierde: usar K alto (perder contra débiles es muy malo)
      rating_change := k_factor_loss * (actual_score - expected_score);
    ELSE
      -- Underdog que pierde: usar K bajo (perder contra fuertes es esperado)
      rating_change := k_factor_win * (actual_score - expected_score);
    END IF;
  END IF;
  
  -- Redondear el cambio
  rating_change := ROUND(rating_change);
  
  -- Retornar nuevo rating (asegurar que no sea negativo)
  RETURN GREATEST(0, current_rating + rating_change::INTEGER);
END;
$$ LANGUAGE plpgsql;

-- Verificar que la función se creó correctamente
SELECT 'Función calculate_new_rating actualizada con sistema asimétrico' AS status;





