// Cliente de red para comunicación con el servidor
// Maneja conexión WebSocket y envío/recepción de mensajes

import { io, Socket } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS, type GameStateMessage, type PlayerJoinMessage, type LobbyPlayersMessage } from '@shared/protocol';
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
  private onGameStateMessageCallback?: (message: GameStateMessage) => void; // Para delta compression
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: string) => void;
  private onPlayerJoinedCallback?: (data: { playerId: string; socketId: string }) => void;
  private onLobbyPlayersCallback?: (data: LobbyPlayersMessage) => void;
  private onGameStartCallback?: () => void;

  constructor(serverUrl?: string) {
    // Usar variable de entorno en producción, o el parámetro, o localhost por defecto
    this.serverUrl = serverUrl || import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  }

  /**
   * Conecta al servidor
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('[NetworkClient] Ya conectado al servidor');
      return;
    }

    console.log(`[NetworkClient] Conectando a ${this.serverUrl}...`);
    console.log(`[NetworkClient] URL del servidor: ${this.serverUrl}`);
    console.log(`[NetworkClient] Variable de entorno VITE_SERVER_URL: ${import.meta.env.VITE_SERVER_URL || 'no definida'}`);

    this.socket = io(this.serverUrl, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      transports: ['polling', 'websocket'], // Intentar polling primero, luego websocket
      timeout: 5000, // Timeout de 5 segundos
    });

    this.setupEventListeners();
  }

  /**
   * Configura los event listeners del socket
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    const lobbyPlayersEvent = SERVER_EVENTS?.LOBBY_PLAYERS || 'lobby:players';

    this.socket.on(lobbyPlayersEvent, (data: LobbyPlayersMessage) => {
      if (this.onLobbyPlayersCallback) {
        this.onLobbyPlayersCallback(data);
      }
    });

    this.socket.on(SERVER_EVENTS?.GAME_START || 'game:start', () => {
      if (this.onGameStartCallback) {
        this.onGameStartCallback();
      }
    });

    this.socket.on('connect', () => {
      console.log('[NetworkClient] ✅ Conectado al servidor exitosamente');
      console.log(`[NetworkClient] Socket ID: ${this.socket?.id}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[NetworkClient] ❌ Desconectado del servidor. Razón: ${reason}`);
      this.isConnected = false;
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      const errorMessage = error.message || 'Error desconocido';
      const errorType = (error as any).type || '';
      const errorDescription = (error as any).description || '';
      
      console.error(`[NetworkClient] ❌ Error de conexión (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, errorMessage);
      console.error(`[NetworkClient] Tipo de error:`, errorType);
      console.error(`[NetworkClient] Descripción:`, errorDescription);
      console.error(`[NetworkClient] Detalles completos:`, error);
      
      // Detectar específicamente ERR_CONNECTION_REFUSED
      const isConnectionRefused = 
        errorMessage.includes('ERR_CONNECTION_REFUSED') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('xhr poll error') ||
        errorType === 'TransportError';
      
      // Mensaje más específico según el tipo de error
      let userMessage = errorMessage;
      if (isConnectionRefused) {
        userMessage = `❌ No se pudo conectar al servidor en ${this.serverUrl}`;
        console.error(`[NetworkClient] ⚠️  ==========================================`);
        console.error(`[NetworkClient] ⚠️  EL SERVIDOR NO ESTÁ CORRIENDO`);
        console.error(`[NetworkClient] ⚠️  ==========================================`);
        console.error(`[NetworkClient] 💡 Para iniciar el servidor, ejecuta en una terminal:`);
        console.error(`[NetworkClient] 💡   cd server`);
        console.error(`[NetworkClient] 💡   npm run dev`);
        console.error(`[NetworkClient] 💡 El servidor debería iniciar en el puerto 3001`);
        console.error(`[NetworkClient] ⚠️  ==========================================`);
      } else if (errorMessage.includes('timeout')) {
        userMessage = `⏱️ Timeout al conectar al servidor. El servidor puede estar sobrecargado o no disponible.`;
      } else if (errorMessage.includes('CORS')) {
        userMessage = `🚫 Error de CORS. Verifica la configuración del servidor.`;
      }
      
      if (this.onErrorCallback) {
        this.onErrorCallback(userMessage);
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[NetworkClient] 🔄 Intentando reconectar... (${attemptNumber}/${this.maxReconnectAttempts})`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error(`[NetworkClient] ❌ Falló la reconexión después de ${this.maxReconnectAttempts} intentos`);
      if (this.onErrorCallback) {
        this.onErrorCallback(`No se pudo conectar al servidor después de ${this.maxReconnectAttempts} intentos. Verifica que el servidor esté corriendo.`);
      }
    });

    // Eventos del servidor
    // FASE 2: Delta Compression - Pasar mensaje completo (puede contener delta o gameState)
    this.socket.on(SERVER_EVENTS.GAME_STATE, (message: GameStateMessage) => {
      // Si hay callback para mensaje completo (delta), usarlo primero
      if (this.onGameStateMessageCallback) {
        this.onGameStateMessageCallback(message);
      }
      // Mantener compatibilidad: si hay gameState completo, también llamar al callback antiguo
      if (message.gameState && this.onGameStateCallback) {
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
   * Callback para recibir mensaje completo del juego (incluye delta)
   * FASE 2: Delta Compression
   */
  onGameStateMessage(callback: (message: GameStateMessage) => void): void {
    this.onGameStateMessageCallback = callback;
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

  /**
   * Callback para recibir lista de jugadores en el lobby
   */
  onLobbyPlayers(callback: (data: LobbyPlayersMessage) => void): void {
    this.onLobbyPlayersCallback = callback;
  }

  /**
   * Callback para cuando el juego inicia
   */
  onGameStart(callback: () => void): void {
    this.onGameStartCallback = callback;
  }

  /**
   * Solicita al servidor iniciar el juego
   */
  requestStartGame(): void {
    if (!this.socket || !this.isConnected) {
      console.warn('No conectado al servidor, no se puede solicitar inicio del juego');
      return;
    }

    const eventName = CLIENT_EVENTS?.REQUEST_START || 'game:request-start';
    this.socket.emit(eventName);
  }

  /**
   * Solicita cambiar el color del jugador
   */
  changeColor(playerId: string, color: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('No conectado al servidor, no se puede cambiar el color');
      return;
    }

    const eventName = CLIENT_EVENTS?.CHANGE_COLOR || 'player:change-color';
    this.socket.emit(eventName, { playerId, color });
  }

  /**
   * Envía el user_id de Supabase al servidor para autenticación
   */
  sendAuthUser(userId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('No conectado al servidor, no se puede enviar auth');
      return;
    }

    const eventName = CLIENT_EVENTS?.AUTH_USER || 'auth:user';
    this.socket.emit(eventName, { userId });
  }
}

