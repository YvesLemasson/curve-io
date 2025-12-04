// Configuración de dificultades para bots IA

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotDifficultyConfig {
  reactionTime: number; // ms - tiempo de reacción
  decisionInterval: number; // ms - cada cuánto toma decisiones
  errorRate: number; // 0-1 - probabilidad de error
  boostUsage: number; // 0-1 - agresividad en uso de boost
  avoidanceDistance: number; // píxeles - distancia mínima para evitar colisiones
  predictionAccuracy: number; // 0-1 - precisión al predecir movimientos
}

export const BOT_DIFFICULTY_CONFIGS: Record<
  BotDifficulty,
  BotDifficultyConfig
> = {
  easy: {
    reactionTime: 133, // Ajustado para velocidad 50% mayor (200 * 2/3 ≈ 133ms)
    decisionInterval: 67, // Ajustado para velocidad 50% mayor (100 * 2/3 ≈ 67ms)
    errorRate: 0.12, // 12% de errores (reducido)
    boostUsage: 0.4, // Usa boost más frecuentemente
    avoidanceDistance: 120, // Evita colisiones desde más lejos
    predictionAccuracy: 0.6, // Predicción mejorada
  },
  medium: {
    reactionTime: 67, // Ajustado para velocidad 50% mayor (100 * 2/3 ≈ 67ms)
    decisionInterval: 33, // Ajustado para velocidad 50% mayor (50 * 2/3 ≈ 33ms)
    errorRate: 0.05,
    boostUsage: 0.6,
    avoidanceDistance: 100, // Mayor distancia de evasión
    predictionAccuracy: 0.8,
  },
  hard: {
    reactionTime: 13, // Ajustado para velocidad 50% mayor (20 * 2/3 ≈ 13ms)
    decisionInterval: 11, // Ajustado para velocidad 50% mayor (16 * 2/3 ≈ 11ms)
    errorRate: 0.005, // Casi sin errores (0.5%)
    boostUsage: 0.85, // Usa boost agresivamente
    avoidanceDistance: 200, // Evita colisiones desde muy lejos (200px)
    predictionAccuracy: 0.98, // Predicción muy precisa
  },
};
