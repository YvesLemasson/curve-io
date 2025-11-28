// Game Loop del servidor
// Procesa inputs, actualiza jugadores, detecta colisiones y envía estado

import type { Player, GameState } from '../shared/types.js';
import type { GameInputMessage } from '../shared/protocol.js';
import { PlayerManager } from './playerManager.js';
import { checkBoundaryCollision, checkTrailCollision, checkSelfCollision } from './collision.js';

export class GameServer {
  private playerManager: PlayerManager;
  private gameState: GameState;
  private tickRate: number = 60; // 60 ticks por segundo
  private tickInterval: number = 1000 / this.tickRate; // ~16.67ms
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private inputQueue: Map<string, GameInputMessage[]> = new Map(); // playerId -> inputs[]
  private lastTickTime: number = 0;
  private playerBoostState: Map<string, { active: boolean; charge: number; remaining: number }> = new Map(); // playerId -> boost state
  // Canvas en proporción 3:2 (apaisado)
  private canvasWidth: number = 1920;
  private canvasHeight: number = 1280; // 1920 / 1.5 = 1280 (proporción 3:2)

  // Callback para enviar estado a clientes
  private broadcastCallback: ((gameState: GameState) => void) | null = null;

  constructor(playerManager: PlayerManager, canvasWidth: number = 1920, canvasHeight: number = 1280) {
    this.playerManager = playerManager;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gameState = {
      players: [],
      gameStatus: 'waiting',
      tick: 0,
    };
  }

  /**
   * Inicia el game loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.gameState.gameStatus = 'playing';
    this.lastTickTime = Date.now();
    
    // Iniciar game loop
    this.gameLoopInterval = setInterval(() => {
      this.tick();
    }, this.tickInterval);
    
    console.log('🎮 Game loop iniciado');
  }

  /**
   * Detiene el game loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.gameState.gameStatus = 'finished';
    
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    
    console.log('🛑 Game loop detenido');
  }

  /**
   * Un tick del game loop
   */
  private tick(): void {
    const currentTime = Date.now();
    const deltaTime = this.lastTickTime === 0 ? this.tickInterval : currentTime - this.lastTickTime;
    this.lastTickTime = currentTime;

    this.gameState.tick++;

    // Procesar inputs de la cola
    this.processInputs();

    // Actualizar posiciones de jugadores
    this.updatePlayers(deltaTime);

    // Detectar colisiones
    this.checkCollisions();

    // Verificar condición de victoria
    this.checkWinCondition();

    // Enviar estado actualizado a todos los clientes
    this.broadcastState();
  }

  /**
   * Procesa los inputs de la cola
   */
  private processInputs(): void {
    const players = this.playerManager.getAllPlayers();
    
    for (const player of players) {
      const inputs = this.inputQueue.get(player.id) || [];
      
      // Procesar el último input (o todos si hay varios)
      if (inputs.length > 0) {
        // Procesar el input más reciente
        const latestInput = inputs[inputs.length - 1];
        
        // Actualizar estado de boost
        this.updatePlayerBoost(player.id, latestInput.boost);
        
        // Solo aplicar rotación si no está en boost
        if (!latestInput.boost && latestInput.key) {
          this.applyInput(player, latestInput.key);
        }
        
        if (inputs.length > 1) {
          console.log(`📥 Procesando ${inputs.length} inputs de ${player.name}, usando el más reciente`);
        }
        
        // Limpiar la cola para este jugador
        this.inputQueue.set(player.id, []);
      }
    }
  }
  
  /**
   * Actualiza el estado de boost de un jugador
   */
  private updatePlayerBoost(playerId: string, isBoostRequested: boolean): void {
    const deltaTime = 1000 / this.tickRate; // ~16.67ms por tick
    let boostState = this.playerBoostState.get(playerId);
    
    // Inicializar estado de boost si no existe
    if (!boostState) {
      boostState = {
        active: false,
        charge: 100,
        remaining: 0,
      };
      this.playerBoostState.set(playerId, boostState);
    }
    
    // Si se solicita boost y hay carga suficiente, activarlo
    if (isBoostRequested && !boostState.active && boostState.charge > 0) {
      boostState.active = true;
      boostState.remaining = 5000; // 5 segundos
    }
    
    // Si el boost está activo
    if (boostState.active) {
      // Si no se está solicitando boost, desactivarlo
      if (!isBoostRequested) {
        boostState.active = false;
        boostState.remaining = 0;
      } else {
        // Consumir carga y tiempo
        const chargeConsumed = (100 / 5000) * deltaTime;
        boostState.charge = Math.max(0, boostState.charge - chargeConsumed);
        boostState.remaining -= deltaTime;
        
        // Si se agotó la carga o el tiempo, desactivarlo
        if (boostState.remaining <= 0 || boostState.charge <= 0) {
          boostState.active = false;
          boostState.remaining = 0;
          boostState.charge = 0;
        }
      }
    } else {
      // Si no está activo, recargar lentamente
      if (boostState.charge < 100) {
        boostState.charge = Math.min(100, boostState.charge + (100 / 20000) * deltaTime);
      }
    }
  }

  /**
   * Aplica un input a un jugador
   */
  private applyInput(player: Player, key: 'left' | 'right'): void {
    if (!player.alive) return;

    const angleDelta = Math.PI / 50; // Giro muy fuerte (4x el original)
    
    if (key === 'left') {
      player.angle -= angleDelta;
    } else if (key === 'right') {
      player.angle += angleDelta;
    }
  }

  /**
   * Actualiza las posiciones de todos los jugadores
   */
  private updatePlayers(deltaTime: number): void {
    const players = this.playerManager.getAllPlayers();
    const aliveCount = players.filter(p => p.alive).length;
    
    for (const player of players) {
      if (!player.alive) continue;

      // Calcular nueva posición basada en ángulo y velocidad
      const boostState = this.playerBoostState.get(player.id);
      const boostMultiplier = boostState?.active ? 1.5 : 1.0; // 50% más rápido con boost
      const speed = player.speed * boostMultiplier;
      const newX = player.position.x + Math.cos(player.angle) * speed;
      const newY = player.position.y + Math.sin(player.angle) * speed;

      // Actualizar posición
      player.position.x = newX;
      player.position.y = newY;

      // Agregar al trail (simplificado, sin gaps por ahora)
      player.trail.push({ ...player.position });
      
      // Limitar tamaño del trail (mantener últimos 1000 puntos)
      if (player.trail.length > 1000) {
        player.trail = player.trail.slice(-1000);
      }
    }

    // Actualizar gameState con las posiciones actualizadas
    this.gameState.players = players.map(p => {
      const boostState = this.playerBoostState.get(p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        position: { ...p.position },
        angle: p.angle,
        speed: p.speed,
        alive: p.alive,
        trail: p.trail.map(pos => pos ? { ...pos } : null),
        boost: boostState ? {
          active: boostState.active,
          charge: boostState.charge,
          remaining: boostState.remaining,
        } : undefined,
      };
    });
    
    // Log cada 60 ticks (aproximadamente 1 vez por segundo)
    if (this.gameState.tick % 60 === 0) {
      console.log(`🎮 Tick ${this.gameState.tick} | Jugadores vivos: ${aliveCount}/${players.length}`);
    }
  }

  /**
   * Detecta colisiones
   */
  private checkCollisions(): void {
    const players = this.playerManager.getAllPlayers();
    
    for (const player of players) {
      if (!player.alive) continue;

      // Colisión con bordes
      if (checkBoundaryCollision(player.position, this.canvasWidth, this.canvasHeight)) {
        player.alive = false;
        console.log(`💀 Jugador ${player.name} (${player.id.substring(0, 8)}...) murió por colisión con borde en (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)})`);
        continue;
      }

      // Colisión con otros trails
      const otherTrails = players
        .filter(p => p.id !== player.id && p.alive)
        .map(p => ({ trail: p.trail, playerId: p.id }));
      
      if (player.trail.length >= 2) {
        const currentPos = player.trail[player.trail.length - 2];
        const newPos = player.trail[player.trail.length - 1];
        
        const trailCollision = checkTrailCollision(currentPos, newPos, otherTrails, player.id);
        if (trailCollision.collided) {
          player.alive = false;
          console.log(`💀 Jugador ${player.name} murió por colisión con trail de ${trailCollision.collidedWith}`);
          continue;
        }

        // Colisión consigo mismo
        if (checkSelfCollision(currentPos, newPos, player.trail)) {
          player.alive = false;
          console.log(`💀 Jugador ${player.name} murió por colisión consigo mismo`);
        }
      }
    }
  }

  /**
   * Verifica condición de victoria
   */
  private checkWinCondition(): void {
    const alivePlayers = this.playerManager.getAlivePlayers();
    
    if (alivePlayers.length === 1) {
      // Hay un ganador
      this.gameState.winnerId = alivePlayers[0].id;
      this.gameState.gameStatus = 'ended';
      this.stop();
      console.log(`🏆 Ganador: ${alivePlayers[0].name}`);
    } else if (alivePlayers.length === 0) {
      // Empate (todos murieron)
      this.gameState.gameStatus = 'ended';
      this.stop();
      console.log(`🤝 Empate: todos los jugadores murieron`);
    }
  }

  /**
   * Agrega un input a la cola
   */
  addInput(input: GameInputMessage): void {
    const queue = this.inputQueue.get(input.playerId) || [];
    queue.push(input);
    this.inputQueue.set(input.playerId, queue);
    
    // Log cada 10 inputs para no saturar
    if (queue.length % 10 === 0) {
      const player = this.playerManager.getPlayer(input.playerId);
      console.log(`⌨️  Input recibido de ${player?.name || input.playerId}: ${input.key} (cola: ${queue.length})`);
    }
  }

  /**
   * Configura el callback para enviar estado a clientes
   */
  onBroadcast(callback: (gameState: GameState) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Envía el estado actualizado a todos los clientes
   */
  private broadcastState(): void {
    if (this.broadcastCallback) {
      this.broadcastCallback(this.gameState);
      
      // Log cada 60 ticks (aproximadamente 1 vez por segundo)
      if (this.gameState.tick % 60 === 0) {
        const alivePlayers = this.gameState.players.filter(p => p.alive);
        console.log(`📡 Broadcast estado | Tick: ${this.gameState.tick} | Jugadores: ${alivePlayers.length}/${this.gameState.players.length}`);
      }
    }
  }

  /**
   * Obtiene el estado actual del juego
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Inicializa jugadores en posiciones iniciales
   */
  initializePlayers(): void {
    const players = this.playerManager.getAllPlayers();
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const positions = [
      { x: this.canvasWidth * 0.25, y: this.canvasHeight * 0.25 },
      { x: this.canvasWidth * 0.75, y: this.canvasHeight * 0.25 },
      { x: this.canvasWidth * 0.25, y: this.canvasHeight * 0.75 },
      { x: this.canvasWidth * 0.75, y: this.canvasHeight * 0.75 },
    ];
    const angles = [0, Math.PI, Math.PI / 2, -Math.PI / 2];

    players.forEach((player, index) => {
      const posIndex = index % positions.length;
      player.position = { ...positions[posIndex] };
      player.angle = angles[posIndex];
      player.speed = 2;
      player.alive = true;
      player.trail = [{ ...positions[posIndex] }];
      player.color = colors[index % colors.length];
    });

    this.gameState.players = players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      position: { ...p.position },
      angle: p.angle,
      speed: p.speed,
      alive: p.alive,
      trail: p.trail.map(pos => ({ ...pos })),
    }));
  }
}

