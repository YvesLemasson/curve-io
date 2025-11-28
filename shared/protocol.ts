// Protocolo de comunicación WebSocket

// Eventos del cliente al servidor
export const CLIENT_EVENTS = {
  PLAYER_JOIN: 'player:join',
  GAME_INPUT: 'game:input',
  DISCONNECT: 'disconnect',
  REQUEST_START: 'game:request-start',
  CHANGE_COLOR: 'player:change-color',
} as const;

// Eventos del servidor al cliente
export const SERVER_EVENTS = {
  PLAYER_JOINED: 'player:joined',
  GAME_STATE: 'game:state',
  GAME_START: 'game:start',
  GAME_END: 'game:end',
  PLAYER_DEAD: 'player:dead',
  ERROR: 'error',
  LOBBY_PLAYERS: 'lobby:players',
} as const;

// Tipos de mensajes
export interface PlayerJoinMessage {
  playerId: string;
  name: string;
}

export interface GameInputMessage {
  playerId: string;
  key: 'left' | 'right' | null;
  boost: boolean; // Si el jugador está presionando ambas teclas para boost
  timestamp: number;
}

// Delta State para compresión (solo cambios)
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
  fullState?: boolean; // Si es true, es estado completo (primera vez o resync)
}

export interface GameStateMessage {
  gameState?: import('./types').GameState; // Mantener para compatibilidad
  delta?: DeltaState; // Delta comprimido (preferido)
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

export interface LobbyPlayersMessage {
  players: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface ChangeColorMessage {
  playerId: string;
  color: string;
}

