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
  trail: Array<Position | null>; // historial de posiciones, permite null para gaps
  boost?: {
    active: boolean;
    charge: number;
    remaining: number;
  };
}

export interface GameState {
  players: Player[];
  gameStatus: 'waiting' | 'playing' | 'finished' | 'round-ended' | 'ended';
  tick: number;
  winnerId?: string;
  currentRound?: number;
  totalRounds?: number;
  playerPoints?: Record<string, number>; // playerId -> total points
  roundResults?: Array<{
    round: number;
    deathOrder: Array<{ playerId: string; points: number }>;
  }>;
  nextRoundCountdown?: number; // Cuenta atrás en segundos para la siguiente ronda
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

