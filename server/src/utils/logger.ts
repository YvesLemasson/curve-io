// Sistema de logging condicional para el servidor
// NO muestra logs en producción para mejorar rendimiento

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_PERFORMANCE = process.env.LOG_PERFORMANCE === 'true';
const DEBUG = NODE_ENV === 'development';

/**
 * Logger optimizado que NO ejecuta logs en producción
 * En producción, todas las funciones son no-ops (0ms de overhead)
 * 
 * IMPORTANTE: En producción, NO se mostrarán logs, ni siquiera errores.
 * Si necesitas ver errores en producción, configura LOG_ERRORS=true
 */
const LOG_ERRORS = process.env.LOG_ERRORS === 'true';

export const logger = {
  /**
   * Log general - NO en producción
   */
  log: (...args: any[]): void => {
    if (DEBUG) {
      console.log(...args);
    }
    // En producción: no-op (no hace nada)
  },

  /**
   * Warning - NO en producción
   */
  warn: (...args: any[]): void => {
    if (DEBUG) {
      console.warn(...args);
    }
    // En producción: no-op (no hace nada)
  },

  /**
   * Error - NO en producción por defecto
   * Solo se muestra si LOG_ERRORS=true (para debugging crítico)
   */
  error: (...args: any[]): void => {
    if (DEBUG || LOG_ERRORS) {
      console.error(...args);
    }
    // En producción sin LOG_ERRORS: no-op (no hace nada)
  },

  /**
   * Performance logs - solo si LOG_PERFORMANCE=true
   * Útil para debugging de rendimiento sin saturar logs normales
   */
  performance: (...args: any[]): void => {
    if (LOG_PERFORMANCE) {
      console.log('[PERF]', ...args);
    }
    // En producción sin LOG_PERFORMANCE: no-op (no hace nada)
  },

  /**
   * Info - NO en producción
   */
  info: (...args: any[]): void => {
    if (DEBUG) {
      console.info(...args);
    }
    // En producción: no-op (no hace nada)
  },
};

