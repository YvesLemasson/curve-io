// Sistema de interpolación para suavizar movimiento entre updates del servidor
// Permite movimiento suave con 30 Hz de updates en cliente de 60 FPS

import type { GameState, Position } from "@shared/types";

interface InterpolatedState {
  state: GameState;
  serverTime: number; // Timestamp del servidor
  clientTime: number; // Timestamp del cliente cuando se recibió
}

export class InterpolationBuffer {
  private states: InterpolatedState[] = [];
  private readonly BUFFER_SIZE: number = 5; // Mantener últimos 5 estados
  private readonly INTERPOLATION_DELAY: number = 50; // ms de delay para suavizar (compensa latencia de red)
  private serverTimeOffset: number = 0; // Offset entre tiempo del servidor y cliente

  /**
   * Agrega un nuevo estado al buffer
   */
  addState(state: GameState, serverTime: number): void {
    const interpolatedState: InterpolatedState = {
      state: this.deepCopyState(state),
      serverTime,
      clientTime: performance.now(),
    };

    this.states.push(interpolatedState);

    // Mantener solo los últimos N estados
    if (this.states.length > this.BUFFER_SIZE) {
      this.states.shift();
    }

    // Calcular offset entre servidor y cliente (solo si tenemos al menos 2 estados)
    if (this.states.length >= 2) {
      const latest = this.states[this.states.length - 1];
      const previous = this.states[this.states.length - 2];
      
      // Estimar offset basado en la diferencia de tiempo
      const serverDelta = latest.serverTime - previous.serverTime;
      const clientDelta = latest.clientTime - previous.clientTime;
      
      // Actualizar offset gradualmente (promedio móvil)
      if (serverDelta > 0 && clientDelta > 0) {
        const estimatedOffset = latest.clientTime - latest.serverTime;
        this.serverTimeOffset = this.serverTimeOffset * 0.9 + estimatedOffset * 0.1;
      }
    }
  }

  /**
   * Obtiene el estado interpolado para el tiempo actual
   * Retorna null si no hay suficientes estados
   */
  getInterpolatedState(currentTime: number = performance.now()): GameState | null {
    if (this.states.length < 2) {
      // Si solo hay un estado, retornarlo directamente
      if (this.states.length === 1) {
        return this.states[0].state;
      }
      return null;
    }

    // Calcular tiempo objetivo (con delay para compensar latencia)
    const targetServerTime = currentTime - this.serverTimeOffset - this.INTERPOLATION_DELAY;

    // Encontrar los dos estados entre los que interpolar
    let state1: InterpolatedState | null = null;
    let state2: InterpolatedState | null = null;

    // Buscar estados adyacentes que contengan el tiempo objetivo
    for (let i = 0; i < this.states.length - 1; i++) {
      const s1 = this.states[i];
      const s2 = this.states[i + 1];

      // Convertir serverTime a tiempo del cliente para comparar
      const s1ClientTime = s1.serverTime + this.serverTimeOffset;
      const s2ClientTime = s2.serverTime + this.serverTimeOffset;

      if (targetServerTime >= s1ClientTime && targetServerTime <= s2ClientTime) {
        state1 = s1;
        state2 = s2;
        break;
      }
    }

    // Si no encontramos estados adyacentes, usar los más recientes
    if (!state1 || !state2) {
      // Si el tiempo objetivo es anterior al primer estado, usar el primero
      const firstState = this.states[0];
      const firstClientTime = firstState.serverTime + this.serverTimeOffset;
      if (targetServerTime < firstClientTime) {
        return firstState.state;
      }

      // Si el tiempo objetivo es posterior al último estado, usar el último
      const lastState = this.states[this.states.length - 1];
      const lastClientTime = lastState.serverTime + this.serverTimeOffset;
      if (targetServerTime > lastClientTime) {
        return lastState.state;
      }

      // Fallback: usar los dos más recientes
      state1 = this.states[this.states.length - 2];
      state2 = this.states[this.states.length - 1];
    }

    // Calcular factor de interpolación (0 = state1, 1 = state2)
    const s1ClientTime = state1.serverTime + this.serverTimeOffset;
    const s2ClientTime = state2.serverTime + this.serverTimeOffset;
    const timeRange = s2ClientTime - s1ClientTime;
    
    if (timeRange <= 0) {
      // Si no hay diferencia de tiempo, retornar el más reciente
      return state2.state;
    }

    const t = Math.max(0, Math.min(1, (targetServerTime - s1ClientTime) / timeRange));

    // Interpolar entre los dos estados
    return this.interpolateStates(state1.state, state2.state, t);
  }

  /**
   * Interpola entre dos estados
   */
  private interpolateStates(
    state1: GameState,
    state2: GameState,
    t: number
  ): GameState {
    // Crear estado interpolado
    const interpolated: GameState = {
      ...state1,
      players: state1.players.map((player1) => {
        const player2 = state2.players.find((p) => p.id === player1.id);
        
        if (!player2) {
          // Si el jugador no existe en el segundo estado, usar el primero
          return player1;
        }

        // Interpolar posición
        const interpolatedPosition: Position = {
          x: player1.position.x + (player2.position.x - player1.position.x) * t,
          y: player1.position.y + (player2.position.y - player1.position.y) * t,
        };

        // Interpolar ángulo (manejar wrap-around de 0 a 2π)
        let angle1 = player1.angle;
        let angle2 = player2.angle;
        
        // Normalizar ángulos a [0, 2π]
        while (angle1 < 0) angle1 += Math.PI * 2;
        while (angle1 >= Math.PI * 2) angle1 -= Math.PI * 2;
        while (angle2 < 0) angle2 += Math.PI * 2;
        while (angle2 >= Math.PI * 2) angle2 -= Math.PI * 2;

        // Calcular diferencia más corta
        let angleDiff = angle2 - angle1;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const interpolatedAngle = angle1 + angleDiff * t;

        // Usar el estado más reciente para propiedades discretas
        return {
          ...player2, // Usar estado más reciente como base
          position: interpolatedPosition,
          angle: interpolatedAngle,
          // Trail: usar el del estado más reciente (no interpolar trails)
          trail: player2.trail,
        };
      }),
    };

    return interpolated;
  }

  /**
   * Hace una copia profunda del estado
   */
  private deepCopyState(state: GameState): GameState {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Limpia el buffer
   */
  reset(): void {
    this.states = [];
    this.serverTimeOffset = 0;
  }

  /**
   * Obtiene el número de estados en el buffer
   */
  getBufferSize(): number {
    return this.states.length;
  }
}

