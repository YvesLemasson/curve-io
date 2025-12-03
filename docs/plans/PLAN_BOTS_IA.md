# Plan de Implementación: Sistema de Bots IA

## 📋 Análisis del Estado Actual

### Arquitectura Actual

- **Sistema de matchmaking** con salas separadas (`MatchmakingManager`)
- **Cada sala tiene su propio `GameServer` y `PlayerManager`**
- **Sistema de inputs** procesado en el servidor (`processInputs()`)
- **Jugadores reales** se conectan vía WebSocket y envían inputs
- **Máximo 8 jugadores** por sala
- **Sistema de rondas** (5 rondas por partida)

### Flujo Actual

1. Jugador se conecta al servidor
2. `MatchmakingManager` asigna jugador a una sala
3. Jugador envía inputs (`GAME_INPUT`) vía WebSocket
4. `GameServer` procesa inputs y actualiza estado
5. Estado se broadcast a todos los jugadores de la sala

### Limitaciones Actuales

- ❌ No hay bots - si hay pocos jugadores, la partida puede ser aburrida
- ❌ No hay modo de práctica para jugadores nuevos
- ❌ Partidas pueden tardar en iniciarse si no hay suficientes jugadores
- ❌ Jugadores pueden abandonar y dejar partidas incompletas

---

## 🎯 Objetivos del Sistema de Bots IA

1. **Asegurar que siempre haya jugadores disponibles** para jugar
2. **Rellenar salas automáticamente** cuando hay pocos jugadores
3. **Proporcionar experiencia de juego consistente** incluso con pocos jugadores reales
4. **Implementar IA con diferentes niveles de dificultad**
5. **Los bots deben comportarse de manera realista** (evitar colisiones, usar boost inteligentemente)
6. **No afectar negativamente el rendimiento** del servidor
7. **Los bots deben ser indistinguibles de jugadores reales** en términos de gameplay

---

## 🏗️ Arquitectura Propuesta

### Decisión: IA en el Servidor ⭐

**Ventajas:**

- ✅ Autoritativa - el servidor controla los bots
- ✅ No se puede hacer trampa
- ✅ Sincronización automática con jugadores reales
- ✅ Menor carga en el cliente
- ✅ Los bots se integran naturalmente con el sistema existente

**Desventajas:**

- ⚠️ Más carga en el servidor (pero manejable con optimizaciones)

### Estructura de Archivos

```
server/src/
├── ai/
│   ├── botController.ts      # Controlador principal - gestiona creación/eliminación de bots
│   ├── botAI.ts              # Lógica de IA - toma decisiones (left/right/boost)
│   ├── botStrategies.ts      # Diferentes estrategias de juego
│   ├── botDifficulty.ts      # Niveles de dificultad y configuración
│   └── botNames.ts           # Generador de nombres para bots
```

### Flujo de Integración

```
MatchmakingManager
    ↓
GameRoom (cuando tiene < 3 jugadores después de 10s)
    ↓
BotController.addBotsToRoom(room, count)
    ↓
BotController crea bots y los añade al PlayerManager
    ↓
En cada tick del GameServer:
    ↓
BotController.updateBots(room, gameState)
    ↓
BotAI.calculateAction(bot, gameState, difficulty)
    ↓
BotController simula input (left/right/boost)
    ↓
GameServer procesa input como si fuera de un jugador real
```

---

## 📐 Diseño Detallado

### 1. Tipos y Interfaces

```typescript
// shared/types.ts - AÑADIR

export interface Player {
  // ... campos existentes ...
  isBot?: boolean; // NUEVO: Identifica si es un bot
  botDifficulty?: BotDifficulty; // NUEVO: Nivel de dificultad del bot
}

// server/src/ai/botDifficulty.ts - NUEVO

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotDifficultyConfig {
  reactionTime: number; // ms - tiempo de reacción
  decisionInterval: number; // ms - cada cuánto toma decisiones
  errorRate: number; // 0-1 - probabilidad de error
  boostUsage: number; // 0-1 - agresividad en uso de boost
  avoidanceDistance: number; // píxeles - distancia mínima para evitar colisiones
  predictionAccuracy: number; // 0-1 - precisión al predecir movimientos
}

export const BOT_DIFFICULTY_CONFIGS: Record<
  BotDifficulty,
  BotDifficultyConfig
> = {
  easy: {
    reactionTime: 300, // Reacciona lento
    decisionInterval: 200, // Decide cada 200ms
    errorRate: 0.15, // 15% de errores
    boostUsage: 0.3, // Usa boost conservadoramente
    avoidanceDistance: 80, // Evita colisiones desde lejos
    predictionAccuracy: 0.5, // Predicción mediocre
  },
  medium: {
    reactionTime: 150,
    decisionInterval: 100,
    errorRate: 0.08,
    boostUsage: 0.5,
    avoidanceDistance: 60,
    predictionAccuracy: 0.7,
  },
  hard: {
    reactionTime: 80,
    decisionInterval: 50,
    errorRate: 0.03,
    boostUsage: 0.7,
    avoidanceDistance: 40,
    predictionAccuracy: 0.9,
  },
};
```

### 2. BotController

```typescript
// server/src/ai/botController.ts - NUEVO

import { PlayerManager } from "../game/playerManager.js";
import { GameServer } from "../game/gameServer.js";
import { BotAI } from "./botAI.js";
import { generateBotName } from "./botNames.js";
import { getRandomColor } from "../utils/colors.js";
import type { GameRoom } from "../matchmaking/matchmakingManager.js";
import type { GameState, Player } from "../shared/types.js";
import type { BotDifficulty } from "./botDifficulty.js";
import { logger } from "../utils/logger.js";

export class BotController {
  private botAIs: Map<string, BotAI> = new Map(); // botId -> BotAI instance
  private botLastDecisionTime: Map<string, number> = new Map(); // botId -> timestamp
  private botCurrentAction: Map<string, "left" | "right" | null> = new Map(); // botId -> acción actual
  private botBoostRequested: Map<string, boolean> = new Map(); // botId -> boost solicitado

  /**
   * Añade bots a una sala
   * @param room - Sala donde añadir bots
   * @param count - Número de bots a añadir
   * @param difficulty - Dificultad de los bots (opcional, aleatorio por defecto)
   */
  addBotsToRoom(
    room: GameRoom,
    count: number,
    difficulty?: BotDifficulty
  ): void {
    const existingPlayers = room.playerManager.getAllPlayers();
    const existingBots = existingPlayers.filter((p) => p.isBot);
    const slotsAvailable = room.maxPlayers - existingPlayers.length;

    const botsToAdd = Math.min(count, slotsAvailable);

    if (botsToAdd <= 0) {
      logger.log(`⚠️ No se pueden añadir bots - sala llena`);
      return;
    }

    logger.log(`🤖 Añadiendo ${botsToAdd} bots a sala ${room.roomId}`);

    for (let i = 0; i < botsToAdd; i++) {
      const botDifficulty = difficulty || this.getRandomDifficulty();
      const bot = this.createBot(botDifficulty, room);

      // Añadir bot al PlayerManager de la sala
      room.playerManager.addPlayer(bot);

      // Crear instancia de IA para este bot
      const botAI = new BotAI(botDifficulty);
      this.botAIs.set(bot.id, botAI);
      this.botLastDecisionTime.set(bot.id, Date.now());
      this.botCurrentAction.set(bot.id, null);
      this.botBoostRequested.set(bot.id, false);
    }

    room.currentPlayers = room.playerManager.getPlayerCount();
    logger.log(
      `✅ ${botsToAdd} bots añadidos. Total jugadores: ${room.currentPlayers}`
    );
  }

  /**
   * Crea un bot con propiedades aleatorias
   */
  private createBot(difficulty: BotDifficulty, room: GameRoom): Player {
    const botId = `bot_${difficulty}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const botName = generateBotName();
    const botColor = getRandomColor();

    // Posición inicial aleatoria (evitar centro donde suelen estar los jugadores)
    const margin = 100;
    const startX = margin + Math.random() * (1920 - 2 * margin);
    const startY = margin + Math.random() * (1280 - 2 * margin);
    const startAngle = Math.random() * Math.PI * 2;

    return {
      id: botId,
      name: botName,
      color: botColor,
      position: { x: startX, y: startY },
      angle: startAngle,
      speed: 0.5, // Misma velocidad que jugadores reales
      alive: true,
      trail: [{ x: startX, y: startY }],
      isBot: true,
      botDifficulty: difficulty,
    };
  }

  /**
   * Actualiza todos los bots en una sala
   * Se llama desde GameServer en cada tick
   */
  updateBots(room: GameRoom, gameState: GameState): void {
    if (
      gameState.gameStatus !== "playing" &&
      gameState.gameStatus !== "pre-game"
    ) {
      return; // No actualizar bots si el juego no está en curso
    }

    const bots = room.playerManager
      .getAllPlayers()
      .filter((p) => p.isBot && p.alive);

    for (const bot of bots) {
      const botAI = this.botAIs.get(bot.id);
      if (!botAI || !bot.botDifficulty) continue;

      const currentTime = Date.now();
      const lastDecisionTime = this.botLastDecisionTime.get(bot.id) || 0;
      const config = BOT_DIFFICULTY_CONFIGS[bot.botDifficulty];

      // Verificar si es momento de tomar una nueva decisión
      if (currentTime - lastDecisionTime >= config.decisionInterval) {
        // Calcular nueva acción
        const action = botAI.calculateAction(bot, gameState, bot.botDifficulty);

        // Aplicar acción al bot
        this.applyBotAction(room, bot, action);

        // Actualizar tiempo de última decisión
        this.botLastDecisionTime.set(bot.id, currentTime);
        this.botCurrentAction.set(bot.id, action.direction);
        this.botBoostRequested.set(bot.id, action.boost || false);
      } else {
        // Continuar con la acción actual
        const currentAction = this.botCurrentAction.get(bot.id);
        const boostRequested = this.botBoostRequested.get(bot.id) || false;

        if (currentAction) {
          this.applyBotAction(room, bot, {
            direction: currentAction,
            boost: boostRequested,
          });
        }
      }
    }
  }

  /**
   * Aplica una acción a un bot (simula input)
   */
  private applyBotAction(
    room: GameRoom,
    bot: Player,
    action: { direction: "left" | "right" | null; boost?: boolean }
  ): void {
    if (!action.direction && !action.boost) return;

    // Simular input como si fuera un jugador real
    if (action.direction) {
      room.gameServer.addInput({
        playerId: bot.id,
        key: action.direction,
        timestamp: Date.now(),
        boost: action.boost || false,
      });
    } else if (action.boost) {
      // Solo boost sin dirección (mantener dirección actual)
      room.gameServer.addInput({
        playerId: bot.id,
        key: null,
        timestamp: Date.now(),
        boost: true,
      });
    }
  }

  /**
   * Elimina bots de una sala
   */
  removeBotsFromRoom(room: GameRoom, botIds?: string[]): void {
    if (botIds) {
      // Eliminar bots específicos
      for (const botId of botIds) {
        room.playerManager.removePlayer(botId);
        this.botAIs.delete(botId);
        this.botLastDecisionTime.delete(botId);
        this.botCurrentAction.delete(botId);
        this.botBoostRequested.delete(botId);
      }
    } else {
      // Eliminar todos los bots de la sala
      const bots = room.playerManager.getAllPlayers().filter((p) => p.isBot);
      for (const bot of bots) {
        room.playerManager.removePlayer(bot.id);
        this.botAIs.delete(bot.id);
        this.botLastDecisionTime.delete(bot.id);
        this.botCurrentAction.delete(bot.id);
        this.botBoostRequested.delete(bot.id);
      }
    }

    room.currentPlayers = room.playerManager.getPlayerCount();
  }

  /**
   * Obtiene dificultad aleatoria
   */
  private getRandomDifficulty(): BotDifficulty {
    const difficulties: BotDifficulty[] = ["easy", "medium", "hard"];
    const weights = [0.4, 0.4, 0.2]; // 40% fácil, 40% medio, 20% difícil
    const random = Math.random();

    let cumulative = 0;
    for (let i = 0; i < difficulties.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return difficulties[i];
      }
    }
    return "medium";
  }

  /**
   * Limpia bots de una sala cuando termina
   */
  cleanupRoom(roomId: string): void {
    // Los bots se eliminan automáticamente cuando se elimina la sala
    // Este método puede usarse para limpieza adicional si es necesario
  }
}
```

### 3. BotAI - Lógica de Decisión

```typescript
// server/src/ai/botAI.ts - NUEVO

import type { Player, GameState, Position } from "../shared/types.js";
import type { BotDifficulty } from "./botDifficulty.js";
import { BOT_DIFFICULTY_CONFIGS } from "./botDifficulty.js";
import {
  checkBoundaryCollision,
  checkTrailCollision,
} from "../game/collision.js";

export interface BotAction {
  direction: "left" | "right" | null;
  boost?: boolean;
}

export class BotAI {
  private difficulty: BotDifficulty;
  private config: BotDifficultyConfig;

  constructor(difficulty: BotDifficulty) {
    this.difficulty = difficulty;
    this.config = BOT_DIFFICULTY_CONFIGS[difficulty];
  }

  /**
   * Calcula la siguiente acción del bot
   */
  calculateAction(
    bot: Player,
    gameState: GameState,
    difficulty: BotDifficulty
  ): BotAction {
    this.difficulty = difficulty;
    this.config = BOT_DIFFICULTY_CONFIGS[difficulty];

    // Estrategia principal: evitar colisiones
    const collisionRisk = this.assessCollisionRisk(bot, gameState);

    if (collisionRisk.immediate) {
      // Colisión inminente - acción urgente
      return this.avoidImmediateCollision(bot, gameState, collisionRisk);
    }

    if (collisionRisk.near) {
      // Colisión cercana - planificar evasión
      return this.planEvasiveAction(bot, gameState, collisionRisk);
    }

    // Sin colisiones cercanas - comportamiento estratégico
    return this.strategicBehavior(bot, gameState);
  }

  /**
   * Evalúa el riesgo de colisión
   */
  private assessCollisionRisk(
    bot: Player,
    gameState: GameState
  ): {
    immediate: boolean;
    near: boolean;
    direction: "left" | "right" | null;
    distance: number;
  } {
    const lookAheadDistance = 50; // Distancia a verificar
    const currentSpeed = bot.speed * (bot.boost?.active ? 1.5 : 1.0);

    // Calcular posición futura
    const futureX = bot.position.x + Math.cos(bot.angle) * lookAheadDistance;
    const futureY = bot.position.y + Math.sin(bot.angle) * lookAheadDistance;
    const futurePos: Position = { x: futureX, y: futureY };

    // Verificar colisión con bordes
    const boundaryCollision = checkBoundaryCollision(futurePos, 1920, 1280);

    if (boundaryCollision) {
      return {
        immediate: true,
        near: true,
        direction: this.getBestEscapeDirection(bot),
        distance: 0,
      };
    }

    // Verificar colisión con trails
    const otherTrails = gameState.players
      .filter((p) => p.id !== bot.id && p.alive)
      .map((p) => ({
        trail: p.trail,
        playerId: p.id,
      }));

    const trailCollision = checkTrailCollision(
      bot.position,
      futurePos,
      otherTrails,
      bot.id
    );

    if (trailCollision.collided) {
      return {
        immediate: true,
        near: true,
        direction: this.getBestEscapeDirection(bot),
        distance: 0,
      };
    }

    // Verificar colisiones cercanas (no inmediatas)
    const nearbyThreats = this.findNearbyThreats(bot, gameState);

    if (nearbyThreats.length > 0) {
      const closestThreat = nearbyThreats[0];
      return {
        immediate: false,
        near: true,
        direction: this.getBestEscapeDirection(bot, closestThreat),
        distance: closestThreat.distance,
      };
    }

    return {
      immediate: false,
      near: false,
      direction: null,
      distance: Infinity,
    };
  }

  /**
   * Encuentra amenazas cercanas (trails, bordes)
   */
  private findNearbyThreats(
    bot: Player,
    gameState: GameState
  ): Array<{ distance: number; angle: number; type: "trail" | "boundary" }> {
    const threats: Array<{
      distance: number;
      angle: number;
      type: "trail" | "boundary";
    }> = [];
    const checkDistance = this.config.avoidanceDistance;

    // Verificar distancia a bordes
    const distToLeft = bot.position.x;
    const distToRight = 1920 - bot.position.x;
    const distToTop = bot.position.y;
    const distToBottom = 1280 - bot.position.y;

    const minDistToBoundary = Math.min(
      distToLeft,
      distToRight,
      distToTop,
      distToBottom
    );

    if (minDistToBoundary < checkDistance) {
      threats.push({
        distance: minDistToBoundary,
        angle: this.getAngleToBoundary(bot),
        type: "boundary",
      });
    }

    // Verificar trails cercanos
    for (const player of gameState.players) {
      if (player.id === bot.id || !player.alive) continue;

      const trail = player.trail.filter((p) => p !== null) as Position[];
      if (trail.length === 0) continue;

      // Verificar últimos N puntos del trail (más relevantes)
      const recentTrail = trail.slice(-50);

      for (const trailPoint of recentTrail) {
        const dx = trailPoint.x - bot.position.x;
        const dy = trailPoint.y - bot.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < checkDistance) {
          const angle = Math.atan2(dy, dx);
          threats.push({
            distance,
            angle,
            type: "trail",
          });
          break; // Solo una amenaza por jugador
        }
      }
    }

    // Ordenar por distancia (más cercano primero)
    threats.sort((a, b) => a.distance - b.distance);

    return threats;
  }

  /**
   * Obtiene el mejor ángulo para escapar de un boundary
   */
  private getAngleToBoundary(bot: Player): number {
    const margin = 50;
    const distToLeft = bot.position.x;
    const distToRight = 1920 - bot.position.x;
    const distToTop = bot.position.y;
    const distToBottom = 1280 - bot.position.y;

    // Determinar qué borde está más cerca
    if (distToLeft < margin) return Math.PI; // Girar a la derecha
    if (distToRight < margin) return 0; // Girar a la izquierda
    if (distToTop < margin) return Math.PI / 2; // Girar hacia abajo
    if (distToBottom < margin) return -Math.PI / 2; // Girar hacia arriba

    return bot.angle; // Mantener dirección actual
  }

  /**
   * Obtiene la mejor dirección para escapar
   */
  private getBestEscapeDirection(
    bot: Player,
    threat?: { distance: number; angle: number; type: "trail" | "boundary" }
  ): "left" | "right" {
    if (threat) {
      // Calcular ángulo relativo de la amenaza
      const relativeAngle = threat.angle - bot.angle;
      const normalizedAngle =
        ((relativeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // Si la amenaza está a la izquierda, girar a la derecha (y viceversa)
      if (normalizedAngle > Math.PI) {
        return "left"; // Girar a la izquierda para alejarse
      } else {
        return "right"; // Girar a la derecha para alejarse
      }
    }

    // Sin amenaza específica - girar hacia el centro del área de juego
    const centerX = 1920 / 2;
    const centerY = 1280 / 2;
    const dx = centerX - bot.position.x;
    const dy = centerY - bot.position.y;
    const angleToCenter = Math.atan2(dy, dx);
    const relativeAngle = angleToCenter - bot.angle;
    const normalizedAngle =
      ((relativeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    return normalizedAngle > Math.PI ? "left" : "right";
  }

  /**
   * Evita colisión inmediata
   */
  private avoidImmediateCollision(
    bot: Player,
    gameState: GameState,
    collisionRisk: { direction: "left" | "right" | null; distance: number }
  ): BotAction {
    const direction =
      collisionRisk.direction || this.getBestEscapeDirection(bot);

    // Usar boost si está disponible y la colisión es muy inminente
    const shouldBoost =
      bot.boost &&
      bot.boost.remaining > 0 &&
      collisionRisk.distance < 30 &&
      Math.random() < this.config.boostUsage;

    // Aplicar error ocasional (dificultad fácil)
    if (Math.random() < this.config.errorRate) {
      return {
        direction: direction === "left" ? "right" : "left",
        boost: false,
      };
    }

    return {
      direction,
      boost: shouldBoost,
    };
  }

  /**
   * Planifica acción evasiva (colisión cercana pero no inmediata)
   */
  private planEvasiveAction(
    bot: Player,
    gameState: GameState,
    collisionRisk: { direction: "left" | "right" | null; distance: number }
  ): BotAction {
    const direction =
      collisionRisk.direction || this.getBestEscapeDirection(bot);

    // Usar boost ocasionalmente para evasión
    const shouldBoost =
      bot.boost &&
      bot.boost.remaining > 0 &&
      Math.random() < this.config.boostUsage * 0.5;

    return {
      direction,
      boost: shouldBoost,
    };
  }

  /**
   * Comportamiento estratégico cuando no hay colisiones cercanas
   */
  private strategicBehavior(bot: Player, gameState: GameState): BotAction {
    // Moverse hacia áreas abiertas
    const openAreaDirection = this.findOpenArea(bot, gameState);

    // Ocasionalmente intentar cortar a otros jugadores (solo dificultad hard)
    if (this.difficulty === "hard" && Math.random() < 0.3) {
      const aggressiveAction = this.attemptAggressiveMove(bot, gameState);
      if (aggressiveAction) {
        return aggressiveAction;
      }
    }

    return {
      direction: openAreaDirection,
      boost: false,
    };
  }

  /**
   * Encuentra dirección hacia área abierta
   */
  private findOpenArea(
    bot: Player,
    gameState: GameState
  ): "left" | "right" | null {
    // Simular movimiento hacia izquierda y derecha
    const leftAngle = bot.angle - Math.PI / 50;
    const rightAngle = bot.angle + Math.PI / 50;

    const leftScore = this.scoreDirection(bot, leftAngle, gameState);
    const rightScore = this.scoreDirection(bot, rightAngle, gameState);

    if (leftScore > rightScore + 10) return "left";
    if (rightScore > leftScore + 10) return "right";

    // Si son similares, mantener dirección actual (null = no girar)
    return null;
  }

  /**
   * Evalúa qué tan seguro es moverse en una dirección
   */
  private scoreDirection(
    bot: Player,
    angle: number,
    gameState: GameState
  ): number {
    let score = 100;

    // Simular posición futura
    const futureX = bot.position.x + Math.cos(angle) * 100;
    const futureY = bot.position.y + Math.sin(angle) * 100;
    const futurePos: Position = { x: futureX, y: futureY };

    // Penalizar si está cerca de bordes
    const margin = 100;
    if (
      futureX < margin ||
      futureX > 1920 - margin ||
      futureY < margin ||
      futureY > 1280 - margin
    ) {
      score -= 50;
    }

    // Penalizar si está cerca de trails
    for (const player of gameState.players) {
      if (player.id === bot.id || !player.alive) continue;

      const trail = player.trail.filter((p) => p !== null) as Position[];
      const recentTrail = trail.slice(-30);

      for (const trailPoint of recentTrail) {
        const dx = trailPoint.x - futureX;
        const dy = trailPoint.y - futureY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 80) {
          score -= 30;
        }
      }
    }

    return score;
  }

  /**
   * Intenta movimiento agresivo (solo dificultad hard)
   */
  private attemptAggressiveMove(
    bot: Player,
    gameState: GameState
  ): BotAction | null {
    // Buscar jugadores cercanos para intentar cortarles el camino
    const nearbyPlayers = gameState.players.filter((p) => {
      if (p.id === bot.id || !p.alive) return false;

      const dx = p.position.x - bot.position.x;
      const dy = p.position.y - bot.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < 200;
    });

    if (nearbyPlayers.length === 0) return null;

    // Intentar interceptar a un jugador cercano
    const target = nearbyPlayers[0];
    const dx = target.position.x - bot.position.x;
    const dy = target.position.y - bot.position.y;
    const angleToTarget = Math.atan2(dy, dx);
    const relativeAngle = angleToTarget - bot.angle;
    const normalizedAngle =
      ((relativeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Solo intentar si el objetivo está relativamente adelante
    if (normalizedAngle > Math.PI / 4 && normalizedAngle < (7 * Math.PI) / 4) {
      return null; // Objetivo está muy a los lados o atrás
    }

    // Calcular dirección para interceptar
    const direction = normalizedAngle > Math.PI ? "left" : "right";

    // Usar boost para interceptar
    const shouldBoost = bot.boost && bot.boost.remaining > 1000;

    return {
      direction,
      boost: shouldBoost || false,
    };
  }
}
```

### 4. Generador de Nombres

```typescript
// server/src/ai/botNames.ts - NUEVO

const BOT_NAMES = [
  "CurveMaster",
  "TrailBlazer",
  "SpeedDemon",
  "LineRider",
  "PathFinder",
  "VectorVortex",
  "ArcAngel",
  "LoopLegend",
  "DashDragon",
  "SwiftSnake",
  "NeonNinja",
  "PixelPilot",
  "GridGlider",
  "FlowFighter",
  "TraceTitan",
  "BoltBot",
  "ZigZag",
  "WarpWizard",
  "SpinSpecter",
  "DriftDroid",
  "TurboTron",
  "FlashFury",
  "BeamBender",
  "RushRacer",
  "SlashSprint",
  "NitroNexus",
  "BlazeBot",
  "StreakStorm",
  "JetJumper",
  "ZoomZephyr",
];

export function generateBotName(): string {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${name}${number}`;
}
```

### 5. Utilidad de Colores

```typescript
// server/src/utils/colors.ts - NUEVO (o añadir a archivo existente)

const BOT_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52BE80",
  "#E74C3C",
  "#3498DB",
  "#9B59B6",
  "#1ABC9C",
  "#F39C12",
];

export function getRandomColor(): string {
  return BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
}
```

---

## 🔧 Cambios Necesarios en el Código Existente

### 1. Modificar `shared/types.ts`

```typescript
// AÑADIR campos opcionales a Player
export interface Player {
  // ... campos existentes ...
  isBot?: boolean;
  botDifficulty?: "easy" | "medium" | "hard";
}
```

### 2. Modificar `GameServer` para aceptar inputs de bots

```typescript
// server/src/game/gameServer.ts

// AÑADIR método público para añadir inputs (los bots lo usarán)
public addInput(input: { playerId: string; key: 'left' | 'right' | null; timestamp: number; boost?: boolean }): void {
  if (!this.inputQueue.has(input.playerId)) {
    this.inputQueue.set(input.playerId, []);
  }

  const queue = this.inputQueue.get(input.playerId)!;
  queue.push({
    playerId: input.playerId,
    key: input.key,
    timestamp: input.timestamp,
    boost: input.boost || false,
  });

  // Limitar tamaño de cola (mantener últimos 10 inputs)
  if (queue.length > 10) {
    queue.shift();
  }
}
```

### 3. Modificar `MatchmakingManager` para integrar bots

```typescript
// server/src/matchmaking/matchmakingManager.ts

import { BotController } from "../ai/botController.js";

export class MatchmakingManager {
  private botController: BotController;
  private botFillTimers: Map<string, NodeJS.Timeout> = new Map(); // roomId -> timer

  constructor(io: Server) {
    // ... código existente ...
    this.botController = new BotController();
  }

  /**
   * Añade jugador a una sala (modificado)
   */
  addPlayerToRoom(roomId: string, player: Player): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.playerManager.addPlayer(player);
    room.currentPlayers = room.playerManager.getPlayerCount();

    // Cancelar timer de bots si hay suficientes jugadores
    this.cancelBotFillTimer(roomId);

    // Si hay menos de 3 jugadores, iniciar timer para añadir bots
    if (room.currentPlayers < 3 && room.status === "waiting") {
      this.scheduleBotFill(roomId);
    }
  }

  /**
   * Programa el rellenado de bots después de 10 segundos
   */
  private scheduleBotFill(roomId: string): void {
    // Cancelar timer existente si hay uno
    this.cancelBotFillTimer(roomId);

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (!room || room.status !== "waiting") return;

      const currentPlayers = room.playerManager.getPlayerCount();
      const botsNeeded = Math.min(
        3 - currentPlayers,
        room.maxPlayers - currentPlayers
      );

      if (botsNeeded > 0) {
        this.botController.addBotsToRoom(room, botsNeeded);
        this.broadcastLobbyPlayers(roomId); // Notificar a clientes
      }

      this.botFillTimers.delete(roomId);
    }, 10000); // 10 segundos

    this.botFillTimers.set(roomId, timer);
  }

  /**
   * Cancela el timer de rellenado de bots
   */
  private cancelBotFillTimer(roomId: string): void {
    const timer = this.botFillTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.botFillTimers.delete(roomId);
    }
  }

  /**
   * Modificar setupRoomCallbacks para actualizar bots
   */
  private setupRoomCallbacks(room: GameRoom): void {
    // ... callbacks existentes ...

    // AÑADIR: Actualizar bots en cada broadcast
    room.gameServer.onBroadcast((gameState: GameState) => {
      // ... código existente de broadcast ...

      // Actualizar bots
      this.botController.updateBots(room, gameState);
    });
  }

  /**
   * Limpiar bots cuando se elimina una sala
   */
  private cleanupRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.botController.removeBotsFromRoom(room);
    }
    this.cancelBotFillTimer(roomId);
    // ... resto de limpieza ...
  }
}
```

### 4. Modificar `server/src/index.ts` para inicializar BotController

```typescript
// server/src/index.ts

// El BotController ya se inicializa en MatchmakingManager
// No se necesitan cambios adicionales aquí
```

---

## 📅 Plan de Implementación por Fases

### Fase 1: Estructura Básica y Bots Simples (Semana 1)

**Objetivo:** Bots básicos que evitan colisiones

**Tareas:**

1. ✅ Crear estructura de archivos (`ai/` directory)
2. ✅ Implementar `BotDifficulty` y configuraciones
3. ✅ Implementar `BotNames` y generador de colores
4. ✅ Implementar `BotController` básico (crear/eliminar bots)
5. ✅ Modificar `Player` type para incluir `isBot`
6. ✅ Integrar `BotController` en `MatchmakingManager`
7. ✅ Añadir método `addInput` público en `GameServer`
8. ✅ Implementar `BotAI` básico (solo evasión de colisiones)
9. ✅ Testing básico: bots se crean y se mueven

**Checkpoint:** Bots aparecen en el juego y se mueven evitando colisiones básicas

---

### Fase 2: IA Mejorada y Dificultades (Semana 2)

**Objetivo:** Bots con diferentes niveles de dificultad y comportamiento más realista

**Tareas:**

1. ✅ Mejorar `BotAI` con detección avanzada de amenazas
2. ✅ Implementar sistema de dificultades (easy/medium/hard)
3. ✅ Añadir uso inteligente de boost
4. ✅ Implementar comportamiento estratégico (moverse hacia áreas abiertas)
5. ✅ Añadir errores ocasionales según dificultad
6. ✅ Optimizar rendimiento (limitar cálculos costosos)
7. ✅ Testing: verificar que bots de diferentes dificultades se comportan diferente

**Checkpoint:** Bots tienen 3 niveles de dificultad claramente diferenciados

---

### Fase 3: Integración Completa y Optimizaciones (Semana 3)

**Objetivo:** Integración completa con el sistema de juego y optimizaciones

**Tareas:**

1. ✅ Integrar bots con sistema de rondas
2. ✅ Asegurar que bots se resetean correctamente entre rondas
3. ✅ Añadir lógica de rellenado automático (10s timer)
4. ✅ Optimizar cálculos de IA (usar spatial hash si es necesario)
5. ✅ Añadir logging para debugging
6. ⏳ Testing de rendimiento (verificar que no afecta FPS)
7. ⏳ Testing de integración completa (partidas completas con bots)
8. 🔄 Mejorar lógica de evasión de trails (evaluar ambas direcciones antes de decidir)

**Checkpoint:** Sistema completo funcionando sin problemas de rendimiento

---

### Fase 4: Comportamiento Avanzado (Opcional - Futuro)

**Objetivo:** Bots más inteligentes y comportamientos variados

**Tareas:**

1. ⏳ Implementar comportamiento agresivo (intentar cortar a otros)
2. ⏳ Añadir personalidades diferentes a bots
3. ⏳ Implementar aprendizaje básico (adaptar dificultad según rendimiento)
4. ⏳ Añadir más estrategias variadas
5. ⏳ Testing de balance (verificar que bots no son demasiado fáciles/difíciles)

---

## 🧪 Testing

### Tests Unitarios

```typescript
// server/src/ai/__tests__/botAI.test.ts

describe("BotAI", () => {
  it("debe evitar colisiones inminentes", () => {
    // Test evasión de colisiones
  });

  it("debe usar boost cuando es apropiado", () => {
    // Test uso de boost
  });

  it("debe comportarse diferente según dificultad", () => {
    // Test diferentes dificultades
  });
});
```

### Tests de Integración

1. **Test: Bots se añaden automáticamente**

   - Crear sala con 1 jugador
   - Esperar 10 segundos
   - Verificar que se añadieron bots

2. **Test: Bots se eliminan cuando jugadores reales se unen**

   - Sala con 2 bots
   - Añadir 2 jugadores reales
   - Verificar que sala tiene 4 jugadores (2 reales + 2 bots)

3. **Test: Bots funcionan en rondas múltiples**

   - Iniciar partida con bots
   - Completar todas las rondas
   - Verificar que bots se resetean correctamente

4. **Test: Rendimiento**
   - Partida con 8 bots
   - Verificar que FPS se mantiene estable
   - Verificar que no hay lag en el servidor

---

## ⚠️ Consideraciones Técnicas

### Rendimiento

1. **Optimización de cálculos:**

   - Limitar detección de amenazas a jugadores cercanos (usar spatial hash)
   - Cachear cálculos costosos cuando sea posible
   - Limitar frecuencia de decisiones según dificultad

2. **Límites:**
   - Máximo 6 bots por sala (dejar 2 slots para jugadores reales)
   - Bots solo se actualizan cuando el juego está en 'playing' o 'pre-game'

### Sincronización

1. **Inputs de bots:**
   - Los bots envían inputs como jugadores reales
   - Se procesan en el mismo `processInputs()` que jugadores reales
   - No requiere cambios en el sistema de sincronización

### ELO/Ranking

**Decisión:** Los bots NO afectan el ELO de jugadores reales

**Razón:**

- Evita que jugadores farmen ELO fácilmente
- Mantiene integridad del sistema de ranking
- Los bots son solo para rellenar partidas, no para competir

**Alternativa (futuro):**

- Si se implementa modo "Práctica", los bots podrían tener ELO pero con multiplicador reducido (0.1x)

### Identificación de Bots

1. **En el cliente:**

   - Los bots tienen `isBot: true` en el objeto Player
   - Se pueden mostrar con un indicador visual (opcional)
   - O mantenerlos indistinguibles para mayor inmersión

2. **En el servidor:**
   - IDs de bots tienen prefijo `bot_`
   - Se pueden filtrar en logs y estadísticas

---

## 📊 Métricas de Éxito

1. **Tiempo de espera:** Partidas inician en < 15 segundos (con bots)
2. **Rendimiento:** FPS se mantiene estable con 6 bots activos
3. **Balance:** Bots de dificultad "medium" tienen ~50% de tasa de supervivencia
4. **Experiencia:** Jugadores no notan diferencia significativa entre bots y jugadores reales (en términos de gameplay)

---

## 🚀 Próximos Pasos

1. **Revisar y aprobar este plan**
2. **Crear branch:** `feature/bots-ai`
3. **Empezar con Fase 1:** Estructura básica
4. **Testing continuo** durante desarrollo
5. **Iterar** según feedback

---

## 📝 Notas Adicionales

- Los bots se pueden desactivar fácilmente cambiando configuración
- Se puede añadir modo "Solo bots" para práctica
- Futuro: Bots podrían tener diferentes "personalidades" (agresivo, defensivo, etc.)
- Futuro: Sistema de aprendizaje para adaptar dificultad automáticamente
