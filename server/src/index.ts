// Punto de entrada del servidor
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PlayerManager } from './game/playerManager.js';
import { GameServer } from './game/gameServer.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from './shared/protocol.js';
import type { PlayerJoinMessage, GameInputMessage, GameStateMessage, LobbyPlayersMessage } from './shared/protocol.js';
import type { Player } from './shared/types.js';
import { DeltaCompressor } from './network/deltaCompression.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// Servir archivos estáticos (opcional)
app.use(express.json());

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'curve.io server is running' });
});

// Instancia del gestor de jugadores y game server
const playerManager = new PlayerManager();
const gameServer = new GameServer(playerManager, 1920, 1280);

// FASE 2: Delta Compression - Comprimir estados antes de enviar
const deltaCompressor = new DeltaCompressor();

// Mapa de socket.id -> playerId
const socketToPlayerId: Map<string, string> = new Map();

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
    
    // Crear jugador
    const player: Player = {
      id: playerId, // Usar socket.id como ID único
      name: message.name,
      color: '#ffffff', // Se asignará en initializePlayers
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
        { x: 1920 * 0.25, y: 1280 * 0.25 },
        { x: 1920 * 0.75, y: 1280 * 0.25 },
        { x: 1920 * 0.25, y: 1280 * 0.75 },
        { x: 1920 * 0.75, y: 1280 * 0.75 },
      ];
      const angles = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
      
      const index = players.length - 1;
      const posIndex = index % positions.length;
      player.position = { ...positions[posIndex] };
      player.angle = angles[posIndex];
      // Asignar un color que no esté en uso
      player.color = getAvailableColor(existingPlayers);
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
    gameServer.start();
    io.emit(SERVER_EVENTS.GAME_START, {});
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

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor curve.io corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`👥 Jugadores conectados: ${playerManager.getPlayerCount()}`);
});

