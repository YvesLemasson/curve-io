// Sistema de matchmaking para gestionar múltiples salas de juego
// Cada sala es un Room de Socket.IO con su propio GameServer y PlayerManager

import { PlayerManager } from "../game/playerManager.js";
import { GameServer } from "../game/gameServer.js";
import { GameModel } from "../models/gameModel.js";
import { DeltaCompressor } from "../network/deltaCompression.js";
import { SERVER_EVENTS, CLIENT_EVENTS } from "../shared/protocol.js";
import type { GameState, Player } from "../shared/types.js";
import type { Server, Socket } from "socket.io";
import { logger } from "../utils/logger.js";
import { BotController } from "../ai/botController.js";

export interface GameRoom {
  roomId: string; // ID único de la sala (ej: "game_room_abc123")
  gameId: string | null; // ID de la partida en Supabase
  status: "waiting" | "playing" | "finished";
  playerManager: PlayerManager;
  gameServer: GameServer;
  createdAt: number; // Timestamp de creación
  startedAt: number | null; // Timestamp de inicio
  maxPlayers: number; // Máximo de jugadores (8)
  currentPlayers: number; // Jugadores actuales
  deltaCompressor: DeltaCompressor; // Compresor de delta para esta sala
  lobbyCountdownInterval?: NodeJS.Timeout | null; // Intervalo para cuenta atrás del lobby
  lobbyCountdown?: number; // Cuenta atrás actual del lobby en segundos
}

export class MatchmakingManager {
  private rooms: Map<string, GameRoom> = new Map();
  private waitingRooms: Set<string> = new Set(); // Salas en estado 'waiting'
  private io: Server;
  private readonly MAX_PLAYERS = 8;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos
  private readonly ROOM_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutos para salas terminadas
  private onGameEndCallback?: (roomId: string, gameState: any) => Promise<void>;
  private onBotsAddedCallback?: (roomId: string) => void; // Callback cuando se añaden bots
  private botController: BotController;
  private botFillTimers: Map<string, NodeJS.Timeout> = new Map(); // roomId -> timer

  constructor(io: Server) {
    this.io = io;
    this.botController = new BotController();

    // Iniciar cleanup automático
    this.startCleanupInterval();
  }

  /**
   * Configura el callback que se ejecuta cuando se añaden bots
   */
  setOnBotsAddedCallback(callback: (roomId: string) => void): void {
    this.onBotsAddedCallback = callback;
  }

  /**
   * Configura el callback que se ejecuta cuando un juego termina
   */
  setOnGameEndCallback(
    callback: (roomId: string, gameState: any) => Promise<void>
  ): void {
    this.onGameEndCallback = callback;
  }

  /**
   * Busca una sala disponible o crea una nueva
   */
  findOrCreateRoom(): GameRoom {
    // 1. Buscar sala disponible (waiting, < MAX_PLAYERS)
    for (const roomId of this.waitingRooms) {
      const room = this.rooms.get(roomId);
      if (
        room &&
        room.status === "waiting" &&
        room.currentPlayers < room.maxPlayers
      ) {
        logger.log(
          `📋 Sala disponible encontrada: ${roomId} (${room.currentPlayers}/${room.maxPlayers} jugadores)`
        );
        return room;
      }
    }

    // 2. No hay sala disponible, crear nueva
    logger.log(`✨ No hay salas disponibles, creando nueva sala...`);
    return this.createNewRoom();
  }

  /**
   * Crea una nueva sala de juego
   */
  private createNewRoom(): GameRoom {
    const roomId = `game_room_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const playerManager = new PlayerManager();
    const gameServer = new GameServer(playerManager, 1920, 1280);
    const deltaCompressor = new DeltaCompressor();

    const room: GameRoom = {
      roomId,
      gameId: null,
      status: "waiting",
      playerManager,
      gameServer,
      createdAt: Date.now(),
      startedAt: null,
      maxPlayers: this.MAX_PLAYERS,
      currentPlayers: 0,
      deltaCompressor,
    };

    // Configurar callbacks del game server para esta sala
    this.setupRoomCallbacks(room);

    this.rooms.set(roomId, room);
    this.waitingRooms.add(roomId);

    logger.log(`✅ Nueva sala creada: ${roomId}`);

    // NO programar bots automáticamente - solo se añadirán cuando haya jugadores reales
    // Los bots se programarán cuando un jugador real se una a la sala

    return room;
  }

  /**
   * Configura los callbacks del game server para una sala
   */
  private setupRoomCallbacks(room: GameRoom): void {
    // Callback de broadcast de estado del juego
    room.gameServer.onBroadcast((gameState: GameState) => {
      // Actualizar bots antes de comprimir y enviar estado
      this.botController.updateBots(room, gameState);

      const delta = room.deltaCompressor.compress(gameState);

      // Broadcast solo a esta sala
      this.io.to(room.roomId).emit(SERVER_EVENTS.GAME_STATE, {
        delta,
        serverTime: Date.now(),
      });

      // Log cada 60 ticks para monitorear
      if (gameState.tick % 60 === 0) {
        const isFullState = delta.fullState || false;
        const playersWithChanges = delta.players.length;
        const totalPlayers = gameState.players.length;
        const deltaSize = JSON.stringify(delta).length;
        const deltaSizeKB = (deltaSize / 1024).toFixed(2);

        logger.performance(
          `📦 [${room.roomId}] Delta Compression | Tick: ${gameState.tick} | Full: ${isFullState} | Changes: ${playersWithChanges}/${totalPlayers} | Size: ${deltaSizeKB} KB`
        );
      }
    });

    // Callback cuando el juego termina
    room.gameServer.onGameEnd(async (gameState: GameState) => {
      // Marcar sala como terminada
      room.status = "finished";
      this.waitingRooms.delete(room.roomId);
      logger.log(`🔄 [${room.roomId}] Sala marcada como terminada`);

      // Llamar al callback externo si está configurado
      if (this.onGameEndCallback) {
        try {
          await this.onGameEndCallback(room.roomId, gameState);
        } catch (error) {
          logger.error(
            `❌ [${room.roomId}] Error en callback de fin de juego:`,
            error
          );
        }
      }
    });
  }

  /**
   * Obtiene una sala por su ID
   */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Obtiene la sala de un socket
   */
  getRoomFromSocket(socket: Socket): GameRoom | undefined {
    const rooms = Array.from(socket.rooms);
    for (const roomId of rooms) {
      if (roomId.startsWith("game_room_")) {
        return this.getRoom(roomId);
      }
    }
    return undefined;
  }

  /**
   * Incrementa el contador de jugadores en una sala
   */
  incrementPlayerCount(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.currentPlayers++;
      logger.log(
        `👥 [${roomId}] Jugadores: ${room.currentPlayers}/${room.maxPlayers}`
      );

      // Cancelar timer de bots si hay suficientes jugadores
      if (room.currentPlayers >= 8) {
        logger.log(
          `❌ [${roomId}] Cancelando timer de bots - suficientes jugadores (${room.currentPlayers} >= 8)`
        );
        this.cancelBotFillTimer(roomId);
      }

      // Solo programar bots si hay al menos dos jugadores reales y menos de 8 jugadores totales
      const realPlayerCount = this.getRealPlayerCount(room);
      if (
        realPlayerCount >= 2 &&
        room.currentPlayers < 8 &&
        room.status === "waiting"
      ) {
        logger.log(
          `⏰ [${roomId}] Programando rellenado de bots (${realPlayerCount} jugador(es) real(es), ${room.currentPlayers} < 8 jugadores totales, status: ${room.status})`
        );
        this.scheduleBotFill(roomId);
      } else {
        logger.log(
          `⏸️  [${roomId}] No se programa rellenado de bots (jugadores reales: ${realPlayerCount}, totales: ${room.currentPlayers}, status: ${room.status}) - se requieren al menos 2 jugadores humanos`
        );
      }
    } else {
      logger.error(
        `❌ [${roomId}] No se encontró la sala al incrementar contador`
      );
    }
  }

  /**
   * Decrementa el contador de jugadores en una sala
   */
  decrementPlayerCount(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.currentPlayers = Math.max(0, room.currentPlayers - 1);
      logger.log(
        `👥 [${roomId}] Jugadores: ${room.currentPlayers}/${room.maxPlayers}`
      );

      // Verificar si quedan jugadores reales
      const realPlayerCount = this.getRealPlayerCount(room);

      // Si no quedan jugadores reales, eliminar todos los bots y cancelar timers
      if (realPlayerCount === 0) {
        logger.log(
          `🤖 [${roomId}] No quedan jugadores reales, eliminando bots y cancelando timers...`
        );
        this.botController.removeBotsFromRoom(room);
        this.cancelBotFillTimer(roomId);

        // Actualizar contador de jugadores después de eliminar bots
        room.currentPlayers = room.playerManager.getPlayerCount();
      }

      // Si la sala está vacía y en estado waiting, eliminarla
      if (room.currentPlayers === 0 && room.status === "waiting") {
        logger.log(`🗑️  [${roomId}] Sala vacía, eliminando...`);
        this.removeRoom(roomId);
      }
    }
  }

  /**
   * Marca una sala como iniciada (playing)
   */
  startRoom(roomId: string, gameId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = "playing";
      room.gameId = gameId;
      room.startedAt = Date.now();
      this.waitingRooms.delete(roomId);
      logger.log(`🚀 [${roomId}] Sala iniciada con partida ${gameId}`);
    }
  }

  /**
   * Limpia salas terminadas que han expirado
   */
  cleanupFinishedRooms(): void {
    const now = Date.now();
    const roomsToRemove: string[] = [];

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.status === "finished") {
        const timeSinceFinished = now - (room.startedAt || room.createdAt);
        if (timeSinceFinished > this.ROOM_EXPIRY_TIME) {
          roomsToRemove.push(roomId);
        }
      }
    }

    for (const roomId of roomsToRemove) {
      logger.log(`🧹 Limpiando sala expirada: ${roomId}`);
      this.removeRoom(roomId);
    }

    if (roomsToRemove.length > 0) {
      logger.log(`✅ ${roomsToRemove.length} sala(s) limpiada(s)`);
    }
  }

  /**
   * Elimina una sala y limpia sus recursos
   */
  private removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      // Limpiar bots de la sala
      this.botController.removeBotsFromRoom(room);

      // Cancelar timer de bots
      this.cancelBotFillTimer(roomId);

      // Detener el game server si está corriendo
      room.gameServer.stop();

      // Limpiar recursos
      room.playerManager.clear();
      room.deltaCompressor.reset();

      // Remover de mapas
      this.rooms.delete(roomId);
      this.waitingRooms.delete(roomId);

      logger.log(`🗑️  Sala ${roomId} eliminada y recursos limpiados`);
    }
  }

  /**
   * Obtiene el número de jugadores reales (no bots) en una sala
   */
  private getRealPlayerCount(room: GameRoom): number {
    return room.playerManager.getAllPlayers().filter((p) => {
      // Verificar si es bot de forma segura (isBot es opcional en Player)
      return !(p as any).isBot;
    }).length;
  }

  /**
   * Programa el rellenado de bots después de ~5 segundos (con variabilidad)
   * Añade bots continuamente cada ~5 segundos hasta llegar a 8 jugadores
   * Solo se ejecuta si hay al menos dos jugadores reales en la sala
   */
  private scheduleBotFill(roomId: string): void {
    // Cancelar timer existente si hay uno
    this.cancelBotFillTimer(roomId);

    // Calcular tiempo con variabilidad: 5 segundos ± 2.5 segundos (rango: 2.5s - 7.5s)
    // Usando distribución uniforme para variabilidad media
    const baseDelay = 5000; // 5 segundos base
    const variability = 2500; // ±2.5 segundos de variabilidad
    const delay = baseDelay + (Math.random() * 2 - 1) * variability; // Rango: 2500ms - 7500ms
    const delaySeconds = (delay / 1000).toFixed(1);

    logger.log(
      `⏰ [${roomId}] Timer de rellenado de bots programado (${delaySeconds} segundos)`
    );

    const timer = setTimeout(() => {
      logger.log(`⏰ [${roomId}] Timer de rellenado de bots ejecutado`);
      const room = this.rooms.get(roomId);

      if (!room) {
        logger.error(
          `❌ [${roomId}] Sala no encontrada al ejecutar timer de bots`
        );
        this.botFillTimers.delete(roomId);
        return;
      }

      if (room.status !== "waiting") {
        logger.log(
          `⏸️  [${roomId}] Sala no está en estado 'waiting' (status: ${room.status}), cancelando rellenado de bots`
        );
        this.botFillTimers.delete(roomId);
        return;
      }

      // Verificar si hay al menos 2 jugadores reales - si no hay suficientes, no añadir bots
      const realPlayerCount = this.getRealPlayerCount(room);
      if (realPlayerCount < 2) {
        logger.log(
          `⏸️  [${roomId}] No hay suficientes jugadores reales en la sala (${realPlayerCount} < 2), cancelando rellenado de bots`
        );
        this.botFillTimers.delete(roomId);
        return;
      }

      const currentPlayers = room.playerManager.getPlayerCount();

      // Añadir solo 1 bot a la vez hasta llegar a 8 jugadores
      const botsNeeded = Math.min(
        1, // Añadir 1 bot por vez
        8 - currentPlayers, // Hasta llegar a 8 jugadores
        room.maxPlayers - currentPlayers // No exceder el máximo de la sala
      );

      logger.log(
        `🤖 [${roomId}] Evaluando rellenado: ${currentPlayers} jugadores actuales, ${botsNeeded} bots necesarios`
      );

      if (botsNeeded > 0) {
        logger.log(`🤖 [${roomId}] Añadiendo ${botsNeeded} bot(s)...`);
        this.botController.addBotsToRoom(room, botsNeeded);

        // Verificar si ahora hay suficientes jugadores después de añadir bots
        const playersAfterBots = room.playerManager.getPlayerCount();
        room.currentPlayers = playersAfterBots;

        logger.log(
          `✅ [${roomId}] ${botsNeeded} bot(s) añadido(s) exitosamente. Total: ${playersAfterBots} jugadores`
        );

        // Si ahora hay suficientes jugadores, cancelar cualquier timer pendiente
        if (playersAfterBots >= 8) {
          logger.log(
            `✅ [${roomId}] Suficientes jugadores después de añadir bots (${playersAfterBots} >= 8), cancelando timers`
          );
          this.cancelBotFillTimer(roomId);
        } else {
          // Verificar si aún hay al menos 2 jugadores reales antes de programar siguiente rellenado
          const realPlayerCount = this.getRealPlayerCount(room);
          if (realPlayerCount >= 2) {
            // Si aún no hay 8 jugadores y hay suficientes jugadores reales, programar otro rellenado
            logger.log(
              `🔄 [${roomId}] Aún faltan jugadores (${playersAfterBots} < 8, ${realPlayerCount} jugador(es) real(es)), programando siguiente rellenado...`
            );
            this.scheduleBotFill(roomId);
          } else {
            logger.log(
              `⏸️  [${roomId}] No hay suficientes jugadores reales (${realPlayerCount} < 2), cancelando rellenado de bots`
            );
            this.cancelBotFillTimer(roomId);
          }
        }

        // Notificar a clientes que se añadieron bots
        if (this.onBotsAddedCallback) {
          logger.log(`📢 [${roomId}] Ejecutando callback de bots añadidos`);
          this.onBotsAddedCallback(roomId);
        } else {
          logger.warn(
            `⚠️  [${roomId}] No hay callback configurado para notificar bots añadidos`
          );
        }
      } else {
        logger.log(
          `⏸️  [${roomId}] No se necesitan bots (${currentPlayers} jugadores, ${room.maxPlayers} máximo)`
        );
        // Si no se necesitan bots pero aún no hay 8 jugadores y hay suficientes jugadores reales, programar otro intento
        const realPlayerCount = this.getRealPlayerCount(room);
        if (
          currentPlayers < 8 &&
          room.status === "waiting" &&
          realPlayerCount >= 2
        ) {
          this.scheduleBotFill(roomId);
        } else if (realPlayerCount < 2) {
          logger.log(
            `⏸️  [${roomId}] No hay suficientes jugadores reales (${realPlayerCount} < 2), cancelando rellenado de bots`
          );
          this.cancelBotFillTimer(roomId);
        }
      }

      this.botFillTimers.delete(roomId);
    }, delay);

    this.botFillTimers.set(roomId, timer);
    logger.log(
      `✅ [${roomId}] Timer configurado, se ejecutará en ${delaySeconds} segundos`
    );
  }

  /**
   * Cancela el timer de rellenado de bots
   */
  private cancelBotFillTimer(roomId: string): void {
    const timer = this.botFillTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.botFillTimers.delete(roomId);
      logger.log(`❌ [${roomId}] Timer de rellenado de bots cancelado`);
    }
  }

  /**
   * Inicia el intervalo de cleanup automático
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupFinishedRooms();
    }, this.CLEANUP_INTERVAL);

    logger.log(
      `🧹 Cleanup automático iniciado (cada ${this.CLEANUP_INTERVAL / 1000}s)`
    );
  }

  /**
   * Obtiene estadísticas de las salas
   */
  getStats(): {
    totalRooms: number;
    waitingRooms: number;
    playingRooms: number;
    finishedRooms: number;
    totalPlayers: number;
  } {
    let waitingRooms = 0;
    let playingRooms = 0;
    let finishedRooms = 0;
    let totalPlayers = 0;

    for (const room of this.rooms.values()) {
      if (room.status === "waiting") waitingRooms++;
      else if (room.status === "playing") playingRooms++;
      else if (room.status === "finished") finishedRooms++;

      totalPlayers += room.currentPlayers;
    }

    return {
      totalRooms: this.rooms.size,
      waitingRooms,
      playingRooms,
      finishedRooms,
      totalPlayers,
    };
  }
}
