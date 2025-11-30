// Punto de entrada del servidor
// Cargar variables de entorno primero
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PlayerManager } from './game/playerManager.js';
import { GameServer } from './game/gameServer.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from './shared/protocol.js';
import type { PlayerJoinMessage, GameInputMessage, GameStateMessage, LobbyPlayersMessage, AuthUserMessage } from './shared/protocol.js';
import type { Player } from './shared/types.js';
import { DeltaCompressor } from './network/deltaCompression.js';
import { GameModel } from './models/gameModel.js';

const app = express();
const httpServer = createServer(app);

// Configurar CORS para permitir múltiples orígenes
const allowedOrigins: string[] = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://curveio.netlify.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const MAX_PLAYERS = 8; // Máximo de jugadores permitidos en una partida

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        console.warn(`⚠️  Origen no permitido: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Permitir ambos transportes
});

// Servir archivos estáticos (opcional)
app.use(express.json());

// Ruta de salud (para verificar que el servidor está corriendo)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'curve.io server is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Ruta raíz también responde (útil para Railway health checks)
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'curve.io server is running',
    endpoints: {
      health: '/health',
      websocket: `ws://0.0.0.0:${PORT}`
    }
  });
});

// Instancia del gestor de jugadores y game server
const playerManager = new PlayerManager();
const gameServer = new GameServer(playerManager, 1920, 1280);

// FASE 2: Delta Compression - Comprimir estados antes de enviar
const deltaCompressor = new DeltaCompressor();

// Mapa de socket.id -> playerId
const socketToPlayerId: Map<string, string> = new Map();
// Mapa de socket.id -> user_id (Supabase)
const socketToUserId: Map<string, string> = new Map();
// ID de la partida actual (null si no hay partida activa)
let currentGameId: string | null = null;

// Función para encontrar un color disponible que no esté en uso
function getAvailableColor(existingPlayers: Player[]): string {
  const availableColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  const usedColors = new Set(existingPlayers.map(p => p.color));
  
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

// Función para enviar lista de jugadores en el lobby a todos los clientes
function broadcastLobbyPlayers(): void {
  const players = playerManager.getAllPlayers();
  const lobbyPlayers: LobbyPlayersMessage = {
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
    })),
  };
  io.emit(SERVER_EVENTS.LOBBY_PLAYERS, lobbyPlayers);
}

// Configurar callback cuando el juego termina para guardar en Supabase
gameServer.onGameEnd(async (gameState) => {
  if (!currentGameId) {
    console.log('⚠️  No hay partida activa para guardar');
    return;
  }

  try {
    // Obtener todos los jugadores ordenados por si están vivos (ganador primero)
    const allPlayers = playerManager.getAllPlayers();
    const winnerId = gameState.winnerId;
    
    // Ordenar jugadores: ganador primero, luego los eliminados
    const sortedPlayers = allPlayers.sort((a, b) => {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
      if (a.alive && !b.alive) return -1;
      if (!a.alive && b.alive) return 1;
      return 0;
    });

    // Mapear jugadores a participantes con user_id
    const participants = sortedPlayers
      .map((player, index) => {
        const socketId = Array.from(socketToPlayerId.entries())
          .find(([_, pid]) => pid === player.id)?.[0];
        const userId = socketId ? socketToUserId.get(socketId) : null;
        
        // Si no hay user_id, no guardar este participante (jugador no autenticado)
        if (!userId) {
          console.log(`⚠️  Jugador ${player.name} no tiene user_id, omitiendo del guardado`);
          return null;
        }

        return {
          userId,
          score: player.alive ? 100 : 0, // Score simple: 100 si está vivo, 0 si murió
          position: index + 1, // 1 = ganador, 2 = segundo, etc.
        };
      })
      .filter((p): p is { userId: string; score: number; position: number } => p !== null);

    // Obtener user_id del ganador
    const winnerSocketId = Array.from(socketToPlayerId.entries())
      .find(([_, pid]) => pid === winnerId)?.[0];
    const winnerUserId = winnerSocketId ? socketToUserId.get(winnerSocketId) : null;

    if (participants.length > 0) {
      await GameModel.endGame(currentGameId, participants, winnerUserId || null);
      console.log(`✅ Partida ${currentGameId} guardada exitosamente con ${participants.length} participantes`);
    } else {
      console.log('⚠️  No hay participantes autenticados para guardar');
    }
  } catch (error) {
    console.error('❌ Error al guardar partida:', error);
  } finally {
    // Limpiar gameId después de guardar
    currentGameId = null;
  }
});

// Configurar broadcast del game server
// FASE 2: Delta Compression - Comprimir estado antes de enviar
gameServer.onBroadcast((gameState) => {
  // Comprimir el estado (devuelve delta o estado completo según corresponda)
  const delta = deltaCompressor.compress(gameState);
  
  // Enviar delta comprimido en lugar de estado completo
  io.emit(SERVER_EVENTS.GAME_STATE, {
    delta, // Enviar delta comprimido
    serverTime: Date.now(),
  } as GameStateMessage);
  
  // Log cada 60 ticks para monitorear compresión
  if (gameState.tick % 60 === 0) {
    const isFullState = delta.fullState || false;
    const playersWithChanges = delta.players.length;
    const totalPlayers = gameState.players.length;
    
    // MEDICIÓN DE RENDIMIENTO: Tamaño del mensaje delta
    const deltaSize = JSON.stringify(delta).length;
    const deltaSizeKB = (deltaSize / 1024).toFixed(2);
    
    console.log(`📦 Delta Compression | Tick: ${gameState.tick} | Full: ${isFullState} | Changes: ${playersWithChanges}/${totalPlayers} players | Size: ${deltaSizeKB} KB`);
  }
  
  // MEDICIÓN DE RENDIMIENTO: Estadísticas detalladas cada 5 segundos
  if (gameState.tick % 300 === 0 && gameState.tick > 0) {
    const deltaSize = JSON.stringify(delta).length;
    const deltaSizeKB = (deltaSize / 1024).toFixed(2);
    
    // Calcular tamaño total de trails en el delta
    const totalTrailPointsInDelta = delta.players.reduce((sum, p) => {
      return sum + (p.trailNew?.length || 0);
    }, 0);
    
    console.log(`📊 RENDIMIENTO [Tick ${gameState.tick}] - Delta Compression:`);
    console.log(`   Tamaño mensaje: ${deltaSizeKB} KB`);
    console.log(`   Puntos de trail en delta: ${totalTrailPointsInDelta}`);
    console.log(`   Jugadores con cambios: ${delta.players.length}/${gameState.players.length}`);
  }
});

// WebSocket connection
io.on('connection', (socket: Socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);
  
  // Enviar lista actual de jugadores cuando alguien se conecta (por si acaso ya hay jugadores)
  // Esto ayuda a que el cliente reciba la lista incluso si se conecta después de otros jugadores
  setTimeout(() => {
    broadcastLobbyPlayers();
  }, 100);

  // Manejar autenticación de usuario (user_id de Supabase)
  socket.on(CLIENT_EVENTS.AUTH_USER, (message: AuthUserMessage) => {
    socketToUserId.set(socket.id, message.userId);
    console.log(`🔐 Usuario autenticado: ${message.userId} (socket: ${socket.id})`);
  });

  // Manejar unión de jugador
  socket.on(CLIENT_EVENTS.PLAYER_JOIN, (message: PlayerJoinMessage) => {
    console.log(`👤 Jugador ${message.name} (${message.playerId}) intenta unirse`);
    
    // Usar socket.id como ID único del jugador (más confiable que el que envía el cliente)
    const playerId = socket.id;
    
    // Verificar si el jugador ya existe
    if (playerManager.hasPlayer(playerId)) {
      console.log(`⚠️  Jugador ${playerId} ya existe, ignorando unión duplicada`);
      return;
    }
    
    // Verificar límite de jugadores
    const currentPlayerCount = playerManager.getPlayerCount();
    if (currentPlayerCount >= MAX_PLAYERS) {
      console.log(`⚠️  Intento de unirse con ${MAX_PLAYERS} jugadores ya conectados`);
      socket.emit(SERVER_EVENTS.ERROR, `El juego está lleno. Máximo ${MAX_PLAYERS} jugadores permitidos.`);
      return;
    }
    
    // Obtener color preferido del mensaje o asignar uno disponible
    const existingPlayers = playerManager.getAllPlayers();
    let initialColor = '#ffffff';
    
    if (message.preferredColor) {
      // Verificar si el color preferido está disponible
      const colorInUse = existingPlayers.some(p => p.color === message.preferredColor);
      if (!colorInUse) {
        initialColor = message.preferredColor;
        console.log(`🎨 Usando color preferido ${initialColor} para ${message.name}`);
      } else {
        // Color preferido está en uso, asignar uno disponible
        initialColor = getAvailableColor(existingPlayers);
        console.log(`⚠️  Color preferido ${message.preferredColor} está en uso, asignando ${initialColor} a ${message.name}`);
      }
    } else {
      // No hay color preferido, asignar uno disponible
      initialColor = getAvailableColor(existingPlayers);
      console.log(`🎨 Asignando color ${initialColor} a ${message.name} (sin preferencia)`);
    }
    
    // Crear jugador
    const player: Player = {
      id: playerId, // Usar socket.id como ID único
      name: message.name,
      color: initialColor,
      position: { x: 0, y: 0 }, // Se inicializará en initializePlayers
      angle: 0,
      speed: 2,
      alive: true,
      trail: [],
    };
    
    playerManager.addPlayer(player);
    socketToPlayerId.set(socket.id, playerId);
    
    console.log(`✅ Jugador ${message.name} (${playerId}) agregado. Total: ${playerManager.getPlayerCount()}`);
    
    // Si es el primer jugador, inicializar posiciones
    if (playerManager.getPlayerCount() === 1) {
      gameServer.initializePlayers();
      console.log(`🎯 Primer jugador, inicializando posiciones`);
    } else {
      // Si ya hay jugadores, inicializar este jugador en una posición
      const players = playerManager.getAllPlayers();
      // Obtener todos los jugadores excepto el que acabamos de agregar (para verificar colores usados)
      const existingPlayers = players.filter(p => p.id !== playerId);
      const positions = [
        { x: 1920 * 0.25, y: 1280 * 0.25 },   // Esquina superior izquierda
        { x: 1920 * 0.75, y: 1280 * 0.25 },   // Esquina superior derecha
        { x: 1920 * 0.25, y: 1280 * 0.75 },   // Esquina inferior izquierda
        { x: 1920 * 0.75, y: 1280 * 0.75 },   // Esquina inferior derecha
        { x: 1920 * 0.5, y: 1280 * 0.25 },    // Centro superior
        { x: 1920 * 0.5, y: 1280 * 0.75 },    // Centro inferior
        { x: 1920 * 0.25, y: 1280 * 0.5 },    // Centro izquierdo
        { x: 1920 * 0.75, y: 1280 * 0.5 },    // Centro derecho
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
      
      const index = players.length - 1;
      const posIndex = index % positions.length;
      player.position = { ...positions[posIndex] };
      player.angle = angles[posIndex];
      
      // Usar color preferido si está disponible, sino asignar uno disponible
      if (message.preferredColor && !existingPlayers.some(p => p.color === message.preferredColor)) {
        player.color = message.preferredColor;
        console.log(`🎨 Usando color preferido ${player.color} para ${message.name}`);
      } else {
        player.color = getAvailableColor(existingPlayers);
        if (message.preferredColor) {
          console.log(`⚠️  Color preferido ${message.preferredColor} está en uso, asignando ${player.color} a ${message.name}`);
        } else {
          console.log(`🎨 Asignando color ${player.color} a ${message.name}`);
        }
      }
      
      player.trail = [{ ...positions[posIndex] }]; // Inicializar trail con posición inicial
      
      // Inicializar estado de gaps para este jugador
      gameServer.initializePlayerGaps(playerId);
      
      console.log(`📍 Jugador ${message.name} posicionado en (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)}) con color ${player.color}`);
    }
    
    // Confirmar conexión (enviar el playerId real que usamos)
    socket.emit(SERVER_EVENTS.PLAYER_JOINED, {
      playerId: playerId,
      socketId: socket.id,
    });
    
    // Enviar lista actualizada de jugadores en el lobby a todos los clientes
    broadcastLobbyPlayers();
  });

  // Manejar solicitud de inicio del juego
  socket.on(CLIENT_EVENTS.REQUEST_START, () => {
    const playerCount = playerManager.getPlayerCount();
    const gameStatus = gameServer.getGameState().gameStatus;
    
    if (gameStatus.includes('playing')) {
      console.log(`⚠️  Intento de iniciar juego que ya está corriendo`);
      socket.emit(SERVER_EVENTS.ERROR, 'El juego ya está en curso');
      return;
    }
    
    if (playerCount < 2) {
      console.log(`⚠️  Intento de iniciar juego con menos de 2 jugadores (${playerCount})`);
      socket.emit(SERVER_EVENTS.ERROR, 'Se necesitan al menos 2 jugadores para iniciar');
      return;
    }
    
    console.log(`🚀 Iniciando juego con ${playerCount} jugadores (solicitado por ${socket.id})`);
    
    // Crear partida en Supabase
    GameModel.createGame()
      .then((gameId) => {
        currentGameId = gameId;
        console.log(`📝 Partida creada en Supabase: ${gameId}`);
      })
      .catch((error) => {
        console.error('❌ Error al crear partida en Supabase:', error);
        // Continuar con el juego aunque falle el guardado
      });
    
    // Iniciar el game loop (sin enviar estado inicial todavía)
    gameServer.start(false);
    
    // Emitir GAME_START a todos los clientes primero
    io.emit(SERVER_EVENTS.GAME_START, {});
    console.log(`📢 GAME_START emitido a todos los clientes`);
    
    // IMPORTANTE: Enviar el estado inicial DESPUÉS de emitir GAME_START
    // Esto da tiempo a los clientes para prepararse (game.start()) antes de recibir el estado
    // El delay asegura que los clientes hayan procesado GAME_START y estén listos
    setTimeout(() => {
      gameServer.sendInitialState();
    }, 100); // Delay suficiente para que los clientes procesen GAME_START
  });

  // Manejar solicitud de siguiente ronda
  socket.on(CLIENT_EVENTS.REQUEST_NEXT_ROUND, () => {
    const gameState = gameServer.getGameState();
    const gameStatus = gameState.gameStatus;
    
    console.log(`📥 Solicitud de siguiente ronda recibida de ${socket.id}`);
    console.log(`   Estado actual: ${gameStatus}`);
    console.log(`   Ronda actual: ${gameState.currentRound}/${gameState.totalRounds}`);
    console.log(`   Countdown: ${gameState.nextRoundCountdown}`);
    
    if (gameStatus !== 'round-ended') {
      console.log(`⚠️  Intento de solicitar siguiente ronda cuando el estado es ${gameStatus}`);
      socket.emit(SERVER_EVENTS.ERROR, 'No se puede solicitar siguiente ronda en este momento');
      return;
    }
    
    console.log(`⏭️  Procesando solicitud de siguiente ronda...`);
    gameServer.requestNextRound();
  });

  // Manejar input del jugador
  socket.on(CLIENT_EVENTS.GAME_INPUT, (message: GameInputMessage) => {
    // Agregar input a la cola del game server
    gameServer.addInput(message);
  });

  // Manejar cambio de color del jugador
  socket.on(CLIENT_EVENTS.CHANGE_COLOR, (message: { playerId: string; color: string }) => {
    const playerId = socket.id; // Usar socket.id como ID del jugador (más seguro)
    
    // Verificar que el jugador existe
    if (!playerManager.hasPlayer(playerId)) {
      console.log(`⚠️  Intento de cambiar color de jugador inexistente: ${playerId}`);
      socket.emit(SERVER_EVENTS.ERROR, 'Jugador no encontrado');
      return;
    }

    const player = playerManager.getPlayer(playerId);
    if (!player) {
      socket.emit(SERVER_EVENTS.ERROR, 'Jugador no encontrado');
      return;
    }

    // Verificar que el color no esté en uso por otro jugador
    const allPlayers = playerManager.getAllPlayers();
    const colorInUse = allPlayers.some(p => p.id !== playerId && p.color === message.color);
    
    if (colorInUse) {
      console.log(`⚠️  Intento de usar color ya en uso: ${message.color} por ${playerId}`);
      socket.emit(SERVER_EVENTS.ERROR, 'Este color ya está en uso por otro jugador');
      return;
    }

    // Cambiar el color del jugador
    player.color = message.color;
    console.log(`🎨 Jugador ${player.name} (${playerId}) cambió su color a ${message.color}`);
    
    // Enviar lista actualizada de jugadores en el lobby a todos los clientes
    broadcastLobbyPlayers();
  });

  // Manejar desconexión
  socket.on('disconnect', (reason) => {
    console.log(`❌ Cliente desconectado: ${socket.id} (${reason})`);
    
    // Remover jugador
    const playerId = socketToPlayerId.get(socket.id);
    if (playerId) {
      const player = playerManager.getPlayer(playerId);
      playerManager.removePlayer(playerId);
      socketToPlayerId.delete(socket.id);
      console.log(`🗑️  Jugador ${player?.name || playerId} removido. Total: ${playerManager.getPlayerCount()}`);
      
      // Enviar lista actualizada de jugadores en el lobby
      broadcastLobbyPlayers();
    }
    
    // Si no quedan jugadores, detener el juego
    if (playerManager.getPlayerCount() === 0) {
      console.log(`🛑 No quedan jugadores, deteniendo juego`);
      gameServer.stop();
      // Resetear delta compressor cuando se detiene el juego
      deltaCompressor.reset();
    }
  });
});

// Escuchar en todas las interfaces (0.0.0.0) para que funcione en Railway/cloud
// Railway asigna el puerto automáticamente, así que usamos process.env.PORT
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor curve.io corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://0.0.0.0:${PORT} (escuchando en todas las interfaces)`);
  console.log(`🌐 Orígenes permitidos: ${allowedOrigins.join(', ')}`);
  console.log(`👥 Jugadores conectados: ${playerManager.getPlayerCount()}`);
  console.log(`✅ Servidor listo para recibir conexiones`);
});

