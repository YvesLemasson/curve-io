// Sistema de logging para bots con throttling para evitar saturar la consola
// MEJORA: Escribe logs en archivo para análisis automático

import { logger } from "../utils/logger.js";
import { writeFile, mkdir } from "fs/promises";
import { mkdirSync } from "fs";
import { join } from "path";
import { existsSync } from "fs";

interface LogThrottle {
  lastLogTime: Map<string, number>;
  logCounts: Map<string, number>;
}

class BotLogger {
  private throttles: LogThrottle = {
    lastLogTime: new Map(),
    logCounts: new Map(),
  };

  private logFilePath: string;
  private logBuffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 2000; // Escribir al archivo cada 2 segundos
  private readonly MAX_BUFFER_SIZE = 100; // Máximo de logs en buffer antes de forzar escritura

  constructor() {
    // Crear ruta al archivo de logs
    const logsDir = join(process.cwd(), "logs");
    this.logFilePath = join(logsDir, "bots.log");

    // Asegurar que el directorio existe (síncrono para evitar problemas de timing)
    if (!existsSync(logsDir)) {
      try {
        mkdirSync(logsDir, { recursive: true });
      } catch (err) {
        console.error("Error creando directorio de logs:", err);
      }
    }

    // Iniciar flush periódico
    this.startFlushInterval();
  }

  /**
   * Inicia el intervalo para escribir logs al archivo periódicamente
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogsToFile();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Escribe los logs del buffer al archivo
   */
  private async flushLogsToFile(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToWrite = this.logBuffer.join("\n") + "\n";
    this.logBuffer = [];

    try {
      await writeFile(this.logFilePath, logsToWrite, { flag: "a" });
    } catch (err) {
      // No bloquear si hay error escribiendo logs
      console.error("Error escribiendo logs de bots:", err);
    }
  }

  /**
   * Añade un log al buffer para escribir al archivo
   */
  private addToFileBuffer(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    this.logBuffer.push(logLine);

    // Si el buffer está lleno, forzar escritura
    if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flushLogsToFile();
    }
  }

  // Intervalos mínimos entre logs del mismo tipo (en ms)
  private readonly THROTTLE_INTERVALS: Record<string, number> = {
    decision: 1000, // Decisiones cada 1 segundo máximo
    collision: 500, // Colisiones cada 500ms máximo
    evasion: 1000, // Evasiones cada 1 segundo máximo
    boost: 2000, // Uso de boost cada 2 segundos máximo
    deadend: 2000, // Dead ends cada 2 segundos máximo
    prediction: 3000, // Predicciones cada 3 segundos máximo
    pathfinding: 2000, // Pathfinding cada 2 segundos máximo
    error: 1000, // Errores cada 1 segundo máximo
  };

  /**
   * Log con throttling - solo muestra si ha pasado el intervalo mínimo
   * MEJORA: También escribe al archivo (sin throttling para archivo)
   */
  private throttledLog(
    key: string,
    message: string,
    force: boolean = false
  ): void {
    const now = Date.now();
    const lastTime = this.throttles.lastLogTime.get(key) || 0;
    const interval = this.THROTTLE_INTERVALS[key] || 1000;

    // SIEMPRE escribir al archivo (sin throttling)
    this.addToFileBuffer(message);

    // Throttling solo para consola
    if (force || now - lastTime >= interval) {
      logger.log(message);
      this.throttles.lastLogTime.set(key, now);
      this.throttles.logCounts.set(
        key,
        (this.throttles.logCounts.get(key) || 0) + 1
      );
    }
  }

  /**
   * Forzar escritura inmediata de logs pendientes
   */
  async flush(): Promise<void> {
    await this.flushLogsToFile();
  }

  /**
   * Limpiar y cerrar el logger
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushLogsToFile();
  }

  /**
   * Log de decisión del bot
   */
  logDecision(
    botName: string,
    direction: "left" | "right" | null,
    reason: string,
    collisionRisk?: { immediate?: boolean; near?: boolean }
  ): void {
    const riskInfo = collisionRisk
      ? ` [${
          collisionRisk.immediate
            ? "INMEDIATA"
            : collisionRisk.near
            ? "CERCA"
            : "SEGURO"
        }]`
      : " [SEGURO]";
    this.throttledLog(
      "decision",
      `🤖 [DECISIÓN] ${botName}: ${direction || "recto"} - ${reason}${riskInfo}`
    );
  }

  /**
   * Log de colisión detectada
   */
  logCollisionDetected(
    botName: string,
    type: "boundary" | "trail" | "self" | "self-trail",
    distance: number
  ): void {
    const typeLabel =
      type === "self-trail"
        ? "self-trail"
        : type === "self"
        ? "self-trail"
        : type === "boundary"
        ? "boundary"
        : "trail";
    this.throttledLog(
      "collision",
      `⚠️ [COLISIÓN] ${botName}: ${typeLabel} detectado a ${distance.toFixed(
        0
      )}px`
    );
  }

  /**
   * Log de evasión
   */
  logEvasion(
    botName: string,
    direction: "left" | "right",
    reason: string
  ): void {
    this.throttledLog(
      "evasion",
      `🔄 [EVASIÓN] ${botName}: girando ${direction} - ${reason}`
    );
  }

  /**
   * Log de uso de boost
   */
  logBoost(botName: string, reason: string, remaining: number): void {
    this.throttledLog(
      "boost",
      `⚡ [BOOST] ${botName}: usando boost - ${reason} (${remaining.toFixed(
        0
      )}ms restantes)`
    );
  }

  /**
   * Log de dead end detectado
   */
  logDeadEnd(botName: string, escapeRoutes: number): void {
    this.throttledLog(
      "deadend",
      `🚫 [DEAD END] ${botName}: área sin salida detectada (${escapeRoutes} rutas disponibles)`
    );
  }

  /**
   * Log de predicción de movimiento
   */
  logPrediction(
    botName: string,
    predictedPlayers: number,
    steps: number
  ): void {
    this.throttledLog(
      "prediction",
      `🔮 [PREDICCIÓN] ${botName}: prediciendo ${predictedPlayers} jugadores (${steps} pasos adelante)`
    );
  }

  /**
   * Log de pathfinding
   */
  logPathfinding(
    botName: string,
    bestPath: "left" | "right" | null,
    score: number
  ): void {
    this.throttledLog(
      "pathfinding",
      `🗺️ [PATHFINDING] ${botName}: mejor ruta ${
        bestPath || "recto"
      } (score: ${score.toFixed(0)})`
    );
  }

  /**
   * Log de error o situación inesperada
   */
  logError(botName: string, error: string): void {
    this.throttledLog(
      "error",
      `❌ [ERROR] ${botName}: ${error}`,
      true // Forzar log de errores
    );
  }

  /**
   * Log de resumen periódico (cada N segundos)
   */
  logSummary(
    botName: string,
    stats: {
      decisions: number;
      collisions: number;
      evasions: number;
      boosts: number;
    }
  ): void {
    const now = Date.now();
    const lastTime = this.throttles.lastLogTime.get("summary") || 0;

    // Resumen cada 10 segundos
    if (now - lastTime >= 10000) {
      logger.log(
        `📊 [RESUMEN] ${botName}: ` +
          `${stats.decisions} decisiones, ` +
          `${stats.collisions} colisiones, ` +
          `${stats.evasions} evasiones, ` +
          `${stats.boosts} boosts`
      );
      this.throttles.lastLogTime.set("summary", now);
    }
  }

  /**
   * Log de evitación de bordes
   */
  logBoundaryAvoidance(
    botName: string,
    closestBoundary: string,
    distance: number,
    position: { x: number; y: number },
    direction: "left" | "right"
  ): void {
    this.throttledLog(
      "boundary",
      `🚧 [BORDE] ${botName}: cerca del borde ${closestBoundary} (${distance.toFixed(
        0
      )}px) en (${position.x.toFixed(0)}, ${position.y.toFixed(
        0
      )}) → girando ${direction}`
    );
  }

  /**
   * Log de cálculo de dirección hacia el centro
   */
  logDirectionCalculation(
    botName: string,
    currentAngle: number,
    angleToCenter: number,
    angleDiff: number,
    direction: "left" | "right"
  ): void {
    this.throttledLog(
      "direction",
      `🧭 [DIRECCIÓN] ${botName}: ángulo actual=${(
        (currentAngle * 180) /
        Math.PI
      ).toFixed(1)}°, hacia centro=${((angleToCenter * 180) / Math.PI).toFixed(
        1
      )}°, diff=${((angleDiff * 180) / Math.PI).toFixed(1)}° → ${direction}`
    );
  }

  /**
   * Reset throttles (útil para debugging)
   */
  reset(): void {
    this.throttles.lastLogTime.clear();
    this.throttles.logCounts.clear();
  }

  /**
   * Obtener estadísticas de logs
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.throttles.logCounts.forEach((count, key) => {
      stats[key] = count;
    });
    return stats;
  }
}

export const botLogger = new BotLogger();
