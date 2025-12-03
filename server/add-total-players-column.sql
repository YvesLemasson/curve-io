-- Agregar columna total_players a games si no existe
-- Esta columna incluye todos los jugadores (autenticados + guests)

ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS total_players INTEGER;

-- Comentario: total_players debe ser actualizado por el servidor cuando termina la partida
-- para incluir todos los jugadores, no solo los autenticados

SELECT 'Columna total_players agregada a games' AS status;






