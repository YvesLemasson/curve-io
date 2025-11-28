// Punto de entrada del servidor
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PlayerManager } from './game/playerManager.js';
import { GameServer } from './game/gameServer.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from './shared/protocol.js';
import type { PlayerJoinMessage, GameInputMessage, GameStateMessage } from './shared/protocol.js';
import type { Player } from './shared/types.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
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

// Mapa de socket.id -> playerId
const socketToPlayerId: Map<string, string> = new Map();

// Configurar broadcast del game server
gameServer.onBroadcast((gameState) => {
  io.emit(SERVER_EVENTS.GAME_STATE, {
    gameState,
    serverTime: Date.now(),
  } as GameStateMessage);
});

// WebSocket connection
io.on('connection', (socket: Socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);

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
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
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
      player.color = colors[index % colors.length];
      console.log(`📍 Jugador ${message.name} posicionado en (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)})`);
    }
    
    // Confirmar conexión (enviar el playerId real que usamos)
    socket.emit(SERVER_EVENTS.PLAYER_JOINED, {
      playerId: playerId,
      socketId: socket.id,
    });
    
    // Si hay al menos 2 jugadores y el juego no está corriendo, iniciarlo
    if (playerManager.getPlayerCount() >= 2 && !gameServer.getGameState().gameStatus.includes('playing')) {
      console.log(`🚀 Iniciando juego con ${playerManager.getPlayerCount()} jugadores`);
      gameServer.start();
      io.emit(SERVER_EVENTS.GAME_START, {});
    }
  });

  // Manejar input del jugador
  socket.on(CLIENT_EVENTS.GAME_INPUT, (message: GameInputMessage) => {
    // Agregar input a la cola del game server
    gameServer.addInput(message);
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
    }
    
    // Si no quedan jugadores, detener el juego
    if (playerManager.getPlayerCount() === 0) {
      console.log(`🛑 No quedan jugadores, deteniendo juego`);
      gameServer.stop();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor curve.io corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`👥 Jugadores conectados: ${playerManager.getPlayerCount()}`);
});

