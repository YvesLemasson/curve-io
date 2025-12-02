// Game Loop principal
// Integra renderizado, input, jugadores y colisiones

import { CanvasRenderer } from "../render/canvas";
import { InputManager } from "./input";
import { Player } from "./player";
import {
  checkBoundaryCollision,
  checkTrailCollision,
  checkSelfCollision,
} from "./collision";
import { NetworkClient } from "../network/client";
import { SpatialHash } from "./spatialHash";
import { DeltaDecompressor } from "../network/deltaCompression";
import type { GameState, Position } from "@shared/types";

export class Game {
  private canvas: CanvasRenderer;
  private input: InputManager;
  private players: Player[] = [];
  private gameState: GameState;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private networkClient: NetworkClient | null = null;
  private useNetwork: boolean = false;
  private localPlayerId: string;
  private lastInputSendTime: number = 0;
  private readonly inputSendInterval: number = 50; // Enviar input cada 50ms (20 veces por segundo)
  // Tamaño del juego en el servidor (fijo, proporción 3:2)
  private readonly serverCanvasWidth: number = 1920;
  private readonly serverCanvasHeight: number = 1280; // 1920 / 1.5 = 1280 (proporción 3:2)

  // FASE 2: Spatial Hash para optimización de colisiones (solo modo local)
  private spatialHash: SpatialHash | null = null;

  // FASE 2: Delta Compression - Descomprimir deltas del servidor
  private deltaDecompressor: DeltaDecompressor | null = null;

  constructor(
    canvasId: string = "gameCanvas",
    useNetwork: boolean = false,
    serverUrl?: string
  ) {
    this.canvas = new CanvasRenderer(canvasId);
    this.input = new InputManager(canvasId); // Pasar canvasId para detectar toques en el canvas
    this.useNetwork = useNetwork;

    // Generar ID único para este cliente
    this.localPlayerId = `player-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.gameState = {
      players: [],
      gameStatus: "waiting",
      tick: 0,
    };

    // Inicializar cliente de red si se solicita
    if (useNetwork) {
      this.networkClient = new NetworkClient(serverUrl);
      this.deltaDecompressor = new DeltaDecompressor();
      this.setupNetworkCallbacks();
    }
  }

  /**
   * Configura los callbacks del cliente de red
   */
  private setupNetworkCallbacks(): void {
    if (!this.networkClient) return;

    this.networkClient.onConnect(() => {
      // No unirse automáticamente - esperar a que se inicie desde el lobby
    });

    // Escuchar cuando el servidor confirma nuestra unión y nos da el playerId real
    this.networkClient.onPlayerJoined((data) => {
      this.localPlayerId = data.playerId; // Usar el playerId que el servidor asignó (socket.id)
    });

    this.networkClient.onError((error) => {
      console.error("Error de red:", error);
    });

    // FASE 2: Delta Compression - Usar mensaje completo para descomprimir delta
    this.networkClient.onGameStateMessage((message) => {
      if (message.delta && this.deltaDecompressor) {
        // Descomprimir delta (ya escala las posiciones)
        const scaleX = this.canvas.getWidth() / this.serverCanvasWidth;
        const scaleY = this.canvas.getHeight() / this.serverCanvasHeight;
        const decompressedState = this.deltaDecompressor.applyDelta(
          message.delta,
          scaleX,
          scaleY
        );
        // Sincronizar con estado descomprimido (ya escalado, no escalar de nuevo)
        this.syncFromServer(decompressedState, true); // true = ya escalado
      } else if (message.gameState) {
        // Fallback: si no hay delta, usar estado completo (compatibilidad)
        this.syncFromServer(message.gameState, false); // false = necesita escalado
      }
    });

    // Mantener callback antiguo para compatibilidad
    this.networkClient.onGameState((gameState) => {
      // Solo usar si no hay delta (compatibilidad hacia atrás)
      if (!this.deltaDecompressor) {
        this.syncFromServer(gameState);
      }
    });
  }

  /**
   * Inicializa el juego con jugadores
   */
  init(numPlayers: number = 4): void {
    this.players = [];
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Colores para los jugadores (solo 8 colores básicos gratuitos)
    const colors = [
      "#ff0000", // Rojo
      "#00ff00", // Verde
      "#0000ff", // Azul
      "#ffff00", // Amarillo
      "#ff00ff", // Magenta
      "#00ffff", // Cyan
      "#ff8000", // Naranja
      "#8000ff", // Morado
    ];

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
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        position: p.getCurrentPosition(),
        angle: p.angle,
        speed: p.speed,
        alive: p.alive,
        trail: p.getTrail(),
      })),
      gameStatus: "playing",
      tick: 0,
      currentRound: 1,
      totalRounds: 2, // Temporalmente reducido a 2 rondas
      playerPoints: {},
      roundResults: [],
    };
  }

  /**
   * Actualiza el estado del juego
   */
  private update(): void {
    if (
      this.gameState.gameStatus !== "playing" &&
      this.gameState.gameStatus !== "waiting"
    )
      return;

    // Si está en modo red, el servidor es la autoridad
    // Solo procesamos input local y lo enviamos al servidor
    if (this.useNetwork) {
      this.updateNetworkMode();
      return;
    }

    // Modo local: procesar todo localmente
    this.updateLocalMode();
  }

  /**
   * Actualiza en modo red (solo input, el servidor maneja el resto)
   */
  private updateNetworkMode(): void {
    // En modo red, NO actualizamos posiciones localmente
    // Solo enviamos input al servidor y el servidor nos envía las posiciones actualizadas

    // Procesar input del jugador local y enviarlo al servidor
    const bothKeysPressed = this.input.areBothKeysPressed();

    // Buscar el jugador local
    const localPlayer = this.players.find((p) => p.id === this.localPlayerId);

    if (localPlayer && localPlayer.alive) {
      // Enviar input al servidor (con throttling)
      const currentTime = performance.now();
      if (currentTime - this.lastInputSendTime >= this.inputSendInterval) {
        if (this.networkClient) {
          if (bothKeysPressed) {
            // Si se presionan ambas teclas, enviar boost al servidor
            // NO activar boost localmente - el servidor es la autoridad
            this.networkClient.sendInput(
              this.localPlayerId,
              null,
              true,
              currentTime
            );
          } else {
            // Si no se presionan ambos, enviar boost: false y la acción de giro (si hay)
            const action = this.input.getCurrentAction();
            // Siempre enviar el estado de boost (false) incluso si no hay acción de giro
            this.networkClient.sendInput(
              this.localPlayerId,
              action,
              false,
              currentTime
            );
          }
          this.lastInputSendTime = currentTime;
        }
      }

      // NO actualizar boost localmente en modo red
      // El boost se sincroniza desde el servidor en syncFromServer()
      // El servidor es la única autoridad para el consumo del boost
    }
  }

  /**
   * Actualiza en modo local (todo se procesa localmente)
   */
  private updateLocalMode(): void {
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
        this.players[0].applyRotation(action, Math.PI / 50); // Giro muy fuerte (4x el original)
      }
    }

    // Calcular deltaTime (tiempo transcurrido desde el último frame)
    const currentTime = performance.now();
    const deltaTime =
      this.lastFrameTime === 0 ? 16.67 : currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // FASE 2: Actualizar Spatial Hash con todos los trails
    if (!this.spatialHash) {
      this.spatialHash = new SpatialHash(
        100,
        this.canvas.getWidth(),
        this.canvas.getHeight()
      );
    }
    this.spatialHash.clear();
    for (const player of this.players) {
      if (player.alive) {
        this.spatialHash.addTrail(
          player.id,
          player.getTrail() as Array<Position | null>
        );
      }
    }

    // Actualizar todos los jugadores vivos
    const alivePlayers = this.players.filter((p) => p.alive);

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
        if (this.spatialHash) {
          this.spatialHash.removePlayer(player.id);
        }
        continue;
      }

      // FASE 2: Usar Spatial Hash para obtener solo jugadores cercanos
      const nearbyPlayerIds = this.spatialHash.getPlayersForLine(
        oldPos,
        newPos
      );
      nearbyPlayerIds.delete(player.id); // Excluir el propio jugador

      // Colisión con otros trails (solo verificar jugadores cercanos)
      const otherTrails = this.players
        .filter(
          (p) => nearbyPlayerIds.has(p.id) && p.id !== player.id && p.alive
        )
        .map((p) => ({
          trail: p.getTrail() as Array<Position | null>,
          playerId: p.id,
        }));

      const trailCollision = checkTrailCollision(
        oldPos,
        newPos,
        otherTrails,
        player.id
      );

      if (trailCollision.collided) {
        player.kill();
        if (this.spatialHash) {
          this.spatialHash.removePlayer(player.id);
        }
        continue;
      }

      // Colisión consigo mismo
      if (
        checkSelfCollision(
          oldPos,
          newPos,
          player.getTrail() as Array<Position | null>
        )
      ) {
        player.kill();
        if (this.spatialHash) {
          this.spatialHash.removePlayer(player.id);
        }
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

    // Conectar al servidor si se usa red
    if (this.useNetwork && this.networkClient) {
      this.networkClient.connect();
      // Resetear delta decompressor al iniciar
      if (this.deltaDecompressor) {
        this.deltaDecompressor.reset();
      }
    }

    // Activar procesamiento de toques
    this.input.setGameActive(true);

    this.isRunning = true;
    this.gameState.gameStatus = "playing";
    this.lastFrameTime = 0; // Resetear tiempo
    this.lastInputSendTime = 0; // Resetear tiempo de último input enviado
    this.gameLoop();
  }

  /**
   * Detiene el juego
   */
  stop(): void {
    // Desactivar procesamiento de toques
    this.input.setGameActive(false);

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
    const alivePlayers = this.players.filter((p) => p.alive);

    if (alivePlayers.length <= 1) {
      this.gameState.gameStatus = "finished";
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
   * Obtiene el estado del boost del jugador local
   */
  /**
   * Obtiene el ancho del canvas
   */
  getCanvasWidth(): number {
    return this.canvas.getWidth();
  }

  getLocalPlayerBoostState(): {
    active: boolean;
    charge: number;
    remaining: number;
  } | null {
    if (this.useNetwork) {
      // En modo red, buscar por localPlayerId
      const localPlayer = this.players.find((p) => p.id === this.localPlayerId);
      if (localPlayer) {
        return localPlayer.getBoostState();
      }
    } else {
      // En modo local, usar el primer jugador
      if (this.players.length > 0) {
        return this.players[0].getBoostState();
      }
    }
    return null;
  }

  /**
   * Limpia recursos
   */
  destroy(): void {
    this.stop();
    this.input.destroy();
    if (this.networkClient) {
      this.networkClient.disconnect();
    }
  }

  /**
   * Obtiene el cliente de red (para verificar estado de conexión)
   */
  getNetworkClient(): NetworkClient | null {
    return this.networkClient;
  }

  /**
   * Obtiene el ID del jugador local
   */
  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  /**
   * Establece el ID del jugador local (útil cuando se recibe del servidor)
   */
  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
  }

  /**
   * Une al jugador al lobby del servidor
   */
  joinLobby(playerName: string, preferredColor?: string): void {
    if (!this.networkClient) return;
    const socketId = this.networkClient.getSocketId();
    if (socketId) {
      this.networkClient.joinGame(socketId, playerName, preferredColor);
    } else {
      // Si el socketId no está disponible, esperar un poco
      setTimeout(() => {
        const id = this.networkClient?.getSocketId();
        if (id) {
          this.networkClient?.joinGame(id, playerName, preferredColor);
        }
      }, 100);
    }
  }

  /**
   * Verifica si está usando red
   */
  isUsingNetwork(): boolean {
    return this.useNetwork;
  }

  /**
   * Obtiene el InputManager (para configurar callbacks de toques)
   */
  getInputManager(): InputManager {
    return this.input;
  }

  /**
   * Limpia todos los jugadores locales (útil al iniciar en modo red)
   */
  clearPlayers(): void {
    this.players = [];
    this.gameState.players = [];
  }

  /**
   * Sincroniza el estado desde el servidor
   * @param serverGameState - Estado del servidor
   * @param alreadyScaled - Si es true, las posiciones ya están escaladas (viene de delta compression)
   */
  private syncFromServer(
    serverGameState: GameState,
    alreadyScaled: boolean = false
  ): void {
    if (!this.useNetwork) return;

    // Actualizar gameState
    this.gameState = { ...serverGameState };

    // Sincronizar jugadores
    const serverPlayers = serverGameState.players;
    let newPlayersCount = 0;

    // Calcular escalado solo si es necesario
    const scaleX = alreadyScaled
      ? 1
      : this.canvas.getWidth() / this.serverCanvasWidth;
    const scaleY = alreadyScaled
      ? 1
      : this.canvas.getHeight() / this.serverCanvasHeight;

    // IMPORTANTE: Si no hay jugadores locales pero el servidor tiene jugadores,
    // limpiar cualquier jugador residual y crear todos desde cero
    // Esto asegura que todos los jugadores del servidor aparezcan correctamente
    if (this.players.length === 0 && serverPlayers.length > 0) {
      console.log(
        `🔄 Sincronización inicial: creando ${serverPlayers.length} jugadores desde el servidor`
      );
    }

    // Crear o actualizar jugadores desde el servidor
    for (const serverPlayer of serverPlayers) {
      let localPlayer = this.players.find((p) => p.id === serverPlayer.id);

      if (!localPlayer) {
        // Crear nuevo jugador si no existe
        console.log(
          `➕ Creando jugador ${serverPlayer.name} (${serverPlayer.id.substring(
            0,
            8
          )}...) desde servidor`
        );
        localPlayer = new Player(
          serverPlayer.id,
          serverPlayer.name,
          serverPlayer.color,
          {
            x: serverPlayer.position.x * scaleX,
            y: serverPlayer.position.y * scaleY,
          },
          serverPlayer.angle,
          serverPlayer.speed
        );
        // Escalar trail inicial si es necesario
        // IMPORTANTE: Preservar los nulls (gaps) del servidor
        localPlayer.trail = serverPlayer.trail.map((pos) =>
          pos
            ? {
                x: pos.x * scaleX,
                y: pos.y * scaleY,
              }
            : null
        );
        this.players.push(localPlayer);
        newPlayersCount++;
      }

      // En modo red, TODOS los jugadores (incluido el local) usan las posiciones del servidor
      // El servidor es la única autoridad

      // Actualizar posición y estado desde el servidor
      localPlayer.position = {
        x: serverPlayer.position.x * scaleX,
        y: serverPlayer.position.y * scaleY,
      };
      localPlayer.angle = serverPlayer.angle;
      localPlayer.speed = serverPlayer.speed;
      localPlayer.alive = serverPlayer.alive;
      // IMPORTANTE: Sincronizar el color desde el servidor
      // Esto permite que los cambios de color se reflejen durante el juego
      localPlayer.color = serverPlayer.color;

      // Actualizar trail (escalar solo si es necesario)
      // IMPORTANTE: Preservar los nulls (gaps) del servidor
      localPlayer.trail = serverPlayer.trail.map((pos) =>
        pos
          ? {
              x: pos.x * scaleX,
              y: pos.y * scaleY,
            }
          : null
      );

      // Sincronizar estado del boost desde el servidor
      if (serverPlayer.boost) {
        localPlayer.setBoostState(
          serverPlayer.boost.active,
          serverPlayer.boost.charge,
          serverPlayer.boost.remaining
        );
      }
    }

    // Remover jugadores que ya no están en el servidor
    const removedCount = this.players.length - serverPlayers.length;
    if (removedCount > 0) {
      console.log(
        `➖ Removiendo ${removedCount} jugador(es) que ya no están en el servidor`
      );
    }
    this.players = this.players.filter((p) =>
      serverPlayers.some((sp) => sp.id === p.id)
    );

    // Log de sincronización cada vez que se crean nuevos jugadores
    if (newPlayersCount > 0) {
      console.log(
        `✅ Sincronización: ${newPlayersCount} jugador(es) nuevo(s), total: ${this.players.length}`
      );
    }
  }
}
