// Lógica del jugador
// Maneja posición, movimiento, rotación y trail

import type { Position } from '@shared/types';

export class Player {
  public id: string;
  public name: string;
  public color: string;
  public position: Position;
  public angle: number; // en radianes
  public speed: number;
  public alive: boolean;
  public trail: Position[];

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
  }

  /**
   * Actualiza la posición del jugador según su ángulo y velocidad
   */
  update(): void {
    if (!this.alive) return;

    // Calcular nueva posición
    const newX = this.position.x + Math.cos(this.angle) * this.speed;
    const newY = this.position.y + Math.sin(this.angle) * this.speed;

    // Guardar posición anterior en el trail
    this.trail.push({ ...this.position });

    // Actualizar posición
    this.position.x = newX;
    this.position.y = newY;
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
  applyRotation(action: 'left' | 'right' | null, angleDelta: number = Math.PI / 200): void {
    if (!this.alive || !action) return;
    
    // Aplicar el mismo ángulo de giro para ambos lados
    // Ángulo más pequeño = giro más suave y menos cerrado
    if (action === 'left') {
      this.angle -= angleDelta;
    } else if (action === 'right') {
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
   * Obtiene el trail completo
   */
  getTrail(): Position[] {
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

