// Sistema de matchmaking para gestionar múltiples salas de juego
// Cada sala es un Room de Socket.IO con su propio GameServer y PlayerManager

import { PlayerManager } from '../game/playerManager.js';
import { GameServer } from '../game/gameServer.js';
import { GameModel } from '../models/gameModel.js';
import { DeltaCompressor } from '../network/deltaCompression.js';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../shared/protocol.js';
import type { GameState, Player } from '../shared/types.js';
import type { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';

export interface GameRoom {
  roomId: string;           // ID único de la sala (ej: "game_room_abc123")
  gameId: string | null;    // ID de la partida en Supabase
  status: 'waiting' | 'playing' | 'finished';
  playerManager: PlayerManager;
  gameServer: GameServer;
  createdAt: number;        // Timestamp de creación
  startedAt: number | null; // Timestamp de inicio
  maxPlayers: number;       // Máximo de jugadores (8)
  currentPlayers: number;   // Jugadores actuales
  deltaCompressor: DeltaCompressor; // Compresor de delta para esta sala
}

export class MatchmakingManager {
  private rooms: Map<string, GameRoom> = new Map();
  private waitingRooms: Set<string> = new Set(); // Salas en estado 'waiting'
  private io: Server;
  private readonly MAX_PLAYERS = 8;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos
  private readonly ROOM_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutos para salas terminadas
  private onGameEndCallback?: (roomId: string, gameState: any) => Promise<void>;

  constructor(io: Server) {
    this.io = io;
    
    // Iniciar cleanup automático
    this.startCleanupInterval();
  }

  /**
   * Configura el callback que se ejecuta cuando un juego termina
   */
  setOnGameEndCallback(callback: (roomId: string, gameState: any) => Promise<void>): void {
    this.onGameEndCallback = callback;
  }

  /**
   * Busca una sala disponible o crea una nueva
   */
  findOrCreateRoom(): GameRoom {
    // 1. Buscar sala disponible (waiting, < MAX_PLAYERS)
    for (const roomId of this.waitingRooms) {
      const room = this.rooms.get(roomId);
      if (room && room.status === 'waiting' && room.currentPlayers < room.maxPlayers) {
        logger.log(`📋 Sala disponible encontrada: ${roomId} (${room.currentPlayers}/${room.maxPlayers} jugadores)`);
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
    const roomId = `game_room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const playerManager = new PlayerManager();
    const gameServer = new GameServer(playerManager, 1920, 1280);
    const deltaCompressor = new DeltaCompressor();

    const room: GameRoom = {
      roomId,
      gameId: null,
      status: 'waiting',
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
    return room;
  }

  /**
   * Configura los callbacks del game server para una sala
   */
  private setupRoomCallbacks(room: GameRoom): void {
    // Callback de broadcast de estado del juego
    room.gameServer.onBroadcast((gameState: GameState) => {
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
        
        logger.performance(`📦 [${room.roomId}] Delta Compression | Tick: ${gameState.tick} | Full: ${isFullState} | Changes: ${playersWithChanges}/${totalPlayers} | Size: ${deltaSizeKB} KB`);
      }
    });

    // Callback cuando el juego termina
    room.gameServer.onGameEnd(async (gameState: GameState) => {
      // Marcar sala como terminada
      room.status = 'finished';
      this.waitingRooms.delete(room.roomId);
      logger.log(`🔄 [${room.roomId}] Sala marcada como terminada`);
      
      // Llamar al callback externo si está configurado
      if (this.onGameEndCallback) {
        try {
          await this.onGameEndCallback(room.roomId, gameState);
        } catch (error) {
          logger.error(`❌ [${room.roomId}] Error en callback de fin de juego:`, error);
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
      if (roomId.startsWith('game_room_')) {
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
      logger.log(`👥 [${roomId}] Jugadores: ${room.currentPlayers}/${room.maxPlayers}`);
    }
  }

  /**
   * Decrementa el contador de jugadores en una sala
   */
  decrementPlayerCount(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.currentPlayers = Math.max(0, room.currentPlayers - 1);
      logger.log(`👥 [${roomId}] Jugadores: ${room.currentPlayers}/${room.maxPlayers}`);
      
      // Si la sala está vacía y en estado waiting, eliminarla
      if (room.currentPlayers === 0 && room.status === 'waiting') {
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
      room.status = 'playing';
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
      if (room.status === 'finished') {
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
   * Inicia el intervalo de cleanup automático
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupFinishedRooms();
    }, this.CLEANUP_INTERVAL);
    
    logger.log(`🧹 Cleanup automático iniciado (cada ${this.CLEANUP_INTERVAL / 1000}s)`);
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
      if (room.status === 'waiting') waitingRooms++;
      else if (room.status === 'playing') playingRooms++;
      else if (room.status === 'finished') finishedRooms++;
      
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

