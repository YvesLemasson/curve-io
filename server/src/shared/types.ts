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
  trailType?: TrailType;  // Tipo de trail premium
  trailEffect?: TrailEffectConfig;  // Configuración del efecto
  boost?: {
    active: boolean;
    charge: number;
    remaining: number;
  };
}

// Tipos de trails premium
export type TrailType = 
  | 'normal'           // Trail básico (gratis)
  | 'particles'        // Partículas brillantes (efecto sencillo inicial)
  | 'fire';            // Estela de fuego con gradiente rojo-naranja-amarillo

// Configuración de efectos de trail
export interface TrailEffectConfig {
  particleCount?: number;         // Para efectos de partículas (espaciado en píxeles)
  particleSize?: number;
  trailColor?: string;            // Color del trail base (por defecto blanco)
  animationSpeed?: number;
  opacity?: number;                // Para efecto ghost
  gradientColors?: string[];       // Para degradados
  glowIntensity?: number;          // Para efectos neón
}

export interface GameState {
  players: Player[];
  gameStatus: 'waiting' | 'pre-game' | 'playing' | 'round-ended' | 'ended';
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
  preGameCountdown?: number; // Cuenta atrás en segundos para el inicio del juego (3 segundos)
}
