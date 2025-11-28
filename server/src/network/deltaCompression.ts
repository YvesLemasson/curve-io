// FASE 2: Delta Compression - Solo enviar cambios en lugar de estado completo
// Reduce ancho de banda en 70-90%

import type { GameState, Player } from '../shared/types.js';

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
    trailNew?: Array<{ x: number; y: number } | null>; // Solo nuevos puntos
    trailLength?: number; // Longitud total del trail
    boost?: { active: boolean; charge: number; remaining: number };
    name?: string;
    color?: string;
  }>;
  fullState?: boolean; // Si es true, es estado completo (primera vez o resync)
}

export class DeltaCompressor {
  private previousState: GameState | null = null;
  private lastFullStateTick: number = 0;
  private readonly FULL_STATE_INTERVAL: number = 300; // Enviar estado completo cada 300 ticks (~5 segundos)

  /**
   * Comprime el estado actual comparándolo con el anterior
   */
  compress(currentState: GameState): DeltaState {
    // Si no hay estado anterior o es necesario un resync, enviar estado completo
    if (!this.previousState || 
        currentState.tick - this.lastFullStateTick >= this.FULL_STATE_INTERVAL ||
        currentState.gameStatus !== this.previousState.gameStatus) {
      this.previousState = JSON.parse(JSON.stringify(currentState)); // Deep copy
      this.lastFullStateTick = currentState.tick;
      return this.createFullState(currentState);
    }

    // Crear delta
    const delta: DeltaState = {
      tick: currentState.tick,
      players: [],
    };

    // Comparar gameStatus
    if (currentState.gameStatus !== this.previousState.gameStatus) {
      delta.gameStatus = currentState.gameStatus;
    }

    // Comparar winnerId
    if (currentState.winnerId !== this.previousState.winnerId) {
      delta.winnerId = currentState.winnerId;
    }

    // Comparar jugadores
    const previousPlayersMap = new Map(
      this.previousState.players.map(p => [p.id, p])
    );

    for (const currentPlayer of currentState.players) {
      const previousPlayer = previousPlayersMap.get(currentPlayer.id);
      
      if (!previousPlayer) {
        // Jugador nuevo - enviar todo
        delta.players.push({
          id: currentPlayer.id,
          position: currentPlayer.position,
          angle: currentPlayer.angle,
          speed: currentPlayer.speed,
          alive: currentPlayer.alive,
          trailNew: currentPlayer.trail,
          trailLength: currentPlayer.trail.length,
          boost: currentPlayer.boost,
          name: currentPlayer.name,
          color: currentPlayer.color,
        });
      } else {
        // Jugador existente - solo cambios
        const playerDelta: DeltaState['players'][0] = { id: currentPlayer.id };
        let hasChanges = false;

        // Posición
        if (currentPlayer.position.x !== previousPlayer.position.x ||
            currentPlayer.position.y !== previousPlayer.position.y) {
          playerDelta.position = currentPlayer.position;
          hasChanges = true;
        }

        // Ángulo
        if (Math.abs(currentPlayer.angle - previousPlayer.angle) > 0.001) {
          playerDelta.angle = currentPlayer.angle;
          hasChanges = true;
        }

        // Velocidad
        if (currentPlayer.speed !== previousPlayer.speed) {
          playerDelta.speed = currentPlayer.speed;
          hasChanges = true;
        }

        // Estado alive
        if (currentPlayer.alive !== previousPlayer.alive) {
          playerDelta.alive = currentPlayer.alive;
          hasChanges = true;
        }

        // Trail - solo nuevos puntos
        // IMPORTANTE: Detectar cambios incluso cuando el trail está en el máximo
        // porque se agregan nuevos puntos pero se eliminan los antiguos (slice)
        const previousTrailLength = previousPlayer.trail.length;
        const currentTrailLength = currentPlayer.trail.length;
        
        if (currentTrailLength > previousTrailLength) {
          // Trail creció - enviar solo los nuevos puntos
          playerDelta.trailNew = currentPlayer.trail.slice(previousTrailLength);
          playerDelta.trailLength = currentTrailLength;
          hasChanges = true;
        } else if (currentTrailLength < previousTrailLength) {
          // Trail se redujo (jugador reseteado) - enviar todo
          playerDelta.trailNew = currentPlayer.trail;
          playerDelta.trailLength = currentTrailLength;
          hasChanges = true;
        } else if (currentTrailLength === previousTrailLength && currentTrailLength > 0) {
          // Trail tiene la misma longitud (probablemente está en el máximo)
          // Comparar los últimos N puntos para detectar si hay cambios
          // Si el trail está en el máximo, los últimos puntos deberían ser diferentes
          const COMPARE_LAST_N = 10; // Comparar últimos 10 puntos
          const prevLastN = previousPlayer.trail.slice(-COMPARE_LAST_N);
          const currLastN = currentPlayer.trail.slice(-COMPARE_LAST_N);
          
          // Verificar si los últimos puntos son diferentes
          let trailsAreDifferent = false;
          if (prevLastN.length !== currLastN.length) {
            trailsAreDifferent = true;
          } else {
            for (let i = 0; i < currLastN.length; i++) {
              const prev = prevLastN[i];
              const curr = currLastN[i];
              // Comparar puntos (o nulls)
              if ((prev === null) !== (curr === null)) {
                trailsAreDifferent = true;
                break;
              }
              if (prev !== null && curr !== null) {
                if (Math.abs(prev.x - curr.x) > 0.01 || Math.abs(prev.y - curr.y) > 0.01) {
                  trailsAreDifferent = true;
                  break;
                }
              }
            }
          }
          
          if (trailsAreDifferent) {
            // Los últimos puntos son diferentes - hay nuevos puntos
            // Cuando el trail está en el máximo, se agregan puntos al final y se eliminan del inicio
            // Para sincronizar correctamente, enviar los últimos N puntos (suficientes para cubrir cambios)
            // Aumentado a 100 puntos para mejor sincronización cuando el trail está en el máximo
            const POINTS_TO_SEND = Math.min(100, currentTrailLength); // Enviar últimos 100 puntos o menos
            playerDelta.trailNew = currentPlayer.trail.slice(-POINTS_TO_SEND);
            playerDelta.trailLength = currentTrailLength;
            hasChanges = true;
          }
        }

        // Boost
        if (currentPlayer.boost) {
          const prevBoost = previousPlayer.boost;
          if (!prevBoost ||
              currentPlayer.boost.active !== prevBoost.active ||
              Math.abs(currentPlayer.boost.charge - prevBoost.charge) > 1 ||
              Math.abs(currentPlayer.boost.remaining - prevBoost.remaining) > 10) {
            playerDelta.boost = currentPlayer.boost;
            hasChanges = true;
          }
        } else if (previousPlayer.boost) {
          // Boost se desactivó
          playerDelta.boost = { active: false, charge: 0, remaining: 0 };
          hasChanges = true;
        }

        // Solo agregar si hay cambios
        if (hasChanges) {
          delta.players.push(playerDelta);
        }
      }
    }

    // Actualizar estado anterior
    this.previousState = JSON.parse(JSON.stringify(currentState)); // Deep copy

    return delta;
  }

  /**
   * Crea un estado completo (sin compresión)
   */
  private createFullState(state: GameState): DeltaState {
    return {
      tick: state.tick,
      gameStatus: state.gameStatus,
      winnerId: state.winnerId,
      players: state.players.map(p => ({
        id: p.id,
        position: p.position,
        angle: p.angle,
        speed: p.speed,
        alive: p.alive,
        trailNew: p.trail,
        trailLength: p.trail.length,
        boost: p.boost,
        name: p.name,
        color: p.color,
      })),
      fullState: true,
    };
  }

  /**
   * Resetea el estado anterior (útil cuando se reinicia el juego)
   */
  reset(): void {
    this.previousState = null;
    this.lastFullStateTick = 0;
  }
}

