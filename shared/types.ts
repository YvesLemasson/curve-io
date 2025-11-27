// Tipos compartidos entre cliente y servidor

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  position: Position;
  angle: number; // en radianes
  speed: number;
  alive: boolean;
  trail: Position[]; // historial de posiciones
}

export interface GameState {
  players: Player[];
  gameStatus: 'waiting' | 'playing' | 'finished';
  tick: number;
  winnerId?: string;
}

export interface Input {
  playerId: string;
  key: 'left' | 'right';
  timestamp: number;
}

export interface Collision {
  type: 'trail' | 'boundary' | 'self';
  playerId: string;
  position?: Position;
}

export interface Room {
  id: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
}

