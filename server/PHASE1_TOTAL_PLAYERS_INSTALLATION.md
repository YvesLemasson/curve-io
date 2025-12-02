# Instalación: Campo total_players para cálculo de ELO mejorado

Este script mejora el cálculo de ELO cuando hay jugadores guest (no autenticados) en la partida.

## ¿Qué hace?

1. **Agrega el campo `total_players`** a la tabla `games` para almacenar el número total de jugadores (incluyendo guests)
2. **Actualiza el trigger** `update_player_stats_with_rating()` para usar este campo al calcular el ELO
3. **Mejora la precisión del ELO** cuando hay jugadores guest, ya que ahora se considera el total real de jugadores en lugar de solo los autenticados

## Instalación

1. Abre el **SQL Editor** en Supabase
2. Copia y pega el contenido de `server/phase1-add-total-players.sql`
3. Ejecuta el script

## ¿Por qué es importante?

**Antes:**
- Si un jugador autenticado jugaba contra 3 guests, el sistema solo contaba 1 jugador (el autenticado)
- El cálculo de ELO usaba `total_players = 1`, lo que afectaba incorrectamente el `actual_score`

**Ahora:**
- El sistema guarda el total real de jugadores (4 en el ejemplo anterior)
- El cálculo de ELO usa el total correcto, mejorando la precisión del rating

## Notas

- El campo `total_players` es opcional (puede ser NULL)
- Si no está disponible, el trigger usa el conteo de participantes autenticados como fallback
- Los jugadores guest siguen sin guardarse en `game_participants`, pero ahora se consideran en el cálculo de ELO




