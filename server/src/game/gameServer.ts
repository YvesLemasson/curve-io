// Game Loop del servidor
// Procesa inputs, actualiza jugadores, detecta colisiones y envía estado

import type { Player, GameState, Position } from '../shared/types.js';
import type { GameInputMessage } from '../shared/protocol.js';
import { PlayerManager } from './playerManager.js';
import { checkBoundaryCollision, checkTrailCollision, checkSelfCollision } from './collision.js';
import { logger } from '../utils/logger.js';

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
  private lastBoostRequested: Map<string, boolean> = new Map(); // playerId -> último estado de boost solicitado
  
  // Sistema de rondas
  private readonly TOTAL_ROUNDS: number = 2; // Temporalmente reducido a 2 rondas
  private currentRound: number = 1;
  private playerPoints: Map<string, number> = new Map(); // playerId -> total points
  private roundResults: Array<{ round: number; deathOrder: Array<{ playerId: string; points: number }> }> = [];
  private deathOrderThisRound: Array<string> = []; // Orden de muerte en la ronda actual
  private nextRoundCountdownInterval: NodeJS.Timeout | null = null; // Intervalo para cuenta atrás
  private nextRoundCountdown: number = 0; // Cuenta atrás actual en segundos
  
  // Sistema de gaps en trails
  private playerTrailTimers: Map<string, number> = new Map(); // playerId -> trailTimer acumulado
  private playerShouldDrawTrail: Map<string, boolean> = new Map(); // playerId -> shouldDrawTrail
  private playerWasDrawingTrail: Map<string, boolean> = new Map(); // playerId -> wasDrawingTrail
  private playerLastPointTime: Map<string, number> = new Map(); // playerId -> tiempo del último punto agregado
  private readonly gapInterval: number = 3000; // 3 segundos en ms
  private readonly gapDuration: number = 500; // 0.5 segundos en ms
  
  // Canvas en proporción 3:2 (apaisado)
  private canvasWidth: number = 1920;
  private canvasHeight: number = 1280; // 1920 / 1.5 = 1280 (proporción 3:2)

  // Callback para enviar estado a clientes
  private broadcastCallback: ((gameState: GameState) => void) | null = null;
  // Callback para cuando el juego termina
  private onGameEndCallback: ((gameState: GameState) => void) | null = null;
  
  // FASE 1: Throttling de broadcast - enviar cada 2 ticks (30 Hz en lugar de 60 Hz)
  private readonly broadcastInterval: number = 2; // Enviar cada 2 ticks
  private broadcastTickCounter: number = 0;

  constructor(playerManager: PlayerManager, canvasWidth: number = 1920, canvasHeight: number = 1280) {
    this.playerManager = playerManager;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gameState = {
      players: [],
      gameStatus: 'waiting',
      tick: 0,
      currentRound: 1,
      totalRounds: this.TOTAL_ROUNDS,
      playerPoints: {},
      roundResults: [],
    };
  }

  /**
   * Inicia el game loop
   * @param sendInitialState - Si es true, envía el estado inicial inmediatamente (por defecto false)
   */
  start(sendInitialState: boolean = false): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.gameState.gameStatus = 'playing';
    this.lastTickTime = Date.now();
    
    // Inicializar sistema de rondas
    this.currentRound = 1;
    this.playerPoints.clear();
    this.roundResults = [];
    this.deathOrderThisRound = [];
    this.gameState.currentRound = 1;
    this.gameState.totalRounds = this.TOTAL_ROUNDS;
    this.gameState.playerPoints = {};
    this.gameState.roundResults = [];
    
    // Inicializar puntos de todos los jugadores a 0
    const allPlayers = this.playerManager.getAllPlayers();
    allPlayers.forEach(player => {
      this.playerPoints.set(player.id, 0);
      this.gameState.playerPoints![player.id] = 0;
      // Inicializar boost: 5 segundos disponibles para la ronda
      this.playerBoostState.set(player.id, {
        active: false,
        charge: 100, // 100% = 5 segundos disponibles
        remaining: 5000, // 5 segundos totales para la ronda
      });
    });
    
    // Asegurar que los jugadores estén inicializados antes de empezar
    this.initializePlayers();
    
    // Si se solicita, enviar estado inicial inmediatamente
    // (normalmente se envía después de emitir GAME_START para dar tiempo a los clientes)
    if (sendInitialState) {
      logger.log(`📡 Enviando estado inicial con ${this.gameState.players.length} jugador(es)`);
      this.broadcastState(true); // true = forzar envío
    }
    
    // Iniciar game loop
    this.gameLoopInterval = setInterval(() => {
      this.tick();
    }, this.tickInterval);
    
    logger.log('🎮 Game loop iniciado');
  }
  
  /**
   * Envía el estado inicial a todos los clientes
   * Útil para enviar el estado después de que los clientes estén listos
   */
  sendInitialState(): void {
    this.initializePlayers(); // Asegurar que estén inicializados
    logger.log(`📡 Enviando estado inicial con ${this.gameState.players.length} jugador(es)`);
    this.broadcastState(true); // true = forzar envío
  }

  /**
   * Detiene el game loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    // No cambiar gameStatus aquí si ya se estableció en checkWinCondition
    // Solo establecerlo si no está ya establecido
    if (this.gameState.gameStatus === 'playing' || this.gameState.gameStatus === 'waiting' || this.gameState.gameStatus === 'round-ended') {
      this.gameState.gameStatus = 'ended';
    }
    
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    
    // Limpiar cuenta atrás si existe
    if (this.nextRoundCountdownInterval) {
      clearInterval(this.nextRoundCountdownInterval);
      this.nextRoundCountdownInterval = null;
    }
    
    logger.log('🛑 Game loop detenido');
  }

  /**
   * Un tick del game loop
   */
  private tick(): void {
    const currentTime = Date.now();
    const deltaTime = this.lastTickTime === 0 ? this.tickInterval : currentTime - this.lastTickTime;
    this.lastTickTime = currentTime;

    this.gameState.tick++;

    // Si el juego está pausado (round-ended), solo enviar estado, no actualizar nada
    if (this.gameState.gameStatus === 'round-ended') {
      // Solo enviar estado actualizado (para sincronizar cuenta atrás, etc.)
      this.broadcastState();
      return;
    }

    // Procesar inputs de la cola (solo si el juego está en 'playing')
    if (this.gameState.gameStatus === 'playing') {
      this.processInputs();

      // Actualizar boost de todos los jugadores cada tick (usando deltaTime real)
      this.updateAllBoosts(deltaTime);

      // Actualizar posiciones de jugadores
      this.updatePlayers(deltaTime);

      // Detectar colisiones
      this.checkCollisions();

      // Verificar condición de victoria
      this.checkWinCondition();
    }

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
        
        // Guardar el último estado de boost solicitado (se usará en updateAllBoosts)
        this.lastBoostRequested.set(player.id, latestInput.boost);
        
        // Solo aplicar rotación si no está en boost
        if (!latestInput.boost && latestInput.key) {
          this.applyInput(player, latestInput.key);
        }
        
        if (inputs.length > 1) {
          logger.log(`📥 Procesando ${inputs.length} inputs de ${player.name}, usando el más reciente`);
        }
        
        // Limpiar la cola para este jugador
        this.inputQueue.set(player.id, []);
      }
    }
  }
  
  /**
   * Actualiza el boost de todos los jugadores cada tick
   * Esto asegura que el boost se consuma continuamente, no solo cuando hay inputs nuevos
   */
  private updateAllBoosts(deltaTime: number): void {
    const players = this.playerManager.getAllPlayers();
    
    for (const player of players) {
      // Obtener el último estado de boost solicitado (o false si no hay)
      const isBoostRequested = this.lastBoostRequested.get(player.id) || false;
      this.updatePlayerBoost(player.id, isBoostRequested, deltaTime);
    }
  }

  /**
   * Actualiza el estado de boost de un jugador
   * @param playerId - ID del jugador
   * @param isBoostRequested - Si el jugador está solicitando boost
   * @param deltaTime - Tiempo transcurrido desde el último tick en ms
   */
  private updatePlayerBoost(playerId: string, isBoostRequested: boolean, deltaTime: number): void {
    let boostState = this.playerBoostState.get(playerId);
    
    // Inicializar estado de boost si no existe
    if (!boostState) {
      boostState = {
        active: false,
        charge: 100, // Se mantiene para compatibilidad con UI, pero no se usa para la lógica
        remaining: 5000, // 5 segundos totales disponibles para la ronda
      };
      this.playerBoostState.set(playerId, boostState);
    }
    
    // Si el boost está activo
    if (boostState.active) {
      // Si no se está solicitando boost, desactivarlo inmediatamente (sin consumir tiempo)
      if (!isBoostRequested) {
        boostState.active = false;
        // Actualizar charge para la UI sin consumir tiempo
        boostState.charge = (boostState.remaining / 5000) * 100;
      } else {
        // Solo consumir tiempo si está activo Y se están presionando ambos botones
        boostState.remaining = Math.max(0, boostState.remaining - deltaTime);
        
        // Actualizar charge para la UI (porcentaje del tiempo restante)
        boostState.charge = (boostState.remaining / 5000) * 100;
        
        // Si se agotó el tiempo, desactivarlo
        if (boostState.remaining <= 0) {
          boostState.active = false;
          boostState.remaining = 0;
          boostState.charge = 0;
        }
      }
    } else {
      // Si no está activo, verificar si se solicita boost para activarlo
      if (isBoostRequested && boostState.remaining > 0) {
        boostState.active = true;
      }
      // Actualizar charge para la UI (pero no recargar)
      boostState.charge = (boostState.remaining / 5000) * 100;
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

      // Sistema de gaps en trails
      // Inicializar estado de gaps si no existe
      if (!this.playerTrailTimers.has(player.id)) {
        this.playerTrailTimers.set(player.id, 0);
        this.playerShouldDrawTrail.set(player.id, true);
        this.playerWasDrawingTrail.set(player.id, true);
      }
      
      // Actualizar timer del trail
      const currentTimer = this.playerTrailTimers.get(player.id)!;
      const newTimer = currentTimer + deltaTime;
      
      // Prevenir acumulación excesiva del timer para evitar problemas de precisión numérica
      // Usar módulo siempre para mantener el timer dentro de un rango manejable
      // Resetear cada 100 ciclos (~5 minutos = 300000ms) manteniendo solo el resto
      const MAX_TIMER_VALUE = this.gapInterval * 100; // ~5 minutos = 300000ms
      const normalizedTimer = newTimer % MAX_TIMER_VALUE;
      this.playerTrailTimers.set(player.id, normalizedTimer);
      
      // Calcular si estamos en un período de hueco
      // Usar módulo directamente para obtener la posición en el ciclo actual (0-3000ms)
      const timeInCycle = normalizedTimer % this.gapInterval;
      // shouldDrawTrail = true cuando timeInCycle >= gapDuration (es decir, después del gap)
      // gapInterval = 3000ms, gapDuration = 500ms
      // Entonces: de 0-500ms = gap (false), de 500-3000ms = dibujar (true)
      const shouldDrawTrail = timeInCycle >= this.gapDuration;
      const wasDrawingTrail = this.playerWasDrawingTrail.get(player.id)!;
      
      // Log detallado cada 60 ticks (~1 segundo) para debugging
      if (this.gameState.tick % 60 === 0) {
        const trailLength = player.trail.length;
        const validPoints = player.trail.filter(p => p !== null).length;
        const nullPoints = player.trail.filter(p => p === null).length;
        const lastPointTime = this.playerLastPointTime.get(player.id);
        const timeSinceLastPoint = lastPointTime !== undefined ? (normalizedTimer - lastPointTime) : 0;
        logger.log(`🔍 [${player.id.substring(0, 8)}] Tick ${this.gameState.tick} | Timer: ${normalizedTimer.toFixed(2)}ms | timeInCycle: ${timeInCycle.toFixed(2)}ms | shouldDraw: ${shouldDrawTrail} | wasDrawing: ${wasDrawingTrail}`);
        logger.log(`   Trail: ${validPoints} válidos, ${nullPoints} nulls, total: ${trailLength} | Tiempo desde último punto: ${timeSinceLastPoint.toFixed(2)}ms`);
        
        // Advertencia si el trail no está creciendo
        if (validPoints < 10 && this.gameState.tick > 300) {
          logger.warn(`   ⚠️ Trail muy corto después de ${this.gameState.tick} ticks!`);
        }
      }
      
      // Si acabamos de entrar en un hueco, agregar un marcador de break (null)
      if (wasDrawingTrail && !shouldDrawTrail) {
        player.trail.push(null);
      }
      
      // Solo agregar al trail si no estamos en período de hueco
      let pointAdded = false;
      const trailLengthBefore = player.trail.length;
      if (shouldDrawTrail) {
        player.trail.push({ ...player.position });
        pointAdded = true;
        // Actualizar tiempo del último punto agregado
        this.playerLastPointTime.set(player.id, normalizedTimer);
        
        // Log detallado cuando se agrega punto y el trail está cerca del máximo
        if (trailLengthBefore >= 1195 && this.gameState.tick % 60 === 0) {
          logger.log(`   ➕ [${player.id.substring(0, 8)}] Punto agregado: trail antes=${trailLengthBefore}, después=${player.trail.length}`);
        }
      }
      
      // Verificación de seguridad crítica: si no se ha agregado ningún punto en más de 1 segundo,
      // forzar agregar un punto para evitar que el trail se quede sin dibujar permanentemente
      // Esto puede pasar si hay un bug en el cálculo del timer o normalización
      const lastPointTime = this.playerLastPointTime.get(player.id);
      if (lastPointTime !== undefined) {
        // Calcular tiempo desde último punto, manejando el caso donde el timer se resetea
        let timeSinceLastPoint = normalizedTimer - lastPointTime;
        // Si el resultado es negativo, significa que el timer se reseteó, ajustar
        if (timeSinceLastPoint < 0) {
          timeSinceLastPoint = normalizedTimer + (MAX_TIMER_VALUE - lastPointTime);
        }
        // Si han pasado más de 1 segundo sin agregar puntos (más que el gap de 500ms), hay un problema
        if (timeSinceLastPoint > 1000 && !pointAdded) {
          logger.warn(`⚠️ [${player.id.substring(0, 8)}] Timer anómalo detectado: sin puntos por ${timeSinceLastPoint.toFixed(2)}ms, timeInCycle=${timeInCycle.toFixed(2)}ms, shouldDraw=${shouldDrawTrail}, forzando dibujo`);
          logger.warn(`   Detalles: normalizedTimer=${normalizedTimer.toFixed(2)}ms, lastPointTime=${lastPointTime.toFixed(2)}ms, gapInterval=${this.gapInterval}ms, gapDuration=${this.gapDuration}ms`);
          player.trail.push({ ...player.position });
          this.playerLastPointTime.set(player.id, normalizedTimer);
          this.playerShouldDrawTrail.set(player.id, true); // Forzar estado a true
          pointAdded = true;
        }
      } else {
        // Inicializar si no existe
        this.playerLastPointTime.set(player.id, normalizedTimer);
      }
      
      // Log de advertencia si no se agregó punto y debería haberse agregado
      if (!pointAdded && shouldDrawTrail && this.gameState.tick % 60 === 0) {
        logger.warn(`⚠️ [${player.id.substring(0, 8)}] shouldDrawTrail=true pero no se agregó punto! timeInCycle=${timeInCycle.toFixed(2)}ms`);
      }
      
      // Actualizar estado anterior
      this.playerShouldDrawTrail.set(player.id, shouldDrawTrail);
      this.playerWasDrawingTrail.set(player.id, shouldDrawTrail);
      
      // EXPERIMENTO: Sin límite de trail - monitorear rendimiento
      // const MAX_TRAIL_LENGTH = 1200;
      // const trailLengthBeforeSlice = player.trail.length;
      // if (player.trail.length > MAX_TRAIL_LENGTH) {
      //   const validBefore = player.trail.filter(p => p !== null).length;
      //   player.trail = player.trail.slice(-MAX_TRAIL_LENGTH);
      //   const validAfter = player.trail.filter(p => p !== null).length;
      //   
      //   // Log cuando se hace slice para ver qué se está eliminando
      //   if (this.gameState.tick % 60 === 0) {
      //     console.log(`   ✂️ [${player.id.substring(0, 8)}] Slice aplicado: antes=${trailLengthBeforeSlice} (${validBefore} válidos), después=${player.trail.length} (${validAfter} válidos)`);
      //   }
      // }
      
      // Verificación de seguridad: asegurar que siempre haya al menos un punto válido en el trail
      // Esto previene que el trail se quede completamente vacío o solo con nulls
      const hasValidPoints = player.trail.some(p => p !== null);
      if (!hasValidPoints) {
        // Si no hay puntos válidos (todos son null o está vacío), agregar la posición actual
        logger.warn(`⚠️ [${player.id.substring(0, 8)}] Trail sin puntos válidos! Agregando punto de emergencia. Trail length: ${player.trail.length}, shouldDraw: ${shouldDrawTrail}, timeInCycle: ${timeInCycle.toFixed(2)}ms`);
        player.trail.push({ ...player.position });
      }
      
      // Log adicional cada 300 ticks (~5 segundos) con información más detallada
      if (this.gameState.tick % 300 === 0) {
        const lastPointTime = this.playerLastPointTime.get(player.id);
        const timeSinceLastPoint = lastPointTime !== undefined ? (normalizedTimer - lastPointTime) : 0;
        const trailStats = {
          total: player.trail.length,
          valid: player.trail.filter(p => p !== null).length,
          nulls: player.trail.filter(p => p === null).length,
          lastPointTime: lastPointTime?.toFixed(2) || 'N/A',
          timeSinceLastPoint: timeSinceLastPoint.toFixed(2)
        };
        logger.log(`📊 [${player.id.substring(0, 8)}] Tick ${this.gameState.tick} - Estado detallado:`);
        logger.log(`   Timer: ${normalizedTimer.toFixed(2)}ms | timeInCycle: ${timeInCycle.toFixed(2)}ms | shouldDraw: ${shouldDrawTrail}`);
        logger.log(`   Trail: ${trailStats.valid} válidos, ${trailStats.nulls} nulls, total: ${trailStats.total}`);
        logger.log(`   Último punto: ${trailStats.lastPointTime}ms | Tiempo desde último: ${trailStats.timeSinceLastPoint}ms`);
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
        trail: p.trail.map(pos => pos ? { ...pos } : null), // Preservar nulls (gaps)
        trailType: p.trailType,
        trailEffect: p.trailEffect,
        boost: boostState ? {
          active: boostState.active,
          charge: boostState.charge,
          remaining: boostState.remaining,
        } : undefined,
      };
    });
    
    // Actualizar playerPoints en gameState (convertir Map a Record)
    if (!this.gameState.playerPoints) {
      this.gameState.playerPoints = {};
    }
    this.playerPoints.forEach((points, playerId) => {
      this.gameState.playerPoints![playerId] = points;
    });
    
    // Actualizar información de ronda
    this.gameState.currentRound = this.currentRound;
    this.gameState.totalRounds = this.TOTAL_ROUNDS;
    
    // Log cada 60 ticks (aproximadamente 1 vez por segundo)
    if (this.gameState.tick % 60 === 0) {
      logger.log(`🎮 Tick ${this.gameState.tick} | Jugadores vivos: ${aliveCount}/${players.length}`);
    }
    
    // MEDICIÓN DE RENDIMIENTO: Estadísticas de trails cada 5 segundos (300 ticks)
    if (this.gameState.tick % 300 === 0 && this.gameState.tick > 0) {
      const trailStats = players.map(p => ({
        id: p.id.substring(0, 8),
        total: p.trail.length,
        valid: p.trail.filter(pt => pt !== null).length,
        nulls: p.trail.filter(pt => pt === null).length
      }));
      
      const totalPoints = trailStats.reduce((sum, s) => sum + s.total, 0);
      const totalValidPoints = trailStats.reduce((sum, s) => sum + s.valid, 0);
      const avgTrailLength = trailStats.length > 0 ? (totalPoints / trailStats.length).toFixed(1) : 0;
      const maxTrailLength = Math.max(...trailStats.map(s => s.total), 0);
      const minTrailLength = Math.min(...trailStats.map(s => s.total), 0);
      
      logger.performance(`📈 RENDIMIENTO [Tick ${this.gameState.tick}] - Estadísticas de Trails:`);
      logger.performance(`   Total puntos: ${totalPoints} (${totalValidPoints} válidos, ${totalPoints - totalValidPoints} nulls)`);
      logger.performance(`   Promedio: ${avgTrailLength} puntos/jugador | Min: ${minTrailLength} | Max: ${maxTrailLength}`);
      trailStats.forEach(s => {
        logger.performance(`   [${s.id}]: ${s.total} total (${s.valid} válidos, ${s.nulls} nulls)`);
      });
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
        // Agregar a la lista de muertos de esta ronda si no está ya
        if (!this.deathOrderThisRound.includes(player.id)) {
          this.deathOrderThisRound.push(player.id);
        }
        logger.log(`💀 Jugador ${player.name} (${player.id.substring(0, 8)}...) murió por colisión con borde en (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)})`);
        continue;
      }

      // Colisión con otros trails
      // IMPORTANTE: NO filtrar nulls - las funciones de colisión ahora manejan gaps correctamente
      // Necesitamos encontrar las últimas dos posiciones válidas (no null) para verificar colisión
      let currentPos: Position | null = null;
      let newPos: Position | null = null;
      
      // Buscar las últimas dos posiciones válidas del trail
      for (let i = player.trail.length - 1; i >= 0; i--) {
        const pos = player.trail[i];
        if (pos !== null) {
          if (newPos === null) {
            newPos = pos;
          } else if (currentPos === null) {
            currentPos = pos;
            break;
          }
        }
      }
      
      if (currentPos && newPos) {
        const otherTrails = players
          .filter(p => p.id !== player.id && p.alive)
          .map(p => ({ 
            trail: p.trail, // Pasar trail completo con nulls - la función manejará los gaps
            playerId: p.id 
          }));
        
        // MEDICIÓN DE RENDIMIENTO: Tiempo de colisiones
        const collisionStartTime = performance.now();
        const trailCollision = checkTrailCollision(currentPos, newPos, otherTrails, player.id);
        const trailCollisionTime = performance.now() - collisionStartTime;
        
        if (trailCollision.collided) {
          player.alive = false;
          // Agregar a la lista de muertos de esta ronda si no está ya
          if (!this.deathOrderThisRound.includes(player.id)) {
            this.deathOrderThisRound.push(player.id);
          }
          logger.log(`💀 Jugador ${player.name} murió por colisión con trail de ${trailCollision.collidedWith}`);
          continue;
        }

        // Colisión consigo mismo (pasar trail completo con nulls)
        const selfCollisionStartTime = performance.now();
        const selfCollision = checkSelfCollision(currentPos, newPos, player.trail);
        const selfCollisionTime = performance.now() - selfCollisionStartTime;
        
        if (selfCollision) {
          player.alive = false;
          // Agregar a la lista de muertos de esta ronda si no está ya
          if (!this.deathOrderThisRound.includes(player.id)) {
            this.deathOrderThisRound.push(player.id);
          }
          logger.log(`💀 Jugador ${player.name} murió por colisión consigo mismo`);
        }
        
        // Log de rendimiento de colisiones (cada 5 segundos, solo si es lento)
        if (this.gameState.tick % 300 === 0 && (trailCollisionTime > 1 || selfCollisionTime > 1)) {
          logger.performance(`⏱️ [${player.id.substring(0, 8)}] Tiempo colisiones: trail=${trailCollisionTime.toFixed(3)}ms, self=${selfCollisionTime.toFixed(3)}ms`);
        }
      }
    }
  }

  /**
   * Verifica condición de victoria y maneja rondas
   */
  private checkWinCondition(): void {
    const alivePlayers = this.playerManager.getAlivePlayers();
    
    // Si hay un ganador o todos murieron, terminar la ronda
    if (alivePlayers.length <= 1) {
      // Solo procesar si no estamos ya en estado 'round-ended'
      if (this.gameState.gameStatus === 'playing') {
        // Calcular puntos de esta ronda
        this.calculateRoundPoints();
        
        // Si es la última ronda, terminar el juego
        if (this.currentRound >= this.TOTAL_ROUNDS) {
          this.endGame();
        } else {
          // Cambiar a estado 'round-ended' y esperar a que alguien presione "Next Round"
          this.gameState.gameStatus = 'round-ended';
          this.gameState.nextRoundCountdown = undefined; // Sin cuenta atrás todavía
          this.broadcastState(true); // Forzar envío del estado
          logger.log(`⏸️  Ronda ${this.currentRound} terminada. Esperando solicitud para siguiente ronda...`);
        }
      }
    }
  }
  
  /**
   * Calcula los puntos de la ronda actual basado en el orden de muerte
   */
  private calculateRoundPoints(): void {
    const allPlayers = this.playerManager.getAllPlayers();
    const alivePlayers = this.playerManager.getAlivePlayers();
    
    // El ganador (si hay) no está en deathOrder, así que lo agregamos al final
    const totalPlayers = allPlayers.length;
    const deathOrder: Array<{ playerId: string; points: number }> = [];
    
    // Agregar jugadores muertos en orden de muerte
    this.deathOrderThisRound.forEach((playerId, index) => {
      // Puntos = número de jugadores que murieron antes que este
      const points = index;
      deathOrder.push({ playerId, points });
      
      // Actualizar puntos totales
      const currentPoints = this.playerPoints.get(playerId) || 0;
      this.playerPoints.set(playerId, currentPoints + points);
      this.gameState.playerPoints![playerId] = currentPoints + points;
    });
    
    // Agregar el ganador (si hay) al final con puntos = número de jugadores que murieron
    if (alivePlayers.length === 1) {
      const winnerId = alivePlayers[0].id;
      const winnerPoints = this.deathOrderThisRound.length;
      deathOrder.push({ playerId: winnerId, points: winnerPoints });
      
      // Actualizar puntos totales del ganador
      const currentPoints = this.playerPoints.get(winnerId) || 0;
      this.playerPoints.set(winnerId, currentPoints + winnerPoints);
      this.gameState.playerPoints![winnerId] = currentPoints + winnerPoints;
    }
    
    // Guardar resultados de esta ronda
    const roundResult = {
      round: this.currentRound,
      deathOrder: deathOrder,
    };
    this.roundResults.push(roundResult);
    this.gameState.roundResults = [...this.roundResults];
    
    logger.log(`📊 Ronda ${this.currentRound} terminada. Puntos asignados:`);
    deathOrder.forEach(({ playerId, points }) => {
      const player = allPlayers.find(p => p.id === playerId);
      const totalPoints = this.playerPoints.get(playerId) || 0;
      logger.log(`   ${player?.name || playerId}: +${points} puntos (Total: ${totalPoints})`);
    });
  }
  
  /**
   * Inicia la cuenta atrás para la siguiente ronda
   */
  requestNextRound(): void {
    // Solo permitir si estamos en estado 'round-ended'
    if (this.gameState.gameStatus !== 'round-ended') {
      logger.log(`⚠️  Intento de solicitar siguiente ronda cuando el estado es ${this.gameState.gameStatus}`);
      return;
    }
    
    // Si ya hay una cuenta atrás en curso, ignorar
    if (this.nextRoundCountdownInterval !== null) {
      logger.log(`⚠️  Ya hay una cuenta atrás en curso`);
      return;
    }
    
    // Iniciar cuenta atrás de 3 segundos
    this.nextRoundCountdown = 3;
    this.gameState.nextRoundCountdown = 3;
    this.broadcastState(true);
    
    logger.log(`⏱️  Iniciando cuenta atrás para siguiente ronda: ${this.nextRoundCountdown} segundos`);
    
    this.nextRoundCountdownInterval = setInterval(() => {
      try {
        this.nextRoundCountdown--;
        this.gameState.nextRoundCountdown = this.nextRoundCountdown;
        this.broadcastState(true); // Forzar envío para actualizar cuenta atrás
        
        logger.log(`⏱️  Cuenta atrás: ${this.nextRoundCountdown} segundos`);
        
        if (this.nextRoundCountdown <= 0) {
          logger.log(`✅ Cuenta atrás completada, iniciando siguiente ronda...`);
          // Terminar cuenta atrás e iniciar siguiente ronda
          if (this.nextRoundCountdownInterval) {
            clearInterval(this.nextRoundCountdownInterval);
            this.nextRoundCountdownInterval = null;
          }
          this.gameState.nextRoundCountdown = undefined;
          this.startNextRound();
        }
      } catch (error) {
        logger.error(`❌ Error en cuenta atrás:`, error);
        // Limpiar intervalo en caso de error
        if (this.nextRoundCountdownInterval) {
          clearInterval(this.nextRoundCountdownInterval);
          this.nextRoundCountdownInterval = null;
        }
      }
    }, 1000); // Actualizar cada segundo
  }
  
  /**
   * Inicia la siguiente ronda
   */
  private startNextRound(): void {
    try {
      const nextRound = this.currentRound + 1;
      logger.log(`🔄 [startNextRound] Iniciando ronda ${nextRound}/${this.TOTAL_ROUNDS}`);
      
      this.currentRound = nextRound;
      this.gameState.currentRound = this.currentRound;
      this.deathOrderThisRound = [];
      this.gameState.gameStatus = 'playing';
      this.gameState.nextRoundCountdown = undefined;
      
      // Reiniciar todos los jugadores
      const allPlayers = this.playerManager.getAllPlayers();
      logger.log(`   [startNextRound] Reiniciando ${allPlayers.length} jugadores...`);
      allPlayers.forEach(player => {
        player.alive = true;
        player.trail = [];
      });
      
      // Reinicializar posiciones
      logger.log(`   [startNextRound] Reinicializando posiciones...`);
      this.initializePlayers();
      
      // Reinicializar estados de boost y gaps
      logger.log(`   [startNextRound] Reinicializando boost y gaps...`);
      allPlayers.forEach(player => {
        this.playerBoostState.set(player.id, {
          active: false,
          charge: 100, // 100% = 5 segundos disponibles
          remaining: 5000, // 5 segundos totales para la ronda
        });
        this.initializePlayerGaps(player.id);
      });
      
      logger.log(`✅ [startNextRound] Ronda ${this.currentRound}/${this.TOTAL_ROUNDS} iniciada correctamente`);
      logger.log(`   Estado: ${this.gameState.gameStatus}`);
      logger.log(`   Jugadores: ${allPlayers.length}`);
      this.broadcastState(true); // Forzar envío del estado
    } catch (error) {
      logger.error(`❌ Error en startNextRound:`, error);
      throw error; // Re-lanzar para que se vea en los logs
    }
  }
  
  /**
   * Termina el juego después de todas las rondas
   */
  private endGame(): void {
    this.gameState.gameStatus = 'ended';
    
    // Determinar ganador final (jugador con más puntos)
    let maxPoints = -1;
    let winnerId: string | undefined = undefined;
    
    this.playerPoints.forEach((points, playerId) => {
      if (points > maxPoints) {
        maxPoints = points;
        winnerId = playerId;
      }
    });
    
    this.gameState.winnerId = winnerId;
    
    logger.log(`🏆 Juego terminado después de ${this.TOTAL_ROUNDS} rondas`);
    logger.log(`📊 Puntos finales:`);
    const allPlayers = this.playerManager.getAllPlayers();
    allPlayers.forEach(player => {
      const points = this.playerPoints.get(player.id) || 0;
      const isWinner = player.id === winnerId;
      logger.log(`   ${player.name}: ${points} puntos${isWinner ? ' 🏆' : ''}`);
    });
    
    // Enviar estado final antes de detener (forzar envío)
    this.broadcastState(true);
    
    // Ejecutar callback de fin de juego
    if (this.onGameEndCallback) {
      this.onGameEndCallback(this.gameState);
    }
    
    this.stop();
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
      logger.log(`⌨️  Input recibido de ${player?.name || input.playerId}: ${input.key} (cola: ${queue.length})`);
    }
  }

  /**
   * Configura el callback para enviar estado a clientes
   */
  onBroadcast(callback: (gameState: GameState) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Configura el callback para cuando el juego termina
   */
  onGameEnd(callback: (gameState: GameState) => void): void {
    this.onGameEndCallback = callback;
  }

  /**
   * Envía el estado actualizado a todos los clientes
   * FASE 1: Throttling - solo enviar cada N ticks (30 Hz en lugar de 60 Hz)
   * @param force - Si es true, envía el estado incluso si el contador no está listo (útil para estado final)
   */
  private broadcastState(force: boolean = false): void {
    // Incrementar contador
    this.broadcastTickCounter++;
    
    // Solo enviar cada N ticks, a menos que sea forzado
    if (!force && this.broadcastTickCounter < this.broadcastInterval) {
      return;
    }
    
    // Resetear contador
    this.broadcastTickCounter = 0;
    
    if (this.broadcastCallback) {
      this.broadcastCallback(this.gameState);
      
      // Log cada 60 ticks (aproximadamente 1 vez por segundo)
      if (this.gameState.tick % 60 === 0 || force) {
        const alivePlayers = this.gameState.players.filter(p => p.alive);
        logger.performance(`📡 Broadcast estado | Tick: ${this.gameState.tick} | Jugadores: ${alivePlayers.length}/${this.gameState.players.length} | Rate: ${1000 / (this.tickInterval * this.broadcastInterval)}Hz${force ? ' (FORZADO - Estado final)' : ''}`);
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
   * Inicializa el estado de gaps para un jugador
   */
  initializePlayerGaps(playerId: string): void {
    this.playerTrailTimers.set(playerId, 0);
    this.playerShouldDrawTrail.set(playerId, true);
    this.playerWasDrawingTrail.set(playerId, true);
  }

  /**
   * Encuentra un color disponible que no esté en uso por otros jugadores
   */
  private getAvailableColor(existingPlayers: Player[], excludePlayerId?: string): string {
    const availableColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    // Filtrar el jugador que estamos excluyendo (si se proporciona)
    const playersToCheck = excludePlayerId 
      ? existingPlayers.filter(p => p.id !== excludePlayerId)
      : existingPlayers;
    const usedColors = new Set(playersToCheck.map(p => p.color));
    
    // Buscar el primer color disponible que no esté en uso
    for (const color of availableColors) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    
    // Si todos los colores están en uso, generar un color aleatorio
    const randomColor = () => {
      const r = Math.floor(Math.random() * 200) + 55; // 55-255 para evitar colores muy oscuros
      const g = Math.floor(Math.random() * 200) + 55;
      const b = Math.floor(Math.random() * 200) + 55;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    
    // Generar un color aleatorio y verificar que no esté en uso
    let newColor: string;
    do {
      newColor = randomColor();
    } while (usedColors.has(newColor));
    
    return newColor;
  }

  /**
   * Inicializa jugadores en posiciones iniciales
   */
  initializePlayers(): void {
    const players = this.playerManager.getAllPlayers();
    const positions = [
      { x: this.canvasWidth * 0.25, y: this.canvasHeight * 0.25 },   // Esquina superior izquierda
      { x: this.canvasWidth * 0.75, y: this.canvasHeight * 0.25 },   // Esquina superior derecha
      { x: this.canvasWidth * 0.25, y: this.canvasHeight * 0.75 },   // Esquina inferior izquierda
      { x: this.canvasWidth * 0.75, y: this.canvasHeight * 0.75 },   // Esquina inferior derecha
      { x: this.canvasWidth * 0.5, y: this.canvasHeight * 0.25 },    // Centro superior
      { x: this.canvasWidth * 0.5, y: this.canvasHeight * 0.75 },    // Centro inferior
      { x: this.canvasWidth * 0.25, y: this.canvasHeight * 0.5 },    // Centro izquierdo
      { x: this.canvasWidth * 0.75, y: this.canvasHeight * 0.5 },    // Centro derecho
    ];
    const angles = [
      0,                    // Derecha (0°)
      Math.PI,              // Izquierda (180°)
      Math.PI / 2,          // Abajo (90°)
      -Math.PI / 2,         // Arriba (270°)
      Math.PI / 4,          // Diagonal abajo-derecha (45°)
      -Math.PI / 4,         // Diagonal arriba-derecha (315°)
      3 * Math.PI / 4,      // Diagonal abajo-izquierda (135°)
      -3 * Math.PI / 4,     // Diagonal arriba-izquierda (225°)
    ];

    players.forEach((player, index) => {
      const posIndex = index % positions.length;
      player.position = { ...positions[posIndex] };
      player.angle = angles[posIndex];
      player.speed = 2;
      player.alive = true;
      player.trail = [{ ...positions[posIndex] }];
      
      // IMPORTANTE: Preservar el color que el jugador ya seleccionó en el lobby
      // Solo asignar un nuevo color si:
      // 1. El jugador no tiene un color válido (blanco por defecto)
      // 2. El color actual está en uso por otro jugador
      const otherPlayers = players.filter(p => p.id !== player.id);
      const currentColorInUse = otherPlayers.some(p => p.color === player.color);
      
      // Si el color actual es el por defecto (#ffffff) o está en uso, asignar uno nuevo
      if (player.color === '#ffffff' || currentColorInUse) {
        player.color = this.getAvailableColor(otherPlayers);
        logger.log(`🎨 Asignando color ${player.color} a ${player.name} (${player.id.substring(0, 8)}...)`);
      } else {
        // Preservar el color que el jugador seleccionó
        logger.log(`✅ Preservando color ${player.color} de ${player.name} (${player.id.substring(0, 8)}...)`);
      }
      
      // Inicializar estado de gaps para este jugador
      this.playerTrailTimers.set(player.id, 0);
      this.playerShouldDrawTrail.set(player.id, true);
      this.playerWasDrawingTrail.set(player.id, true);
      this.playerLastPointTime.set(player.id, 0);
    });

    this.gameState.players = players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      position: { ...p.position },
      angle: p.angle,
      speed: p.speed,
      alive: p.alive,
      trail: p.trail.map(pos => pos ? { ...pos } : null), // Preservar nulls (gaps)
      trailType: p.trailType,
      trailEffect: p.trailEffect,
    }));
  }
}

