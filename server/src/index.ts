// Punto de entrada del servidor
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PlayerManager } from './game/playerManager';
import { CLIENT_EVENTS, SERVER_EVENTS, type PlayerJoinMessage, type GameInputMessage } from '@shared/protocol';

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

// Instancia del gestor de jugadores
const playerManager = new PlayerManager();

// WebSocket connection
io.on('connection', (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);

  // Manejar unión de jugador
  socket.on(CLIENT_EVENTS.PLAYER_JOIN, (message: PlayerJoinMessage) => {
    console.log(`Jugador ${message.name} (${message.playerId}) intenta unirse`);
    
    // TODO: Validar y crear jugador
    // Por ahora solo confirmamos la conexión
    socket.emit(SERVER_EVENTS.PLAYER_JOINED, {
      playerId: message.playerId,
      socketId: socket.id,
    });
  });

  // Manejar input del jugador
  socket.on(CLIENT_EVENTS.GAME_INPUT, (message: GameInputMessage) => {
    // TODO: Procesar input y agregar a cola
    console.log(`Input recibido de ${message.playerId}: ${message.key}`);
  });

  // Manejar desconexión
  socket.on('disconnect', (reason) => {
    console.log(`❌ Cliente desconectado: ${socket.id} (${reason})`);
    
    // Remover jugador si existe
    // TODO: Buscar jugador por socketId y removerlo
    playerManager.clear(); // Temporal: limpiar todos (se mejorará en Fase 3)
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor curve.io corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`👥 Jugadores conectados: ${playerManager.getPlayerCount()}`);
});

