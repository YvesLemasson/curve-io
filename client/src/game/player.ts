// Lógica del jugador
// Maneja posición, movimiento, rotación y trail

import type { Position, TrailType, TrailEffectConfig } from "@shared/types";

export class Player {
  public id: string;
  public name: string;
  public color: string;
  public position: Position;
  public angle: number; // en radianes
  public speed: number;
  public alive: boolean;
  public trail: Array<Position | null>; // Permite null para gaps
  public trailType: TrailType = "normal"; // Tipo de trail premium (normal por defecto)
  public trailEffect?: TrailEffectConfig; // Configuración del efecto (solo si se equipa un trail premium)

  // Sistema de huecos en el trail
  private trailTimer: number = 0; // Tiempo acumulado desde el inicio
  private readonly gapInterval: number = 3000; // 3 segundos en ms
  private readonly gapDuration: number = 500; // 0.5 segundos en ms
  private shouldDrawTrail: boolean = true;
  private wasDrawingTrail: boolean = true; // Estado anterior para detectar cambios

  // Sistema de boost
  private boostActive: boolean = false;
  private boostRemaining: number = 0; // Tiempo restante de boost en ms
  private boostCharge: number = 100; // Carga del boost (0-100)
  private readonly boostDuration: number = 5000; // 5 segundos en ms
  private readonly boostSpeedMultiplier: number = 1.5; // 50% más rápido

  // EXPERIMENTO: Sin límite de trail - monitorear rendimiento
  // FASE 1: Límite de trail para optimización
  // private readonly MAX_TRAIL_LENGTH: number = 1200; // Mantener últimos 1200 puntos (aumentado para reducir problemas de sincronización)

  constructor(
    id: string,
    name: string,
    color: string,
    startPosition: Position,
    startAngle: number = 0,
    speed: number = 0.5
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.position = { ...startPosition };
    this.angle = startAngle;
    this.speed = speed;
    this.alive = true;
    this.trail = [{ ...startPosition }];
    this.trailTimer = 0;
    this.shouldDrawTrail = true;
    this.wasDrawingTrail = true;
    this.boostActive = false;
    this.boostRemaining = 5000; // 5 segundos disponibles para la ronda
    this.boostCharge = 100; // 100% = 5 segundos disponibles
  }

  /**
   * Actualiza la posición del jugador según su ángulo y velocidad
   * @param deltaTime - Tiempo transcurrido desde el último frame en ms
   * @param isBoostRequested - Si el jugador está presionando ambas teclas para boost
   */
  update(deltaTime: number = 16.67, isBoostRequested: boolean = false): void {
    if (!this.alive) return;

    // Actualizar sistema de boost
    this.updateBoost(deltaTime, isBoostRequested);

    // Actualizar timer del trail
    this.trailTimer += deltaTime;

    // Calcular si estamos en un período de hueco
    const timeInCycle = this.trailTimer % this.gapInterval;
    this.shouldDrawTrail = timeInCycle >= this.gapDuration;

    // Calcular velocidad actual (con boost si está activo)
    const currentSpeed = this.boostActive
      ? this.speed * this.boostSpeedMultiplier
      : this.speed;

    // Calcular nueva posición
    const newX = this.position.x + Math.cos(this.angle) * currentSpeed;
    const newY = this.position.y + Math.sin(this.angle) * currentSpeed;

    // Si acabamos de entrar en un hueco, agregar un marcador de break
    if (this.wasDrawingTrail && !this.shouldDrawTrail) {
      // Agregar un punto null para marcar el break (usaremos null como marcador)
      this.trail.push(null as any);
    }

    // Solo agregar al trail si no estamos en período de hueco
    if (this.shouldDrawTrail) {
      this.trail.push({ ...this.position });

      // EXPERIMENTO: Sin límite de trail - monitorear rendimiento
      // FASE 1: Limitar tamaño del trail (mantener últimos 600 puntos)
      // if (this.trail.length > this.MAX_TRAIL_LENGTH) {
      //   this.trail = this.trail.slice(-this.MAX_TRAIL_LENGTH);
      // }
    }

    // Actualizar estado anterior
    this.wasDrawingTrail = this.shouldDrawTrail;

    // Actualizar posición
    this.position.x = newX;
    this.position.y = newY;
  }

  /**
   * Actualiza el sistema de boost
   * @param isBoostRequested - Si el jugador está presionando ambas teclas
   */
  updateBoost(deltaTime: number, isBoostRequested: boolean): void {
    if (this.boostActive) {
      // Si no se están presionando ambas teclas, desactivar inmediatamente (sin consumir tiempo)
      if (!isBoostRequested) {
        this.boostActive = false;
        // Actualizar charge para la UI sin consumir tiempo
        this.boostCharge = (this.boostRemaining / this.boostDuration) * 100;
      } else {
        // Solo consumir tiempo si está activo Y se están presionando ambos botones
        this.boostRemaining = Math.max(0, this.boostRemaining - deltaTime);

        // Actualizar charge para la UI (porcentaje del tiempo restante)
        this.boostCharge = (this.boostRemaining / this.boostDuration) * 100;

        // Si se agotó el tiempo, desactivarlo
        if (this.boostRemaining <= 0) {
          this.boostActive = false;
          this.boostRemaining = 0;
          this.boostCharge = 0;
        }
      }
    } else {
      // Si no está activo, verificar si se solicita boost para activarlo
      if (isBoostRequested && this.boostRemaining > 0) {
        this.boostActive = true;
      }
      // Actualizar charge para la UI (pero no recargar)
      this.boostCharge = (this.boostRemaining / this.boostDuration) * 100;
    }
  }

  /**
   * Intenta activar el boost
   * @returns true si se activó, false si no hay tiempo restante
   */
  activateBoost(): boolean {
    if (this.boostActive) {
      return true; // Ya está activo
    }

    // Necesita tiempo restante para activar
    if (this.boostRemaining > 0) {
      this.boostActive = true;
      return true;
    }

    return false; // No hay tiempo restante
  }

  /**
   * Desactiva el boost manualmente
   */
  deactivateBoost(): void {
    this.boostActive = false;
    this.boostRemaining = 0;
  }

  /**
   * Obtiene el estado del boost
   */
  getBoostState(): { active: boolean; charge: number; remaining: number } {
    return {
      active: this.boostActive,
      charge: this.boostCharge,
      remaining: this.boostRemaining,
    };
  }

  /**
   * Establece el estado del boost (para sincronización desde el servidor)
   */
  setBoostState(active: boolean, charge: number, remaining: number): void {
    this.boostActive = active;
    this.boostCharge = charge;
    this.boostRemaining = remaining;
  }

  /**
   * Verifica si actualmente se debe dibujar el trail
   */
  isDrawingTrail(): boolean {
    return this.shouldDrawTrail;
  }

  /**
   * Gira el jugador hacia la izquierda
   * @param angleDelta - Ángulo de giro en radianes
   */
  turnLeft(angleDelta: number = Math.PI / 1180): void {
    if (!this.alive) return;
    this.angle -= angleDelta;
  }

  /**
   * Gira el jugador hacia la derecha
   * @param angleDelta - Ángulo de giro en radianes
   */
  turnRight(angleDelta: number = Math.PI / 180): void {
    if (!this.alive) return;
    this.angle += angleDelta;
  }

  /**
   * Aplica rotación continua basada en una acción
   * @param action - Acción de giro ('left', 'right', o null)
   * @param angleDelta - Velocidad de giro en radianes por frame
   *                     Ángulo más pequeño = giro menos cerrado (radio más amplio)
   */
  applyRotation(
    action: "left" | "right" | null,
    angleDelta: number = Math.PI / 50
  ): void {
    if (!this.alive || !action) return;

    // Aplicar el mismo ángulo de giro para ambos lados
    // Ángulo más pequeño = giro más suave y menos cerrado
    if (action === "left") {
      this.angle -= angleDelta;
    } else if (action === "right") {
      this.angle += angleDelta;
    }
  }

  /**
   * Obtiene la posición actual
   */
  getCurrentPosition(): Position {
    return { ...this.position };
  }

  /**
   * Obtiene el trail completo (puede contener nulls para gaps)
   */
  getTrail(): Array<Position | null> {
    return [...this.trail];
  }

  /**
   * Mata al jugador
   */
  kill(): void {
    this.alive = false;
  }

  /**
   * Resetea el jugador a una nueva posición
   */
  reset(newPosition: Position, newAngle: number = 0): void {
    this.position = { ...newPosition };
    this.angle = newAngle;
    this.alive = true;
    this.trail = [{ ...newPosition }];
  }
}
