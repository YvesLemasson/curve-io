# Plan de Implementación: Sistema de Matchmaking

## 📋 Análisis del Estado Actual

### Arquitectura Actual
- **Un solo `GameServer` y `PlayerManager` globales** en `server/src/index.ts`
- **Todos los jugadores se conectan al mismo namespace** de Socket.IO
- **No hay separación de salas/partidas** - todos los jugadores van al mismo lobby
- **Cuando se inicia una partida**, todos los jugadores en el lobby juegan juntos
- **`currentGameId` único** - solo puede haber una partida activa a la vez

### Flujo Actual
1. Jugador hace clic en "Play Online"
2. Cliente se conecta al servidor WebSocket
3. Cliente envía `PLAYER_JOIN` → se une al lobby global
4. Todos los jugadores ven la misma lista de jugadores
5. Cuando alguien presiona "Start", todos los jugadores en el lobby inician juntos

### Limitaciones
- ❌ No soporta múltiples partidas simultáneas
- ❌ Todos los jugadores compiten por la misma sala
- ❌ No hay separación entre diferentes grupos de jugadores
- ❌ No escalable para miles de jugadores

---

## 🎯 Objetivos del Sistema de Matchmaking

1. **Crear salas separadas** para cada partida
2. **Asignar jugadores a salas disponibles** o crear nuevas cuando sea necesario
3. **Aislar completamente** cada partida (GameServer, PlayerManager, estado)
4. **Escalable** para miles de jugadores simultáneos
5. **Eficiente** - no sobrecargar el servidor

---

## 🏗️ Arquitectura Propuesta

### Opción 1: Socket.IO Rooms (RECOMENDADA) ⭐

**Ventajas:**
- ✅ Implementación nativa de Socket.IO
- ✅ Fácil de implementar
- ✅ Eficiente para miles de jugadores
- ✅ No requiere infraestructura adicional
- ✅ Broadcast por room es muy eficiente

**Cómo funciona:**
- Cada "sala" es un Room de Socket.IO
- Cada sala tiene su propio `GameServer` y `PlayerManager`
- El matchmaking asigna jugadores a salas disponibles
- Cuando una sala se llena o inicia, se crea una nueva

**Estructura:**
```
Server
├── MatchmakingManager (gestiona salas)
│   ├── Room 1 (game_room_abc123)
│   │   ├── GameServer
│   │   ├── PlayerManager
│   │   └── gameId (Supabase)
│   ├── Room 2 (game_room_def456)
│   │   ├── GameServer
│   │   ├── PlayerManager
│   │   └── gameId (Supabase)
│   └── ...
```

### Opción 2: Namespaces de Socket.IO

**Ventajas:**
- ✅ Aislamiento completo por namespace
- ✅ Más seguro (cada namespace es independiente)

**Desventajas:**
- ❌ Más complejo de gestionar
- ❌ Requiere crear/destruir namespaces dinámicamente
- ❌ Overhead mayor

### Opción 3: Redis + Cola de Matchmaking

**Ventajas:**
- ✅ Muy escalable
- ✅ Soporta múltiples servidores (horizontal scaling)

**Desventajas:**
- ❌ Requiere infraestructura adicional (Redis)
- ❌ Más complejo de implementar
- ❌ Overkill para empezar

---

## 📐 Diseño Detallado: Opción 1 (Rooms)

### 1. Estructura de Datos

```typescript
// server/src/matchmaking/matchmakingManager.ts

interface GameRoom {
  roomId: string;           // ID único de la sala (ej: "game_room_abc123")
  gameId: string | null;    // ID de la partida en Supabase
  status: 'waiting' | 'playing' | 'finished';
  playerManager: PlayerManager;
  gameServer: GameServer;
  createdAt: number;        // Timestamp de creación
  startedAt: number | null; // Timestamp de inicio
  maxPlayers: number;       // Máximo de jugadores (8)
  currentPlayers: number;   // Jugadores actuales
}

class MatchmakingManager {
  private rooms: Map<string, GameRoom> = new Map();
  private waitingRooms: Set<string> = new Set(); // Salas en estado 'waiting'
  
  // Buscar o crear sala disponible
  findOrCreateRoom(): GameRoom { }
  
  // Obtener sala por roomId
  getRoom(roomId: string): GameRoom | undefined { }
  
  // Limpiar salas terminadas (cleanup)
  cleanupFinishedRooms(): void { }
}
```

### 2. Flujo de Matchmaking

```
Jugador hace clic en "Play Online"
    ↓
Cliente se conecta al servidor
    ↓
Servidor busca sala disponible (waiting, < MAX_PLAYERS)
    ↓
¿Hay sala disponible?
    ├─ SÍ → Asignar jugador a esa sala
    └─ NO → Crear nueva sala
    ↓
Jugador se une al Room de Socket.IO
    ↓
Jugador envía PLAYER_JOIN
    ↓
Servidor agrega jugador al PlayerManager de esa sala
    ↓
Broadcast de jugadores solo a esa sala
```

### 3. Lógica de Asignación de Salas

**Estrategia:**
1. Buscar salas en estado `'waiting'` con menos de `MAX_PLAYERS`
2. Si hay varias, elegir la más antigua (FIFO)
3. Si no hay salas disponibles, crear una nueva
4. Si una sala alcanza `MAX_PLAYERS` o se inicia, marcarla como no disponible para nuevos jugadores

**Código:**
```typescript
findOrCreateRoom(): GameRoom {
  // 1. Buscar sala disponible
  for (const roomId of this.waitingRooms) {
    const room = this.rooms.get(roomId);
    if (room && room.status === 'waiting' && room.currentPlayers < room.maxPlayers) {
      return room;
    }
  }
  
  // 2. No hay sala disponible, crear nueva
  return this.createNewRoom();
}
```

### 4. Gestión del Ciclo de Vida de Salas

**Estados:**
- `waiting`: Sala esperando jugadores (puede recibir nuevos)
- `playing`: Partida en curso (NO acepta nuevos jugadores)
- `finished`: Partida terminada (se eliminará después de cleanup)

**Transiciones:**
```
waiting → playing (cuando se inicia la partida)
playing → finished (cuando termina la partida)
finished → [eliminada] (después de cleanup)
```

### 5. Broadcast por Sala

**Antes (global):**
```typescript
io.emit(SERVER_EVENTS.GAME_STATE, gameState); // A todos
```

**Después (por sala):**
```typescript
io.to(roomId).emit(SERVER_EVENTS.GAME_STATE, gameState); // Solo a esa sala
```

---

## 🔧 Cambios Necesarios en el Código

### 1. Crear `MatchmakingManager`

**Archivo:** `server/src/matchmaking/matchmakingManager.ts`

**Responsabilidades:**
- Gestionar todas las salas activas
- Asignar jugadores a salas
- Crear nuevas salas cuando sea necesario
- Limpiar salas terminadas

### 2. Modificar `server/src/index.ts`

**Cambios principales:**
- ❌ Eliminar `playerManager` y `gameServer` globales
- ✅ Crear `MatchmakingManager` global
- ✅ En `PLAYER_JOIN`: usar matchmaking para asignar sala
- ✅ En `REQUEST_START`: iniciar partida solo en esa sala
- ✅ En `disconnect`: remover jugador solo de su sala
- ✅ Broadcast solo a la sala específica

**Estructura:**
```typescript
// Antes
const playerManager = new PlayerManager();
const gameServer = new GameServer(playerManager, 1920, 1280);

// Después
const matchmakingManager = new MatchmakingManager();
```

### 3. Modificar Event Handlers

**PLAYER_JOIN:**
```typescript
socket.on(CLIENT_EVENTS.PLAYER_JOIN, async (message) => {
  // 1. Buscar o crear sala
  const room = matchmakingManager.findOrCreateRoom();
  
  // 2. Unir socket al room
  socket.join(room.roomId);
  
  // 3. Agregar jugador al PlayerManager de esa sala
  room.playerManager.addPlayer(player);
  
  // 4. Broadcast solo a esa sala
  io.to(room.roomId).emit(SERVER_EVENTS.LOBBY_PLAYERS, ...);
});
```

**REQUEST_START:**
```typescript
socket.on(CLIENT_EVENTS.REQUEST_START, () => {
  // 1. Obtener sala del socket
  const roomId = getRoomIdFromSocket(socket);
  const room = matchmakingManager.getRoom(roomId);
  
  // 2. Iniciar partida solo en esa sala
  room.gameServer.start();
  room.status = 'playing';
  
  // 3. Broadcast solo a esa sala
  io.to(roomId).emit(SERVER_EVENTS.GAME_START, {});
});
```

**GAME_STATE Broadcast:**
```typescript
// En cada sala, configurar callback de broadcast
room.gameServer.onBroadcast((gameState) => {
  const delta = deltaCompressor.compress(gameState);
  io.to(room.roomId).emit(SERVER_EVENTS.GAME_STATE, { delta, serverTime: Date.now() });
});
```

### 4. Cleanup de Salas

**Estrategia:**
- Ejecutar cleanup cada 5 minutos
- Eliminar salas en estado `'finished'` con más de 10 minutos de antigüedad
- Limpiar recursos (detener GameServer, limpiar PlayerManager)

**Código:**
```typescript
setInterval(() => {
  matchmakingManager.cleanupFinishedRooms();
}, 5 * 60 * 1000); // Cada 5 minutos
```

---

## 🚀 Plan de Implementación (Fases)

### Fase 1: Estructura Base (2-3 horas)
1. ✅ Crear `MatchmakingManager` con estructura básica
2. ✅ Crear función `findOrCreateRoom()`
3. ✅ Crear función `getRoom()`
4. ✅ Tests básicos de matchmaking

### Fase 2: Integración con Socket.IO (3-4 horas)
1. ✅ Modificar `PLAYER_JOIN` para usar matchmaking
2. ✅ Implementar unión a rooms de Socket.IO
3. ✅ Modificar broadcast para usar rooms
4. ✅ Modificar `REQUEST_START` para iniciar solo en esa sala
5. ✅ Modificar `disconnect` para remover de sala específica

### Fase 3: Gestión de Estado (2-3 horas)
1. ✅ Gestionar `currentGameId` por sala (no global)
2. ✅ Modificar callbacks de `onGameEnd` para limpiar sala
3. ✅ Implementar cleanup de salas terminadas
4. ✅ Gestionar estado de salas (waiting/playing/finished)

### Fase 4: Testing y Optimización (2-3 horas)
1. ✅ Probar con múltiples jugadores simultáneos
2. ✅ Verificar que las salas están aisladas
3. ✅ Probar cleanup de salas
4. ✅ Optimizar búsqueda de salas disponibles
5. ✅ Añadir logs para debugging

### Fase 5: Edge Cases (1-2 horas)
1. ✅ Manejar desconexiones durante partida
2. ✅ Manejar salas vacías
3. ✅ Manejar errores al crear partidas en Supabase
4. ✅ Manejar límite de salas simultáneas (si es necesario)

---

## 📊 Consideraciones de Rendimiento

### Escalabilidad
- **Socket.IO Rooms** es muy eficiente - puede manejar miles de rooms
- Cada sala es independiente - no hay cuello de botella global
- Broadcast por room es O(n) donde n = jugadores en esa sala (no todos los jugadores)

### Memoria
- Cada sala tiene su propio `GameServer` y `PlayerManager`
- Limpiar salas terminadas es crítico para evitar memory leaks
- Considerar límite máximo de salas simultáneas si es necesario

### CPU
- Cada sala ejecuta su propio game loop (60 ticks/seg)
- Con muchas salas, el CPU puede ser un cuello de botella
- Considerar throttling o reducir tick rate si hay muchas salas

### Base de Datos
- Cada sala crea su propia partida en Supabase
- No hay cambios en la estructura de la BD
- El cleanup de salas no afecta las partidas guardadas

---

## 🔍 Alternativas y Mejoras Futuras

### Mejoras Futuras
1. **Matchmaking por ELO**: Agrupar jugadores por rango de ELO
2. **Matchmaking por región**: Agrupar por latencia/región
3. **Sistema de colas**: Cola de espera cuando no hay salas disponibles
4. **Límite de tiempo de espera**: Crear sala nueva si espera > X minutos
5. **Balanceo de carga**: Distribuir salas entre múltiples servidores (con Redis)

### Si Necesitamos Escalar Más
- **Redis Pub/Sub**: Para sincronizar entre múltiples servidores
- **Load Balancer**: Distribuir conexiones entre servidores
- **Microservicios**: Separar matchmaking en servicio independiente

---

## ✅ Checklist de Implementación

### Preparación
- [ ] Revisar y entender el código actual
- [ ] Crear branch `feature/matchmaking-system`
- [ ] Backup del código actual

### Implementación
- [ ] Crear `MatchmakingManager` class
- [ ] Crear estructura `GameRoom`
- [ ] Implementar `findOrCreateRoom()`
- [ ] Implementar `getRoom()`
- [ ] Implementar `cleanupFinishedRooms()`
- [ ] Modificar `PLAYER_JOIN` handler
- [ ] Modificar `REQUEST_START` handler
- [ ] Modificar `disconnect` handler
- [ ] Modificar broadcast de `GAME_STATE`
- [ ] Modificar broadcast de `LOBBY_PLAYERS`
- [ ] Gestionar `gameId` por sala
- [ ] Implementar cleanup automático

### Testing
- [ ] Probar con 2 jugadores en salas diferentes
- [ ] Probar con 10+ jugadores simultáneos
- [ ] Verificar aislamiento de salas
- [ ] Probar cleanup de salas
- [ ] Probar desconexiones durante partida
- [ ] Probar límite de jugadores por sala

### Documentación
- [ ] Actualizar README con nueva arquitectura
- [ ] Documentar API de MatchmakingManager
- [ ] Añadir comentarios en código crítico

---

## 🎯 Resultado Esperado

Después de la implementación:
- ✅ Múltiples partidas simultáneas funcionando independientemente
- ✅ Jugadores asignados automáticamente a salas disponibles
- ✅ Nuevas salas creadas cuando las existentes están llenas o iniciadas
- ✅ Sistema escalable para miles de jugadores
- ✅ Código limpio y mantenible

---

## 📝 Notas Adicionales

### Compatibilidad
- ✅ No requiere cambios en el cliente (el cliente no necesita saber sobre salas)
- ✅ No requiere cambios en la base de datos
- ✅ Compatible con el sistema de ELO existente

### Seguridad
- ✅ Cada sala está aislada - jugadores no pueden acceder a otras salas
- ✅ Socket.IO maneja la seguridad de rooms automáticamente
- ✅ Validar que el socket pertenece a la sala antes de procesar eventos

### Debugging
- ✅ Añadir logs detallados de matchmaking
- ✅ Logs de creación/eliminación de salas
- ✅ Métricas de salas activas (para monitoreo)

---

**Fecha de creación:** 2024
**Autor:** Plan de implementación para sistema de matchmaking
**Estado:** Pendiente de revisión e implementación






