// FASE 2: Delta Compression - Aplicar cambios delta al estado local
// Reduce ancho de banda en 70-90%

import type { GameState } from '@shared/types';

export interface DeltaState {
  tick: number;
  gameStatus?: string;
  winnerId?: string;
  players: Array<{
    id: string;
    position?: { x: number; y: number };
    angle?: number;
    speed?: number;
    alive?: boolean;
    trailNew?: Array<{ x: number; y: number } | null>;
    trailLength?: number;
    boost?: { active: boolean; charge: number; remaining: number };
    name?: string;
    color?: string;
  }>;
  fullState?: boolean;
}

export class DeltaDecompressor {
  private localState: GameState | null = null;

  /**
   * Aplica un delta al estado local
   */
  applyDelta(delta: DeltaState, scaleX: number = 1, scaleY: number = 1): GameState {
    // Si es estado completo, reemplazar todo
    if (delta.fullState || !this.localState) {
      const gameStatus = (delta.gameStatus as 'waiting' | 'playing' | 'finished' | 'ended') || 'waiting';
      this.localState = {
        tick: delta.tick,
        gameStatus,
        winnerId: delta.winnerId,
        players: delta.players.map(p => ({
          id: p.id,
          name: p.name || `Player ${p.id.substring(0, 8)}`,
          color: p.color || '#ffffff',
          position: p.position ? {
            x: p.position.x * scaleX,
            y: p.position.y * scaleY,
          } : { x: 0, y: 0 },
          angle: p.angle || 0,
          speed: p.speed || 2,
          alive: p.alive !== undefined ? p.alive : true,
          trail: (p.trailNew || []).map(pos => pos ? {
            x: pos.x * scaleX,
            y: pos.y * scaleY,
          } : null),
          boost: p.boost,
        })),
      };
      return this.localState;
    }

    // Aplicar delta incremental
    if (!this.localState) {
      throw new Error('No hay estado local para aplicar delta');
    }

    this.localState.tick = delta.tick;

    if (delta.gameStatus !== undefined) {
      this.localState.gameStatus = delta.gameStatus as 'waiting' | 'playing' | 'finished' | 'ended';
    }

    if (delta.winnerId !== undefined) {
      this.localState.winnerId = delta.winnerId;
    }

    // Aplicar cambios a jugadores
    const playersMap = new Map(
      this.localState.players.map(p => [p.id, p])
    );

    for (const playerDelta of delta.players) {
      let player = playersMap.get(playerDelta.id);

      if (!player) {
        // Jugador nuevo
        player = {
          id: playerDelta.id,
          name: playerDelta.name || `Player ${playerDelta.id.substring(0, 8)}`,
          color: playerDelta.color || '#ffffff',
          position: playerDelta.position ? {
            x: playerDelta.position.x * scaleX,
            y: playerDelta.position.y * scaleY,
          } : { x: 0, y: 0 },
          angle: playerDelta.angle || 0,
          speed: playerDelta.speed || 2,
          alive: playerDelta.alive !== undefined ? playerDelta.alive : true,
          trail: (playerDelta.trailNew || []).map(pos => pos ? {
            x: pos.x * scaleX,
            y: pos.y * scaleY,
          } : null),
          boost: playerDelta.boost,
        };
        this.localState.players.push(player);
        playersMap.set(playerDelta.id, player);
      } else {
        // Actualizar jugador existente
        if (playerDelta.position) {
          player.position = {
            x: playerDelta.position.x * scaleX,
            y: playerDelta.position.y * scaleY,
          };
        }

        if (playerDelta.angle !== undefined) {
          player.angle = playerDelta.angle;
        }

        if (playerDelta.speed !== undefined) {
          player.speed = playerDelta.speed;
        }

        if (playerDelta.alive !== undefined) {
          player.alive = playerDelta.alive;
        }

        // Actualizar trail
        if (playerDelta.trailNew) {
          const newPoints = playerDelta.trailNew.map(pos => pos ? {
            x: pos.x * scaleX,
            y: pos.y * scaleY,
          } : null);
          
          if (playerDelta.trailLength !== undefined) {
            // Tenemos información de la longitud del trail del servidor
            const currentLength = player.trail.length;
            const targetLength = playerDelta.trailLength;
            
            if (targetLength < currentLength) {
              // Trail se redujo (reseteo) - reemplazar todo
              player.trail = newPoints;
            } else if (targetLength === currentLength) {
              // Trail tiene la misma longitud - reemplazar los últimos puntos
              // Esto ocurre cuando el trail está en el máximo y se agregan/eliminan puntos
              const pointsToReplace = newPoints.length;
              if (pointsToReplace === targetLength) {
                // Si se envían todos los puntos (reseteo completo o estado completo), reemplazar todo
                player.trail = newPoints;
              } else if (pointsToReplace > 0 && pointsToReplace < currentLength) {
                // Eliminar los últimos N puntos y agregar los nuevos
                // Mantener los primeros (targetLength - pointsToReplace) puntos
                const pointsToKeep = targetLength - pointsToReplace;
                player.trail = player.trail.slice(0, pointsToKeep).concat(newPoints);
              }
              // Asegurar que la longitud final sea exactamente targetLength
              if (player.trail.length !== targetLength) {
                player.trail = player.trail.slice(-targetLength);
              }
            } else {
              // Trail creció - agregar nuevos puntos
              player.trail.push(...newPoints);
              
              // Asegurar que la longitud coincida exactamente con el servidor
              if (player.trail.length !== targetLength) {
                if (player.trail.length > targetLength) {
                  // El trail del cliente es más largo - recortar desde el inicio
                  player.trail = player.trail.slice(-targetLength);
                } else {
                  // El trail del cliente es más corto - esto no debería pasar, pero por seguridad
                  // mantener lo que tenemos (el servidor agregará más puntos en el siguiente delta)
                }
              }
            }
          } else {
            // No tenemos información de longitud - solo agregar (comportamiento antiguo)
            player.trail.push(...newPoints);
            
            // EXPERIMENTO: Sin límite de trail - monitorear rendimiento
            // Limitar tamaño (por si acaso)
            // const MAX_TRAIL_LENGTH = 1200;
            // if (player.trail.length > MAX_TRAIL_LENGTH) {
            //   player.trail = player.trail.slice(-MAX_TRAIL_LENGTH);
            // }
          }
        }

        if (playerDelta.boost !== undefined) {
          player.boost = playerDelta.boost;
        }

        if (playerDelta.name) {
          player.name = playerDelta.name;
        }

        if (playerDelta.color) {
          player.color = playerDelta.color;
        }
      }
    }

    // Remover jugadores que ya no están (si no aparecen en el delta y el estado anterior los tenía)
    // Nota: Esto es conservador - solo removemos si el delta tiene menos jugadores que el estado anterior
    // En la práctica, el servidor debería enviar explícitamente cuando un jugador se desconecta

    return this.localState;
  }

  /**
   * Obtiene el estado local actual
   */
  getState(): GameState {
    if (!this.localState) {
      throw new Error('No hay estado local disponible');
    }
    return this.localState;
  }

  /**
   * Resetea el estado local
   */
  reset(): void {
    this.localState = null;
  }
}

