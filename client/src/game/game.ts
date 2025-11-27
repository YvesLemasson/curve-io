// Game Loop principal
// Integra renderizado, input, jugadores y colisiones

import { CanvasRenderer } from '../render/canvas';
import { InputManager } from './input';
import { Player } from './player';
import {
  checkBoundaryCollision,
  checkTrailCollision,
  checkSelfCollision,
} from './collision';
import type { GameState, Position } from '@shared/types';

export class Game {
  private canvas: CanvasRenderer;
  private input: InputManager;
  private players: Player[] = [];
  private gameState: GameState;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;

  constructor(canvasId: string = 'gameCanvas') {
    this.canvas = new CanvasRenderer(canvasId);
    this.input = new InputManager();
    this.gameState = {
      players: [],
      gameStatus: 'waiting',
      tick: 0,
    };
  }

  /**
   * Inicializa el juego con jugadores
   */
  init(numPlayers: number = 4): void {
    this.players = [];
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Colores para los jugadores
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    // Posiciones iniciales distribuidas
    const positions = [
      { x: width * 0.25, y: height * 0.25 }, // Esquina superior izquierda
      { x: width * 0.75, y: height * 0.25 }, // Esquina superior derecha
      { x: width * 0.25, y: height * 0.75 }, // Esquina inferior izquierda
      { x: width * 0.75, y: height * 0.75 }, // Esquina inferior derecha
    ];

    const angles = [0, Math.PI, Math.PI / 2, -Math.PI / 2]; // Derecha, Izquierda, Abajo, Arriba

    for (let i = 0; i < numPlayers; i++) {
      const player = new Player(
        `player-${i}`,
        `Player ${i + 1}`,
        colors[i % colors.length],
        positions[i % positions.length],
        angles[i % angles.length]
      );
      this.players.push(player);
    }

    this.gameState = {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        position: p.getCurrentPosition(),
        angle: p.angle,
        speed: p.speed,
        alive: p.alive,
        trail: p.getTrail(),
      })),
      gameStatus: 'playing',
      tick: 0,
    };
  }

  /**
   * Actualiza el estado del juego
   */
  private update(): void {
    if (this.gameState.gameStatus !== 'playing') return;

    this.gameState.tick++;

    // Procesar input del jugador 0 (local) - giro continuo y boost
    const bothKeysPressed = this.input.areBothKeysPressed();
    
    if (this.players.length > 0 && this.players[0].alive) {
      // Verificar si se presionan ambos botones para boost
      if (bothKeysPressed) {
        this.players[0].activateBoost();
        // No girar mientras se usa boost
      } else {
        // Si no se presionan ambos, procesar giro normal
        const action = this.input.getCurrentAction();
        // Aplicar rotación continua mientras se mantiene la tecla presionada
        // Ángulo más pequeño = giro menos cerrado (radio más amplio)
        this.players[0].applyRotation(action, Math.PI / 200);
      }
    }

    // Calcular deltaTime (tiempo transcurrido desde el último frame)
    const currentTime = performance.now();
    const deltaTime = this.lastFrameTime === 0 ? 16.67 : currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Actualizar todos los jugadores vivos
    const alivePlayers = this.players.filter(p => p.alive);
    
    for (let i = 0; i < alivePlayers.length; i++) {
      const player = alivePlayers[i];
      const oldPos = player.getCurrentPosition();
      
      // Solo el jugador local (índice 0) puede usar boost
      const isBoostRequested = i === 0 ? bothKeysPressed : false;
      
      player.update(deltaTime, isBoostRequested);
      const newPos = player.getCurrentPosition();

      // Verificar colisiones
      const width = this.canvas.getWidth();
      const height = this.canvas.getHeight();

      // Colisión con bordes
      if (checkBoundaryCollision(newPos, width, height)) {
        player.kill();
        continue;
      }

      // Colisión con otros trails
      const otherTrails = this.players
        .filter(p => p.id !== player.id && p.alive)
        .map(p => ({ trail: p.getTrail() as Array<Position | null>, playerId: p.id }));

      const trailCollision = checkTrailCollision(
        oldPos,
        newPos,
        otherTrails,
        player.id
      );

      if (trailCollision.collided) {
        player.kill();
        continue;
      }

      // Colisión consigo mismo
      if (checkSelfCollision(oldPos, newPos, player.getTrail() as Array<Position | null>)) {
        player.kill();
        continue;
      }
    }

    // Verificar condición de victoria
    this.checkWinCondition();
  }

  /**
   * Renderiza el juego
   */
  private render(): void {
    this.canvas.clear();

    // Dibujar todos los jugadores vivos
    for (const player of this.players) {
      if (player.alive) {
        const trail = player.getTrail();
        if (trail.length >= 2) {
          this.canvas.drawTrail(trail, player.color, 3);
        }
        
        // Dibujar posición actual
        const pos = player.getCurrentPosition();
        this.canvas.drawPoint(pos.x, pos.y, player.color, 5);
      }
    }
  }

  /**
   * Game loop principal
   */
  private gameLoop(): void {
    if (!this.isRunning) return;

    this.update();
    this.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Inicia el juego
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.gameState.gameStatus = 'playing';
    this.lastFrameTime = 0; // Resetear tiempo
    this.gameLoop();
  }

  /**
   * Detiene el juego
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Verifica si hay un ganador
   */
  private checkWinCondition(): void {
    const alivePlayers = this.players.filter(p => p.alive);
    
    if (alivePlayers.length <= 1) {
      this.gameState.gameStatus = 'finished';
      if (alivePlayers.length === 1) {
        this.gameState.winnerId = alivePlayers[0].id;
      }
      this.stop();
    }
  }

  /**
   * Obtiene el estado actual del juego
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Obtiene todos los jugadores
   */
  getPlayers(): Player[] {
    return [...this.players];
  }
  
  /**
   * Obtiene el estado del boost del jugador local (jugador 0)
   */
  getLocalPlayerBoostState(): { active: boolean; charge: number; remaining: number } | null {
    if (this.players.length > 0) {
      return this.players[0].getBoostState();
    }
    return null;
  }

  /**
   * Limpia recursos
   */
  destroy(): void {
    this.stop();
    this.input.destroy();
  }
}

