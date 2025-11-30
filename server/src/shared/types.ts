// Tipos compartidos del juego

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
  trail: Array<Position | null>; // historial de posiciones, permite null para huecos
  boost?: {
    active: boolean;
    charge: number;
    remaining: number;
  };
}

export interface GameState {
  players: Player[];
  gameStatus: 'waiting' | 'playing' | 'ended';
  tick: number;
  winnerId?: string;
  currentRound?: number;
  totalRounds?: number;
  playerPoints?: Record<string, number>; // playerId -> total points
  roundResults?: Array<{
    round: number;
    deathOrder: Array<{ playerId: string; points: number }>;
  }>;
}
