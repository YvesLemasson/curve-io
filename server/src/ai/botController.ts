// Controlador principal de bots IA
// Gestiona creación, eliminación y actualización de bots

import { PlayerManager } from '../game/playerManager.js';
import { GameServer } from '../game/gameServer.js';
import { BotAI } from './botAI.js';
import { generateBotName } from './botNames.js';
import { getRandomColor } from '../utils/colors.js';
import type { GameRoom } from '../matchmaking/matchmakingManager.js';
import type { GameState, Player } from '../shared/types.js';
import type { BotDifficulty } from './botDifficulty.js';
import { logger } from '../utils/logger.js';
import type { GameInputMessage } from '../shared/protocol.js';
import { BOT_DIFFICULTY_CONFIGS } from './botDifficulty.js';

export class BotController {
  private botAIs: Map<string, BotAI> = new Map(); // botId -> BotAI instance
  private botLastDecisionTime: Map<string, number> = new Map(); // botId -> timestamp
  private botCurrentAction: Map<string, 'left' | 'right' | null> = new Map(); // botId -> acción actual
  private botBoostRequested: Map<string, boolean> = new Map(); // botId -> boost solicitado
  private lastGameStatus: Map<string, string> = new Map(); // roomId -> último estado del juego (para detectar cambios de ronda)

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
    logger.log(`🤖 [${room.roomId}] addBotsToRoom llamado: count=${count}, difficulty=${difficulty || 'random'}`);
    
    const existingPlayers = room.playerManager.getAllPlayers();
    const existingBots = existingPlayers.filter(p => p.isBot);
    const slotsAvailable = room.maxPlayers - existingPlayers.length;

    logger.log(`🤖 [${room.roomId}] Estado actual: ${existingPlayers.length} jugadores totales, ${existingBots.length} bots, ${slotsAvailable} slots disponibles`);

    const botsToAdd = Math.min(count, slotsAvailable);

    if (botsToAdd <= 0) {
      logger.log(`⚠️ [${room.roomId}] No se pueden añadir bots - sala llena o sin slots disponibles`);
      return;
    }

    logger.log(`🤖 [${room.roomId}] Añadiendo ${botsToAdd} bots...`);

    // Obtener colores ya en uso
    const usedColors = new Set(existingPlayers.map(p => p.color));

    for (let i = 0; i < botsToAdd; i++) {
      const botDifficulty = difficulty || this.getRandomDifficulty();
      logger.log(`🤖 [${room.roomId}] Creando bot ${i + 1}/${botsToAdd} con dificultad ${botDifficulty}`);
      
      const bot = this.createBot(botDifficulty, room, usedColors);
      
      logger.log(`🤖 [${room.roomId}] Bot creado: ${bot.name} (${bot.id}), color: ${bot.color}, posición: (${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)})`);
      
      // Añadir color usado
      usedColors.add(bot.color);
      
      // Añadir bot al PlayerManager de la sala
      room.playerManager.addPlayer(bot);
      logger.log(`🤖 [${room.roomId}] Bot ${bot.name} añadido al PlayerManager`);
      
      // Crear instancia de IA para este bot
      const botAI = new BotAI(botDifficulty);
      this.botAIs.set(bot.id, botAI);
      this.botLastDecisionTime.set(bot.id, Date.now());
      this.botCurrentAction.set(bot.id, null);
      this.botBoostRequested.set(bot.id, false);
      logger.log(`🤖 [${room.roomId}] IA creada para bot ${bot.name}`);
    }

    const newPlayerCount = room.playerManager.getPlayerCount();
    room.currentPlayers = newPlayerCount;
    logger.log(`✅ [${room.roomId}] ${botsToAdd} bots añadidos exitosamente. Total jugadores: ${room.currentPlayers}/${room.maxPlayers}`);
    
    // Notificar al matchmaking manager que se añadieron bots
    // Esto permite cancelar el timer si ya hay suficientes jugadores
    if (newPlayerCount >= 3) {
      logger.log(`✅ [${room.roomId}] Suficientes jugadores (${newPlayerCount} >= 3), el timer de bots debería cancelarse`);
    }
  }

  /**
   * Crea un bot con propiedades aleatorias
   */
  private createBot(
    difficulty: BotDifficulty,
    room: GameRoom,
    usedColors: Set<string>
  ): Player {
    const botId = `bot_${difficulty}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const botName = generateBotName();
    const botColor = getRandomColor(usedColors);

    // Posición inicial aleatoria (evitar centro donde suelen estar los jugadores)
    // Dimensiones del mapa (deben coincidir con GameServer)
    const MAP_WIDTH = 1920;
    const MAP_HEIGHT = 1280;
    const margin = 100;
    const startX = margin + Math.random() * (MAP_WIDTH - 2 * margin);
    const startY = margin + Math.random() * (MAP_HEIGHT - 2 * margin);
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
      boost: {
        active: false,
        charge: 100,
        remaining: 5000, // 5 segundos disponibles
      },
    };
  }

  /**
   * Actualiza todos los bots en una sala
   * Se llama desde GameServer en cada tick
   */
  updateBots(room: GameRoom, gameState: GameState): void {
    // Detectar cambio de ronda y resetear bots
    const lastStatus = this.lastGameStatus.get(room.roomId);
    if (lastStatus === 'round-ended' && gameState.gameStatus === 'pre-game') {
      // Nueva ronda empezando - resetear estado de bots
      this.resetBotsForNewRound(room);
    }
    this.lastGameStatus.set(room.roomId, gameState.gameStatus);

    // Solo actualizar bots en estados activos
    if (gameState.gameStatus !== 'playing' && gameState.gameStatus !== 'pre-game') {
      return; // No actualizar bots si el juego no está en curso
    }

    const bots = room.playerManager.getAllPlayers().filter(p => p.isBot && p.alive);
    
    // Optimización: salir temprano si no hay bots
    if (bots.length === 0) return;
    
    // Log cada 120 ticks para debugging
    if (gameState.tick % 120 === 0 && bots.length > 0) {
      const botsWithActions = bots.filter(b => {
        const action = this.botCurrentAction.get(b.id);
        return action !== null && action !== undefined;
      }).length;
      logger.log(`🤖 [${room.roomId}] Actualizando ${bots.length} bots (${botsWithActions} con acción, tick: ${gameState.tick}, ronda: ${gameState.currentRound || 1})`);
    }

    const currentTime = Date.now();

    for (const bot of bots) {
      const botAI = this.botAIs.get(bot.id);
      if (!botAI || !bot.botDifficulty) continue;

      const lastDecisionTime = this.botLastDecisionTime.get(bot.id) || 0;
      const botDifficulty = bot.botDifficulty; // Type narrowing
      const config = BOT_DIFFICULTY_CONFIGS[botDifficulty];

      // Verificar si es momento de tomar una nueva decisión
      if (currentTime - lastDecisionTime >= config.decisionInterval) {
        // Calcular nueva acción
        const action = botAI.calculateAction(bot, gameState, botDifficulty);
        
        // Aplicar acción al bot
        this.applyBotAction(room, bot, action);
        
        // Actualizar tiempo de última decisión
        this.botLastDecisionTime.set(bot.id, currentTime);
        this.botCurrentAction.set(bot.id, action.direction);
        this.botBoostRequested.set(bot.id, action.boost || false);
      } else {
        // Continuar con la acción actual - IMPORTANTE: siempre enviar input para mantener movimiento
        const currentAction = this.botCurrentAction.get(bot.id) ?? null;
        const boostRequested = this.botBoostRequested.get(bot.id) || false;
        
        // Enviar input incluso si no hay acción (para mantener el movimiento actual)
        // Esto asegura que el bot siga moviéndose en su dirección actual
        this.applyBotAction(room, bot, {
          direction: currentAction,
          boost: boostRequested,
        });
      }
    }
  }

  /**
   * Aplica una acción a un bot (simula input)
   * Siempre envía input para mantener movimiento continuo
   */
  private applyBotAction(
    room: GameRoom,
    bot: Player,
    action: { direction: 'left' | 'right' | null; boost?: boolean }
  ): void {
    // IMPORTANTE: Siempre enviar input, incluso si direction es null
    // Esto permite que el bot mantenga su dirección actual y siga moviéndose
    // El GameServer procesa inputs continuamente, así que necesitamos enviarlos regularmente
    
    const input: GameInputMessage = {
      playerId: bot.id,
      key: action.direction,
      timestamp: Date.now(),
      boost: action.boost || false,
    };

    // Log cada 200 inputs para no saturar
    if (Math.random() < 0.0025) {
      logger.log(`🤖 [${room.roomId}] Bot ${bot.name} envía input: ${action.direction || 'null'}${action.boost ? ' + boost' : ''}`);
    }

    room.gameServer.addInput(input);
  }

  /**
   * Elimina bots de una sala
   * También limpia estado de tracking de rondas
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
      const bots = room.playerManager.getAllPlayers().filter(p => p.isBot);
      for (const bot of bots) {
        room.playerManager.removePlayer(bot.id);
        this.botAIs.delete(bot.id);
        this.botLastDecisionTime.delete(bot.id);
        this.botCurrentAction.delete(bot.id);
        this.botBoostRequested.delete(bot.id);
      }
    }

    // Limpiar estado de tracking de rondas si no hay más bots
    const remainingBots = room.playerManager.getAllPlayers().filter(p => p.isBot);
    if (remainingBots.length === 0) {
      this.lastGameStatus.delete(room.roomId);
    }

    room.currentPlayers = room.playerManager.getPlayerCount();
  }

  /**
   * Obtiene dificultad aleatoria
   * Por ahora: solo hard (para hacer que funcionen bien primero)
   */
  private getRandomDifficulty(): BotDifficulty {
    return 'hard'; // Solo bots hard por ahora
  }

  /**
   * Resetea el estado de los bots para una nueva ronda
   */
  resetBotsForNewRound(room: GameRoom): void {
    const bots = room.playerManager.getAllPlayers().filter(p => p.isBot);
    
    if (bots.length === 0) return; // Optimización: salir temprano
    
    logger.log(`🔄 [${room.roomId}] Reseteando estado de ${bots.length} bots para nueva ronda`);
    
    const currentTime = Date.now();
    for (const bot of bots) {
      // Resetear tiempos de decisión para que todos los bots tomen decisiones frescas
      // Añadir pequeño offset aleatorio para evitar que todos tomen decisiones al mismo tiempo
      const randomOffset = Math.random() * 50; // 0-50ms de offset
      this.botLastDecisionTime.set(bot.id, currentTime - randomOffset);
      this.botCurrentAction.set(bot.id, null);
      this.botBoostRequested.set(bot.id, false);
    }
    
    logger.log(`✅ [${room.roomId}] Estado de ${bots.length} bots reseteado para nueva ronda`);
  }

  /**
   * Limpia bots de una sala cuando termina
   */
  cleanupRoom(roomId: string): void {
    // Los bots se eliminan automáticamente cuando se elimina la sala
    // Este método puede usarse para limpieza adicional si es necesario
  }
}

