// Cliente de red para comunicación con el servidor
// Maneja conexión WebSocket y envío/recepción de mensajes

import { io, Socket } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS, type GameStateMessage, type PlayerJoinMessage } from '@shared/protocol';
import type { GameState } from '@shared/types';

export class NetworkClient {
  private socket: Socket | null = null;
  private serverUrl: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // ms

  // Callbacks
  private onGameStateCallback?: (gameState: GameState) => void;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: string) => void;
  private onPlayerJoinedCallback?: (data: { playerId: string; socketId: string }) => void;

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  /**
   * Conecta al servidor
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('Ya conectado al servidor');
      return;
    }

    console.log(`Conectando a ${this.serverUrl}...`);

    this.socket = io(this.serverUrl, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  /**
   * Configura los event listeners del socket
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(`✅ Conectado al servidor | Socket ID: ${this.socket?.id}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado del servidor:', reason);
      this.isConnected = false;
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Error de conexión:', error.message);
      this.reconnectAttempts++;
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message);
      }
    });

    // Eventos del servidor
    this.socket.on(SERVER_EVENTS.GAME_STATE, (message: GameStateMessage) => {
      if (this.onGameStateCallback) {
        this.onGameStateCallback(message.gameState);
      }
    });

    this.socket.on(SERVER_EVENTS.PLAYER_JOINED, (data: { playerId: string; socketId: string }) => {
      if (this.onPlayerJoinedCallback) {
        this.onPlayerJoinedCallback(data);
      }
    });

    this.socket.on(SERVER_EVENTS.ERROR, (error: string) => {
      console.error('Error del servidor:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    });
  }

  /**
   * Desconecta del servidor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Envía un input al servidor
   */
  sendInput(playerId: string, key: 'left' | 'right' | null, boost: boolean, timestamp: number = Date.now()): void {
    if (!this.socket || !this.isConnected) {
      console.warn('No conectado al servidor, no se puede enviar input');
      return;
    }

    this.socket.emit(CLIENT_EVENTS.GAME_INPUT, {
      playerId,
      key,
      boost,
      timestamp,
    });
  }

  /**
   * Envía solicitud de unión al juego
   */
  joinGame(playerId: string, name: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('No conectado al servidor, no se puede unir al juego');
      return;
    }

    this.socket.emit(CLIENT_EVENTS.PLAYER_JOIN, {
      playerId,
      name,
    } as PlayerJoinMessage);
  }

  /**
   * Callback para recibir estado del juego
   */
  onGameState(callback: (gameState: GameState) => void): void {
    this.onGameStateCallback = callback;
  }

  /**
   * Callback para cuando se conecta
   */
  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  /**
   * Callback para cuando se desconecta
   */
  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  /**
   * Callback para errores
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Verifica si está conectado
   */
  getIsConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Obtiene el ID del socket
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Callback para cuando el servidor confirma la unión del jugador
   */
  onPlayerJoined(callback: (data: { playerId: string; socketId: string }) => void): void {
    this.onPlayerJoinedCallback = callback;
  }
}

