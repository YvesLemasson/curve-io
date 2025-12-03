// Configuración de dificultades para bots IA

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotDifficultyConfig {
  reactionTime: number;        // ms - tiempo de reacción
  decisionInterval: number;    // ms - cada cuánto toma decisiones
  errorRate: number;           // 0-1 - probabilidad de error
  boostUsage: number;          // 0-1 - agresividad en uso de boost
  avoidanceDistance: number;   // píxeles - distancia mínima para evitar colisiones
  predictionAccuracy: number;  // 0-1 - precisión al predecir movimientos
}

export const BOT_DIFFICULTY_CONFIGS: Record<BotDifficulty, BotDifficultyConfig> = {
  easy: {
    reactionTime: 200,         // Reacciona más rápido
    decisionInterval: 100,      // Decide cada 100ms (más frecuente)
    errorRate: 0.12,            // 12% de errores (reducido)
    boostUsage: 0.4,            // Usa boost más frecuentemente
    avoidanceDistance: 120,    // Evita colisiones desde más lejos
    predictionAccuracy: 0.6,    // Predicción mejorada
  },
  medium: {
    reactionTime: 100,
    decisionInterval: 50,      // Decide cada 50ms (más frecuente)
    errorRate: 0.05,
    boostUsage: 0.6,
    avoidanceDistance: 100,     // Mayor distancia de evasión
    predictionAccuracy: 0.8,
  },
  hard: {
    reactionTime: 20,          // Reacciona muy rápido
    decisionInterval: 16,      // Decide cada ~16ms (casi cada frame a 60fps)
    errorRate: 0.005,          // Casi sin errores (0.5%)
    boostUsage: 0.85,          // Usa boost agresivamente
    avoidanceDistance: 200,    // Evita colisiones desde muy lejos (200px)
    predictionAccuracy: 0.98,  // Predicción muy precisa
  },
};

