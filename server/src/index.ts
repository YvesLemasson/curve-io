// Punto de entrada del servidor
// Cargar variables de entorno primero
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { CLIENT_EVENTS, SERVER_EVENTS } from './shared/protocol.js';
import type { PlayerJoinMessage, GameInputMessage, GameStateMessage, LobbyPlayersMessage, AuthUserMessage } from './shared/protocol.js';
import type { Player } from './shared/types.js';
import { GameModel } from './models/gameModel.js';
import { UserModel } from './models/userModel.js';
import { PremiumModel } from './models/premiumModel.js';
import { supabase } from './config/supabase.js';
import { MatchmakingManager } from './matchmaking/matchmakingManager.js';

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

// Mapa de socket.id -> playerId (para cada sala)
const socketToPlayerId: Map<string, string> = new Map();
// Mapa de socket.id -> user_id (Supabase)
const socketToUserId: Map<string, string> = new Map();
// Mapa de socket.id -> roomId (para saber en qué sala está cada socket)
const socketToRoomId: Map<string, string> = new Map();

// Función para encontrar un color disponible que no esté en uso
// Solo usa los 8 colores básicos gratuitos (el resto se compra)
function getAvailableColor(existingPlayers: Player[]): string {
  const availableColors = [
    '#ff0000', // Rojo
    '#00ff00', // Verde
    '#0000ff', // Azul
    '#ffff00', // Amarillo
    '#ff00ff', // Magenta
    '#00ffff', // Cyan
    '#ff8000', // Naranja
    '#8000ff', // Morado
  ];
  const usedColors = new Set(existingPlayers.map(p => p.color));
  
  // Buscar el primer color disponible que no esté en uso
  for (const color of availableColors) {
    if (!usedColors.has(color)) {
      return color;
    }
  }
  
  // Si todos los 8 colores básicos están en uso, usar el primero (puede haber duplicados)
  // En este caso, el jugador debería comprar más colores
  return availableColors[0];
}

// Función para enviar lista de jugadores en el lobby a una sala específica
async function broadcastLobbyPlayers(roomId: string): Promise<void> {
  const room = matchmakingManager.getRoom(roomId);
  if (!room) {
    console.warn(`⚠️  Intento de broadcast a sala inexistente: ${roomId}`);
    return;
  }

  const players = room.playerManager.getAllPlayers();
  
  // Obtener ELO de cada jugador autenticado
  const playersWithElo = await Promise.all(
    players.map(async (p) => {
      // Buscar socketId del playerId
      const socketId = Array.from(socketToPlayerId.entries())
        .find(([_, pid]) => pid === p.id)?.[0];
      const userId = socketId ? socketToUserId.get(socketId) : undefined;
      let elo_rating: number | undefined = undefined;
      
      if (userId) {
        try {
          const { data, error } = await supabase
            .from('player_stats')
            .select('elo_rating')
            .eq('user_id', userId)
            .single();
          
          if (!error && data) {
            elo_rating = data.elo_rating ?? 1000;
          }
        } catch (err) {
          // Si hay error, no incluir ELO
        }
      }
      
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        elo_rating,
      };
    })
  );
  
  const lobbyPlayers: LobbyPlayersMessage = {
    players: playersWithElo,
  };
  
  // Broadcast solo a esta sala
  io.to(roomId).emit(SERVER_EVENTS.LOBBY_PLAYERS, lobbyPlayers);
}

// Sistema de matchmaking - gestiona múltiples salas de juego
const matchmakingManager = new MatchmakingManager(io);

// Función helper para guardar partida cuando termina
async function saveGameOnEnd(roomId: string, gameState: any): Promise<void> {
  const room = matchmakingManager.getRoom(roomId);
  if (!room || !room.gameId) {
    console.log(`⚠️  [${roomId}] No hay partida activa para guardar`);
    return;
  }

  try {
    // Obtener todos los jugadores ordenados por si están vivos (ganador primero)
    const allPlayers = room.playerManager.getAllPlayers();
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
      .map((player, originalIndex) => {
        const socketId = Array.from(socketToPlayerId.entries())
          .find(([_, pid]) => pid === player.id)?.[0];
        const userId = socketId ? socketToUserId.get(socketId) : null;
        
        // Si no hay user_id, no guardar este participante (jugador no autenticado)
        if (!userId) {
          console.log(`⚠️  [${roomId}] Jugador ${player.name} no tiene user_id, omitiendo del guardado`);
          return null;
        }

        return {
          userId,
          score: player.alive ? 100 : 0,
          position: originalIndex + 1,
        };
      })
      .filter((p): p is { userId: string; score: number; position: number } => p !== null);

    // Obtener user_id del ganador
    const winnerSocketId = Array.from(socketToPlayerId.entries())
      .find(([_, pid]) => pid === winnerId)?.[0];
    const winnerUserId = winnerSocketId ? socketToUserId.get(winnerSocketId) : null;

    if (participants.length > 0) {
      const totalPlayers = allPlayers.length;
      await GameModel.endGame(room.gameId, participants, winnerUserId || null, totalPlayers);
      console.log(`✅ [${roomId}] Partida ${room.gameId} guardada exitosamente con ${participants.length} participantes autenticados de ${totalPlayers} jugadores totales`);
    } else {
      console.log(`⚠️  [${roomId}] No hay participantes autenticados para guardar`);
    }
  } catch (error) {
    console.error(`❌ [${roomId}] Error al guardar partida:`, error);
  }
}

// Configurar callback para guardar partidas cuando terminan
matchmakingManager.setOnGameEndCallback(async (roomId: string, gameState: any) => {
  await saveGameOnEnd(roomId, gameState);
});

// WebSocket connection
io.on('connection', (socket: Socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);
  
  // Nota: No enviamos lista de jugadores al conectar porque el jugador aún no está en una sala
  // Se enviará después de que se una a una sala en PLAYER_JOIN

  // Manejar autenticación de usuario (user_id de Supabase)
  socket.on(CLIENT_EVENTS.AUTH_USER, (message: AuthUserMessage) => {
    socketToUserId.set(socket.id, message.userId);
    console.log(`🔐 Usuario autenticado: ${message.userId} (socket: ${socket.id})`);
  });

  // Manejar unión de jugador
  socket.on(CLIENT_EVENTS.PLAYER_JOIN, async (message: PlayerJoinMessage) => {
    console.log(`👤 Jugador ${message.name} (${message.playerId}) intenta unirse`);
    
    // Usar socket.id como ID único del jugador (más confiable que el que envía el cliente)
    const playerId = socket.id;
    
    // 1. Buscar o crear sala disponible
    const room = matchmakingManager.findOrCreateRoom();
    const roomId = room.roomId;
    
    // Verificar si el jugador ya existe en esta sala
    if (room.playerManager.hasPlayer(playerId)) {
      console.log(`⚠️  [${roomId}] Jugador ${playerId} ya existe en esta sala, ignorando unión duplicada`);
      return;
    }
    
    // Verificar límite de jugadores en esta sala
    if (room.currentPlayers >= room.maxPlayers) {
      console.log(`⚠️  [${roomId}] Intento de unirse con ${room.maxPlayers} jugadores ya conectados`);
      socket.emit(SERVER_EVENTS.ERROR, `El juego está lleno. Máximo ${room.maxPlayers} jugadores permitidos.`);
      return;
    }
    
    // 2. Unir socket al room de Socket.IO
    socket.join(roomId);
    socketToRoomId.set(socket.id, roomId);
    
    // 3. Crear partida en Supabase si es el primer jugador de la sala
    if (!room.gameId && room.currentPlayers === 0) {
      try {
        room.gameId = await GameModel.findOrCreateWaitingGame();
        console.log(`📝 [${roomId}] Partida asignada para el lobby: ${room.gameId}`);
      } catch (error) {
        console.error(`❌ [${roomId}] Error al buscar/crear partida:`, error);
        // Continuar sin partida (el juego funcionará pero no se guardará)
      }
    }
    
    // 4. Obtener color preferido del mensaje o asignar uno disponible
    const existingPlayers = room.playerManager.getAllPlayers();
    let initialColor = '#ffffff';
    
    if (message.preferredColor) {
      // Verificar si el color preferido está disponible
      const colorInUse = existingPlayers.some(p => p.color === message.preferredColor);
      if (!colorInUse) {
        initialColor = message.preferredColor;
        console.log(`🎨 [${roomId}] Usando color preferido ${initialColor} para ${message.name}`);
      } else {
        // Color preferido está en uso, asignar uno disponible
        initialColor = getAvailableColor(existingPlayers);
        console.log(`⚠️  [${roomId}] Color preferido ${message.preferredColor} está en uso, asignando ${initialColor} a ${message.name}`);
      }
    } else {
      // No hay color preferido, asignar uno disponible
      initialColor = getAvailableColor(existingPlayers);
      console.log(`🎨 [${roomId}] Asignando color ${initialColor} a ${message.name} (sin preferencia)`);
    }
    
    // 5. Si el usuario está autenticado, asegurar que su nombre esté guardado en la BD
    const userId = socketToUserId.get(socket.id);
    if (userId && message.name) {
      // Usuario autenticado - guardar nombre en BD si no existe
      try {
        await UserModel.ensureUserHasName(userId, message.name);
      } catch (error) {
        console.error(`❌ [${roomId}] Error al guardar nombre del usuario ${userId}:`, error);
        // Continuar aunque falle (no queremos bloquear el juego)
      }
    }
    
    // 6. Obtener trail equipado del usuario (si está autenticado)
    let equippedTrail: { trailType: string; trailEffect: any } | null = null;
    if (userId) {
      try {
        const trail = await PremiumModel.getEquippedTrail(userId);
        if (trail) {
          // Determinar el tipo de trail basado en el nombre
          const trailName = trail.name.toLowerCase();
          let trailType: string = 'normal';
          let trailEffect: any = {};

          if (trailName.includes('fire') || trailName.includes('inferno') || trailName.includes('hellfire')) {
            // Trail de fuego
            trailType = 'fire';
            trailEffect = {
              glowIntensity: 4, // Resplandor del fuego
            };
          } else if (trailName.includes('particle')) {
            // Trail de partículas
            trailType = 'particles';
            trailEffect = {
              particleCount: 20, // Espaciado entre partículas en píxeles
              particleSize: 3,
              trailColor: trail.color_value, // Color del trail desde el item premium
            };
          }

          equippedTrail = {
            trailType,
            trailEffect,
          };
        }
      } catch (error) {
        console.error(`❌ [${roomId}] Error al obtener trail equipado para ${userId}:`, error);
        // Continuar sin trail premium si hay error
      }
    }

    // 7. Crear jugador
    const player: Player = {
      id: playerId,
      name: message.name,
      color: initialColor,
      position: { x: 0, y: 0 }, // Se inicializará en initializePlayers
      angle: 0,
      speed: 2,
      alive: true,
      trail: [],
      trailType: equippedTrail?.trailType || 'normal', // Usar trail equipado o normal por defecto
      trailEffect: equippedTrail?.trailEffect,
    };
    
    // 7. Agregar jugador a la sala
    room.playerManager.addPlayer(player);
    socketToPlayerId.set(socket.id, playerId);
    matchmakingManager.incrementPlayerCount(roomId);
    
    console.log(`✅ [${roomId}] Jugador ${message.name} (${playerId}) agregado. Total: ${room.currentPlayers}/${room.maxPlayers}`);
    
    // 7. Inicializar posiciones
    if (room.currentPlayers === 1) {
      // Primer jugador de la sala
      room.gameServer.initializePlayers();
      console.log(`🎯 [${roomId}] Primer jugador, inicializando posiciones`);
    } else {
      // Ya hay jugadores, inicializar este jugador en una posición
      const players = room.playerManager.getAllPlayers();
      const existingPlayersForColor = players.filter(p => p.id !== playerId);
      const positions = [
        { x: 1920 * 0.25, y: 1280 * 0.25 },
        { x: 1920 * 0.75, y: 1280 * 0.25 },
        { x: 1920 * 0.25, y: 1280 * 0.75 },
        { x: 1920 * 0.75, y: 1280 * 0.75 },
        { x: 1920 * 0.5, y: 1280 * 0.25 },
        { x: 1920 * 0.5, y: 1280 * 0.75 },
        { x: 1920 * 0.25, y: 1280 * 0.5 },
        { x: 1920 * 0.75, y: 1280 * 0.5 },
      ];
      const angles = [
        0, Math.PI, Math.PI / 2, -Math.PI / 2,
        Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4,
      ];
      
      const index = players.length - 1;
      const posIndex = index % positions.length;
      player.position = { ...positions[posIndex] };
      player.angle = angles[posIndex];
      
      // Asegurar color correcto
      if (message.preferredColor && !existingPlayersForColor.some(p => p.color === message.preferredColor)) {
        player.color = message.preferredColor;
      } else {
        player.color = getAvailableColor(existingPlayersForColor);
      }
      
      player.trail = [{ ...positions[posIndex] }];
      room.gameServer.initializePlayerGaps(playerId);
      
      console.log(`📍 [${roomId}] Jugador ${message.name} posicionado en (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)}) con color ${player.color}`);
    }
    
    // 8. Confirmar conexión
    socket.emit(SERVER_EVENTS.PLAYER_JOINED, {
      playerId: playerId,
      socketId: socket.id,
    });
    
    // 9. Enviar lista actualizada de jugadores solo a esta sala
    broadcastLobbyPlayers(roomId).catch(err => console.error(`[${roomId}] Error broadcasting lobby players:`, err));
  });

  // Manejar solicitud de inicio del juego
  socket.on(CLIENT_EVENTS.REQUEST_START, async () => {
    // Obtener sala del socket
    const roomId = socketToRoomId.get(socket.id);
    if (!roomId) {
      console.log(`⚠️  Socket ${socket.id} no está en ninguna sala`);
      socket.emit(SERVER_EVENTS.ERROR, 'No estás en una sala');
      return;
    }

    const room = matchmakingManager.getRoom(roomId);
    if (!room) {
      console.log(`⚠️  [${roomId}] Sala no encontrada`);
      socket.emit(SERVER_EVENTS.ERROR, 'Sala no encontrada');
      return;
    }

    const playerCount = room.playerManager.getPlayerCount();
    const gameStatus = room.gameServer.getGameState().gameStatus;
    
    if (gameStatus.includes('playing')) {
      console.log(`⚠️  [${roomId}] Intento de iniciar juego que ya está corriendo`);
      socket.emit(SERVER_EVENTS.ERROR, 'El juego ya está en curso');
      return;
    }
    
    if (playerCount < 2) {
      console.log(`⚠️  [${roomId}] Intento de iniciar juego con menos de 2 jugadores (${playerCount})`);
      socket.emit(SERVER_EVENTS.ERROR, 'Se necesitan al menos 2 jugadores para iniciar');
      return;
    }
    
    console.log(`🚀 [${roomId}] Iniciando juego con ${playerCount} jugadores (solicitado por ${socket.id})`);
    
    // Actualizar partida en Supabase a estado "playing" o crear una nueva si no existe
    const totalPlayers = room.playerManager.getPlayerCount();
    if (room.gameId) {
      // Actualizar la partida existente a estado "playing"
      try {
        await GameModel.startGame(room.gameId, totalPlayers);
        console.log(`📝 [${roomId}] Partida ${room.gameId} actualizada a "playing" con ${totalPlayers} jugadores`);
        matchmakingManager.startRoom(roomId, room.gameId);
      } catch (error) {
        console.error(`❌ [${roomId}] Error al actualizar partida:`, error);
        // Intentar crear una nueva partida
        try {
          const newGameId = await GameModel.createGame(totalPlayers);
          room.gameId = newGameId;
          matchmakingManager.startRoom(roomId, newGameId);
          console.log(`📝 [${roomId}] Nueva partida creada: ${newGameId} con ${totalPlayers} jugadores`);
        } catch (err) {
          console.error(`❌ [${roomId}] Error al crear partida:`, err);
        }
      }
    } else {
      // Si no hay partida, crear una nueva
      try {
        const gameId = await GameModel.createGame(totalPlayers);
        room.gameId = gameId;
        matchmakingManager.startRoom(roomId, gameId);
        console.log(`📝 [${roomId}] Partida creada en Supabase: ${gameId} con ${totalPlayers} jugadores`);
      } catch (error) {
        console.error(`❌ [${roomId}] Error al crear partida en Supabase:`, error);
        // Continuar con el juego aunque falle el guardado
      }
    }
    
    // Iniciar el game loop de esta sala (sin enviar estado inicial todavía)
    room.gameServer.start(false);
    
    // Emitir GAME_START solo a esta sala
    io.to(roomId).emit(SERVER_EVENTS.GAME_START, {});
    console.log(`📢 [${roomId}] GAME_START emitido a la sala`);
    
    // Enviar el estado inicial DESPUÉS de emitir GAME_START
    setTimeout(() => {
      room.gameServer.sendInitialState();
    }, 100);
  });

  // Manejar solicitud de siguiente ronda
  socket.on(CLIENT_EVENTS.REQUEST_NEXT_ROUND, () => {
    const roomId = socketToRoomId.get(socket.id);
    if (!roomId) {
      socket.emit(SERVER_EVENTS.ERROR, 'No estás en una sala');
      return;
    }

    const room = matchmakingManager.getRoom(roomId);
    if (!room) {
      socket.emit(SERVER_EVENTS.ERROR, 'Sala no encontrada');
      return;
    }

    const gameState = room.gameServer.getGameState();
    const gameStatus = gameState.gameStatus;
    
    console.log(`📥 [${roomId}] Solicitud de siguiente ronda recibida de ${socket.id}`);
    console.log(`   Estado actual: ${gameStatus}`);
    console.log(`   Ronda actual: ${gameState.currentRound}/${gameState.totalRounds}`);
    console.log(`   Countdown: ${gameState.nextRoundCountdown}`);
    
    if (gameStatus !== 'round-ended') {
      console.log(`⚠️  [${roomId}] Intento de solicitar siguiente ronda cuando el estado es ${gameStatus}`);
      socket.emit(SERVER_EVENTS.ERROR, 'No se puede solicitar siguiente ronda en este momento');
      return;
    }
    
    console.log(`⏭️  [${roomId}] Procesando solicitud de siguiente ronda...`);
    room.gameServer.requestNextRound();
  });

  // Manejar input del jugador
  socket.on(CLIENT_EVENTS.GAME_INPUT, (message: GameInputMessage) => {
    const roomId = socketToRoomId.get(socket.id);
    if (!roomId) {
      return; // Socket no está en ninguna sala
    }

    const room = matchmakingManager.getRoom(roomId);
    if (!room) {
      return; // Sala no encontrada
    }

    // Agregar input a la cola del game server de esta sala
    room.gameServer.addInput(message);
  });

  // Manejar cambio de color del jugador
  socket.on(CLIENT_EVENTS.CHANGE_COLOR, (message: { playerId: string; color: string }) => {
    const roomId = socketToRoomId.get(socket.id);
    if (!roomId) {
      socket.emit(SERVER_EVENTS.ERROR, 'No estás en una sala');
      return;
    }

    const room = matchmakingManager.getRoom(roomId);
    if (!room) {
      socket.emit(SERVER_EVENTS.ERROR, 'Sala no encontrada');
      return;
    }

    const playerId = socket.id; // Usar socket.id como ID del jugador (más seguro)
    
    // Verificar que el jugador existe
    if (!room.playerManager.hasPlayer(playerId)) {
      console.log(`⚠️  [${roomId}] Intento de cambiar color de jugador inexistente: ${playerId}`);
      socket.emit(SERVER_EVENTS.ERROR, 'Jugador no encontrado');
      return;
    }

    const player = room.playerManager.getPlayer(playerId);
    if (!player) {
      socket.emit(SERVER_EVENTS.ERROR, 'Jugador no encontrado');
      return;
    }

    // Verificar que el color no esté en uso por otro jugador en esta sala
    const allPlayers = room.playerManager.getAllPlayers();
    const colorInUse = allPlayers.some(p => p.id !== playerId && p.color === message.color);
    
    if (colorInUse) {
      console.log(`⚠️  [${roomId}] Intento de usar color ya en uso: ${message.color} por ${playerId}`);
      socket.emit(SERVER_EVENTS.ERROR, 'Este color ya está en uso por otro jugador');
      return;
    }

    // Cambiar el color del jugador
    player.color = message.color;
    console.log(`🎨 [${roomId}] Jugador ${player.name} (${playerId}) cambió su color a ${message.color}`);
    
    // Enviar lista actualizada de jugadores solo a esta sala
    broadcastLobbyPlayers(roomId).catch(err => console.error(`[${roomId}] Error broadcasting lobby players:`, err));
  });

  // Manejar desconexión
  socket.on('disconnect', (reason) => {
    console.log(`❌ Cliente desconectado: ${socket.id} (${reason})`);
    
    const roomId = socketToRoomId.get(socket.id);
    if (!roomId) {
      // Socket no estaba en ninguna sala, solo limpiar mapas
      socketToPlayerId.delete(socket.id);
      socketToUserId.delete(socket.id);
      return;
    }

    const room = matchmakingManager.getRoom(roomId);
    if (!room) {
      // Sala no encontrada, limpiar mapas
      socketToPlayerId.delete(socket.id);
      socketToUserId.delete(socket.id);
      socketToRoomId.delete(socket.id);
      return;
    }
    
    // Remover jugador de la sala
    const playerId = socketToPlayerId.get(socket.id);
    if (playerId) {
      const player = room.playerManager.getPlayer(playerId);
      room.playerManager.removePlayer(playerId);
      matchmakingManager.decrementPlayerCount(roomId);
      socketToPlayerId.delete(socket.id);
      socketToUserId.delete(socket.id);
      socketToRoomId.delete(socket.id);
      
      console.log(`🗑️  [${roomId}] Jugador ${player?.name || playerId} removido. Total: ${room.currentPlayers}/${room.maxPlayers}`);
      
      // Enviar lista actualizada de jugadores solo a esta sala
      broadcastLobbyPlayers(roomId).catch(err => console.error(`[${roomId}] Error broadcasting lobby players:`, err));
    }
    
    // Si no quedan jugadores en la sala, detener el juego
    if (room.currentPlayers === 0) {
      console.log(`🛑 [${roomId}] No quedan jugadores, deteniendo juego`);
      room.gameServer.stop();
      room.deltaCompressor.reset();
      
      // Si la sala está en estado waiting, se eliminará automáticamente
      // Si está en playing, se marcará como finished y se limpiará después
      if (room.status === 'playing') {
        room.status = 'finished';
        // Guardar partida si hay gameId
        if (room.gameId) {
          saveGameOnEnd(roomId, room.gameServer.getGameState()).catch(err => 
            console.error(`[${roomId}] Error al guardar partida en desconexión:`, err)
          );
        }
      }
    }
  });
});

// Escuchar en todas las interfaces (0.0.0.0) para que funcione en Railway/cloud
// Railway asigna el puerto automáticamente, así que usamos process.env.PORT
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor curve.io corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://0.0.0.0:${PORT} (escuchando en todas las interfaces)`);
  console.log(`🌐 Orígenes permitidos: ${allowedOrigins.join(', ')}`);
  console.log(`✅ Servidor listo para recibir conexiones`);
  console.log(`🎮 Sistema de matchmaking activado - múltiples salas simultáneas`);
});

