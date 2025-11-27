// Protocolo de comunicación WebSocket

// Eventos del cliente al servidor
export const CLIENT_EVENTS = {
  PLAYER_JOIN: 'player:join',
  GAME_INPUT: 'game:input',
  DISCONNECT: 'disconnect',
} as const;

// Eventos del servidor al cliente
export const SERVER_EVENTS = {
  PLAYER_JOINED: 'player:joined',
  GAME_STATE: 'game:state',
  GAME_START: 'game:start',
  GAME_END: 'game:end',
  PLAYER_DEAD: 'player:dead',
  ERROR: 'error',
} as const;

// Tipos de mensajes
export interface PlayerJoinMessage {
  playerId: string;
  name: string;
}

export interface GameInputMessage {
  playerId: string;
  key: 'left' | 'right';
  timestamp: number;
}

export interface GameStateMessage {
  gameState: import('./types').GameState;
  serverTime: number;
}

export interface PlayerDeadMessage {
  playerId: string;
  reason: string;
}

export interface GameEndMessage {
  winnerId: string;
  winnerName: string;
}

