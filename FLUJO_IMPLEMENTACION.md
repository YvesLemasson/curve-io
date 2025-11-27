# Flujo de Implementación - curve.io

## 📋 Índice
1. [Fase 0: Preparación](#fase-0-preparación)
2. [Fase 1: Prototipo Básico Local](#fase-1-prototipo-básico-local)
3. [Fase 2: Sistema de Red Básico](#fase-2-sistema-de-red-básico)
4. [Fase 3: Multiplayer Funcional](#fase-3-multiplayer-funcional)
5. [Fase 4: Optimización y Pulido](#fase-4-optimización-y-pulido)
5. [Fase 5: Producción](#fase-5-producción)

---

## Fase 0: Preparación

### Objetivo
Configurar el entorno de desarrollo y estructura del proyecto.

### Tareas

#### 0.1 Estructura del Proyecto
```
curve-io/
├── client/                 # Frontend (Arquitectura Híbrida)
│   ├── src/
│   │   ├── game/          # Lógica del juego (Vanilla TS)
│   │   ├── render/        # Renderizado Canvas (Vanilla TS)
│   │   ├── network/       # Comunicación con servidor (Vanilla TS)
│   │   └── ui/            # Interfaz de usuario (React)
│   │       ├── components/ # Componentes React (menús, HUD, matchmaking)
│   │       ├── App.tsx     # Componente principal React
│   │       └── App.css
│   ├── public/
│   └── package.json
│
├── server/                 # Backend
│   ├── src/
│   │   ├── game/          # Lógica del servidor
│   │   ├── network/       # WebSocket handlers
│   │   ├── models/        # Modelos de datos
│   │   └── utils/         # Utilidades
│   └── package.json
│
├── shared/                 # Código compartido
│   └── types.ts           # Tipos TypeScript compartidos
│
└── README.md
```

#### 0.2 Configuración Inicial
- [x] Crear repositorio Git (monorepo)
- [x] Configurar .gitignore
- [x] Inicializar proyecto Node.js (client y server)
- [x] Configurar TypeScript
- [x] Configurar Vite (frontend) con plugin React
- [x] Instalar dependencias base:
  - Client: `socket.io-client`, `typescript`, `react`, `react-dom`, `react-router-dom`
  - Server: `socket.io`, `express`, `typescript`, `tsx`
- [x] Configurar arquitectura híbrida (React UI + Vanilla TS Game)

#### 0.3 Definir Tipos Compartidos
```typescript
// shared/types.ts
- [x] Player (id, name, color, position, angle, alive, trail)
- [x] GameState (players, gameStatus, tick, winnerId)
- [x] Input (playerId, key, timestamp)
- [x] Collision (type, playerId, position)
- [x] Room (id, players, maxPlayers, status)
- [x] Protocolo definido (shared/protocol.ts)
```

**Checkpoint**: ✅ Proyecto inicializado, estructura lista, tipos definidos.

---

## Fase 1: Prototipo Básico Local

### Objetivo
Implementar el juego funcionando localmente sin red, con múltiples jugadores simulados.

### Tareas

#### 1.1 Sistema de Renderizado
**Archivo**: `client/src/render/canvas.ts`

- [ ] Crear canvas y contexto 2D
- [ ] Implementar función de limpieza de pantalla
- [ ] Implementar función de dibujo de línea
- [ ] Implementar función de dibujo de jugador (línea con color)
- [ ] Sistema de cámara/viewport (si necesario)

**Checkpoint**: Canvas renderiza correctamente, se puede dibujar.

#### 1.2 Sistema de Input
**Archivo**: `client/src/game/input.ts`

- [ ] Capturar teclado (Arrow keys, WASD)
- [ ] Mapear teclas a acciones (izquierda/derecha)
- [ ] Sistema de eventos de input
- [ ] Throttling de inputs (evitar spam)

**Checkpoint**: Inputs se capturan correctamente.

#### 1.3 Lógica del Jugador
**Archivo**: `client/src/game/player.ts`

- [ ] Clase Player:
  - [ ] Propiedades: id, name, color, x, y, angle, speed, alive
  - [ ] Método `update()`: mover según ángulo y velocidad
  - [ ] Método `turnLeft()`: cambiar ángulo
  - [ ] Método `turnRight()`: cambiar ángulo
  - [ ] Método `getCurrentPosition()`: retornar posición actual
  - [ ] Método `getTrail()`: retornar historial de posiciones (trail)

**Checkpoint**: Jugador se mueve correctamente con inputs.

#### 1.4 Sistema de Colisiones
**Archivo**: `client/src/game/collision.ts`

- [ ] Función `checkLineLineCollision()`: intersección línea-línea
- [ ] Función `checkPointInLine()`: punto en línea
- [ ] Función `checkBoundaryCollision()`: colisión con bordes
- [ ] Función `checkTrailCollision()`: colisión con trails de otros jugadores
- [ ] Optimización: spatial hash para colisiones eficientes

**Algoritmo de colisión línea-línea:**
```
Para cada segmento del trail:
  - Verificar si nueva posición intersecta con segmento
  - Usar algoritmo de intersección de segmentos
```

**Checkpoint**: Colisiones detectadas correctamente.

#### 1.5 Game Loop Local
**Archivo**: `client/src/game/game.ts`

- [ ] Clase Game:
  - [ ] Propiedades: players[], gameState, canvas, ctx
  - [ ] Método `init()`: inicializar jugadores
  - [ ] Método `update()`: 
    - Procesar inputs
    - Actualizar jugadores
    - Detectar colisiones
    - Eliminar jugadores muertos
  - [ ] Método `render()`: dibujar todos los jugadores
  - [ ] Método `gameLoop()`: requestAnimationFrame loop
  - [ ] Método `checkWinCondition()`: verificar si queda 1 jugador

**Checkpoint**: Juego funciona localmente con múltiples jugadores simulados.

#### 1.6 UI Básica
**Archivos**: `client/src/ui/components/`

- [ ] Componente `MainMenu.tsx`: Pantalla de inicio (nombre de jugador)
- [ ] Componente `GameHUD.tsx`: Indicador de jugadores vivos, contador
- [ ] Componente `GameOver.tsx`: Pantalla de game over
- [ ] Integración React con Canvas (comunicación entre UI y juego)

**Arquitectura Híbrida:**
- React maneja UI (menús, HUD, overlays)
- Vanilla TS maneja juego (Canvas, game loop, lógica)
- Comunicación vía eventos o estado compartido

**Checkpoint**: UI básica funcional con React.

---

## Fase 2: Sistema de Red Básico

### Objetivo
Implementar comunicación cliente-servidor básica.

### Tareas

#### 2.1 Servidor Básico
**Archivo**: `server/src/index.ts`

- [ ] Crear servidor Express
- [ ] Configurar Socket.io
- [ ] Manejar conexión de clientes
- [ ] Manejar desconexión de clientes
- [ ] Logging básico

**Checkpoint**: Servidor acepta conexiones WebSocket.

#### 2.2 Protocolo de Comunicación
**Archivo**: `shared/protocol.ts`

Definir eventos:
- [ ] `connect` - Cliente se conecta
- [ ] `disconnect` - Cliente se desconecta
- [ ] `player:join` - Jugador se une (cliente → servidor)
- [ ] `player:joined` - Confirmación de unión (servidor → cliente)
- [ ] `game:input` - Input del jugador (cliente → servidor)
- [ ] `game:state` - Estado del juego (servidor → cliente)
- [ ] `game:start` - Inicio de partida (servidor → cliente)
- [ ] `game:end` - Fin de partida (servidor → cliente)
- [ ] `player:dead` - Jugador muere (servidor → cliente)

**Checkpoint**: Protocolo definido y documentado.

#### 2.3 Cliente: Conexión con Servidor
**Archivo**: `client/src/network/client.ts`

- [ ] Clase NetworkClient:
  - [ ] Método `connect()`: conectar a servidor
  - [ ] Método `disconnect()`: desconectar
  - [ ] Método `sendInput()`: enviar input al servidor
  - [ ] Método `onGameState()`: callback para recibir estado
  - [ ] Manejo de reconexión automática

**Checkpoint**: Cliente se conecta al servidor.

#### 2.4 Servidor: Manejo de Jugadores
**Archivo**: `server/src/game/playerManager.ts`

- [ ] Clase PlayerManager:
  - [ ] Método `addPlayer()`: agregar jugador
  - [ ] Método `removePlayer()`: remover jugador
  - [ ] Método `getPlayer()`: obtener jugador por ID
  - [ ] Método `getAllPlayers()`: obtener todos los jugadores
  - [ ] Almacenamiento en memoria (Map)

**Checkpoint**: Servidor gestiona jugadores conectados.

---

## Fase 3: Multiplayer Funcional

### Objetivo
Implementar el juego multijugador completo con sincronización.

### Tareas

#### 3.1 Servidor: Game Loop
**Archivo**: `server/src/game/gameServer.ts`

- [ ] Clase GameServer:
  - [ ] Propiedades: players, gameState, tickRate (60)
  - [ ] Método `start()`: iniciar game loop
  - [ ] Método `stop()`: detener game loop
  - [ ] Método `tick()`: 
    - Recibir inputs de clientes (cola)
    - Procesar inputs
    - Actualizar posiciones de jugadores
    - Detectar colisiones
    - Enviar estado actualizado a clientes
  - [ ] Método `processInput()`: aplicar input a jugador
  - [ ] Método `updatePlayers()`: mover jugadores
  - [ ] Método `checkCollisions()`: detectar colisiones
  - [ ] Método `broadcastState()`: enviar estado a todos

**Checkpoint**: Game loop del servidor funciona.

#### 3.2 Servidor: Lógica de Colisiones
**Archivo**: `server/src/game/collision.ts`

- [ ] Implementar detección de colisiones (mismo que cliente)
- [ ] Autoridad del servidor: servidor decide colisiones
- [ ] Marcar jugadores como muertos
- [ ] Notificar a clientes sobre muertes

**Checkpoint**: Colisiones funcionan en servidor.

#### 3.3 Cliente: Sincronización con Servidor
**Archivo**: `client/src/game/gameClient.ts`

- [ ] Clase GameClient:
  - [ ] Propiedades: localPlayer, remotePlayers, gameState
  - [ ] Método `updateFromServer()`: actualizar estado desde servidor
  - [ ] Método `render()`: renderizar todos los jugadores
  - [ ] Interpolación: suavizar movimiento entre updates
  - [ ] Predicción: mostrar movimiento local inmediato
  - [ ] Corrección: ajustar cuando llega update del servidor

**Estrategia de sincronización:**
```
1. Cliente envía input inmediatamente
2. Cliente muestra predicción local
3. Servidor procesa y envía estado
4. Cliente interpola entre estado anterior y nuevo
5. Si hay discrepancia, corregir
```

**Checkpoint**: Cliente sincroniza correctamente con servidor.

#### 3.4 Sistema de Partidas
**Archivo**: `server/src/game/room.ts`

- [ ] Clase Room:
  - [ ] Propiedades: id, players[], maxPlayers, status
  - [ ] Método `addPlayer()`: agregar jugador a partida
  - [ ] Método `removePlayer()`: remover jugador
  - [ ] Método `start()`: iniciar partida
  - [ ] Método `canStart()`: verificar si puede iniciar (mínimo jugadores)
  - [ ] Método `checkWinCondition()`: verificar ganador

**Archivo**: `server/src/game/roomManager.ts`

- [ ] Clase RoomManager:
  - [ ] Método `createRoom()`: crear nueva partida
  - [ ] Método `joinRoom()`: unir jugador a partida
  - [ ] Método `findAvailableRoom()`: buscar partida disponible
  - [ ] Límite de jugadores por partida (ej: 20)

**Checkpoint**: Sistema de partidas funcional.

#### 3.5 Flujo Completo de Partida
**Archivo**: `server/src/network/gameHandler.ts`

- [ ] Handler `onPlayerJoin`: crear/agregar a partida
- [ ] Handler `onInput`: procesar input y agregar a cola
- [ ] Handler `onDisconnect`: remover jugador
- [ ] Lógica de inicio automático (cuando hay X jugadores)
- [ ] Lógica de fin de partida (1 jugador restante)

**Checkpoint**: Partida completa funciona de principio a fin.

---

## Fase 4: Optimización y Pulido

### Objetivo
Mejorar rendimiento, latencia y experiencia de usuario.

### Tareas

#### 4.1 Optimización de Red
**Archivo**: `server/src/network/optimization.ts`

- [ ] Delta compression: solo enviar cambios
- [ ] Throttling: no enviar a todos en cada tick
- [ ] Viewport culling: solo enviar jugadores visibles
- [ ] Compresión de datos: MessagePack o similar
- [ ] Batching: agrupar múltiples updates

**Checkpoint**: Red optimizada, menos ancho de banda.

#### 4.2 Optimización de Colisiones
**Archivo**: `server/src/game/spatialHash.ts`

- [ ] Implementar spatial hash/quadtree
- [ ] Solo verificar colisiones en celdas cercanas
- [ ] Reducir complejidad O(n²) a O(n)

**Checkpoint**: Colisiones más eficientes.

#### 4.3 Interpolación y Predicción
**Archivo**: `client/src/game/interpolation.ts`

- [ ] Interpolación suave entre estados
- [ ] Predicción de movimiento local
- [ ] Corrección de desincronización
- [ ] Lag compensation

**Checkpoint**: Movimiento suave incluso con latencia.

#### 4.4 UI/UX Mejorada
**Archivo**: `client/src/ui/components/`

- [ ] Componente `PingIndicator.tsx`: Indicador de latencia (ping)
- [ ] Componente `RoomInfo.tsx`: Contador de jugadores en sala
- [ ] Componente `Leaderboard.tsx`: Tabla de clasificación (opcional)
- [ ] Componente `Matchmaking.tsx`: Sistema de matchmaking con React
- [ ] Componente `UserProfile.tsx`: Gestión de perfil de usuario
- [ ] Efectos visuales (partículas al morir) - Canvas
- [ ] Sonidos (opcional)
- [ ] Animaciones suaves con React/CSS

**Checkpoint**: UI pulida y profesional.

#### 4.5 Manejo de Errores
- [ ] Reconexión automática
- [ ] Manejo de desconexiones
- [ ] Validación de inputs
- [ ] Timeout de conexión
- [ ] Mensajes de error amigables

**Checkpoint**: Sistema robusto ante errores.

#### 4.6 Testing
- [ ] Tests unitarios (lógica de colisiones)
- [ ] Tests de integración (flujo completo)
- [ ] Tests de carga (múltiples jugadores)
- [ ] Tests de latencia

**Checkpoint**: Código testeado y confiable.

---

## Fase 5: Producción

### Objetivo
Preparar el juego para producción y despliegue.

### Tareas

#### 5.1 Base de Datos
**Archivo**: `server/src/database/`

- [ ] Configurar PostgreSQL
- [ ] Modelos: User, Game, Score
- [ ] Persistir estadísticas de jugadores
- [ ] Leaderboards globales
- [ ] Historial de partidas

**Checkpoint**: Base de datos configurada.

#### 5.2 Autenticación (Opcional)
**Archivo**: `server/src/auth/`

- [ ] Sistema de login/registro
- [ ] JWT tokens
- [ ] Sesiones de usuario
- [ ] Perfiles de jugador

**Checkpoint**: Autenticación funcional (si se implementa).

#### 5.3 Seguridad
- [ ] Validación de inputs en servidor
- [ ] Rate limiting
- [ ] Anti-cheat básico
- [ ] Sanitización de datos
- [ ] HTTPS/WSS

**Checkpoint**: Medidas de seguridad implementadas.

#### 5.4 Escalabilidad
- [ ] Load balancing
- [ ] Redis para estado compartido (si múltiples servidores)
- [ ] Monitoreo de recursos
- [ ] Auto-scaling (opcional)

**Checkpoint**: Sistema preparado para escalar.

#### 5.5 DevOps
- [ ] Docker containers
- [ ] Docker Compose (desarrollo)
- [ ] CI/CD pipeline
- [ ] Logging estructurado
- [ ] Monitoreo (opcional: Sentry, DataDog)

**Checkpoint**: Infraestructura lista.

#### 5.6 Documentación
- [ ] README completo
- [ ] Documentación de API
- [ ] Guía de instalación
- [ ] Guía de contribución

**Checkpoint**: Documentación completa.

---

## 📊 Checklist de Progreso

### Fase 0: Preparación
- [x] Estructura del proyecto
- [x] Configuración inicial (Git, dependencias, React)
- [x] Tipos definidos

### Fase 1: Prototipo Local
- [ ] Renderizado
- [ ] Input
- [ ] Lógica de jugador
- [ ] Colisiones
- [ ] Game loop local
- [ ] UI básica

### Fase 2: Sistema de Red
- [ ] Servidor básico
- [ ] Protocolo definido
- [ ] Cliente conecta
- [ ] Manejo de jugadores

### Fase 3: Multiplayer
- [ ] Game loop servidor
- [ ] Colisiones servidor
- [ ] Sincronización cliente
- [ ] Sistema de partidas
- [ ] Flujo completo

### Fase 4: Optimización
- [ ] Optimización de red
- [ ] Optimización colisiones
- [ ] Interpolación
- [ ] UI mejorada
- [ ] Manejo de errores
- [ ] Testing

### Fase 5: Producción
- [ ] Base de datos
- [ ] Autenticación (opcional)
- [ ] Seguridad
- [ ] Escalabilidad
- [ ] DevOps
- [ ] Documentación

---

## 🎯 Prioridades de Implementación

### MVP (Mínimo Viable)
1. Fase 0: Preparación
2. Fase 1: Prototipo Local (sin colisiones complejas)
3. Fase 2: Sistema de Red Básico
4. Fase 3: Multiplayer Funcional (2-4 jugadores)

### Versión Beta
- Fase 4: Optimización básica
- Fase 5: Base de datos y estadísticas

### Versión 1.0
- Fase 4: Todas las optimizaciones
- Fase 5: Producción completa

---

## 📝 Notas de Implementación

### Orden Sugerido de Desarrollo
1. **Empezar local**: Hacer funcionar el juego sin red primero
2. **Agregar red simple**: Un jugador controlado desde cliente
3. **Multiplayer básico**: 2-4 jugadores
4. **Escalar**: Más jugadores, optimizaciones
5. **Pulir**: UI, efectos, sonidos

### Decisiones Técnicas Clave
- **Tick Rate**: 60 ticks/segundo (servidor)
- **Update Rate**: 20-30 updates/segundo (cliente)
- **Interpolación**: 3-5 frames de buffer
- **Timeout**: 5 segundos sin respuesta = desconexión

### Métricas a Monitorear
- Latencia (ping)
- FPS (cliente y servidor)
- Uso de CPU/Memoria
- Ancho de banda
- Jugadores simultáneos

---

## 🚀 Siguiente Paso

**Empezar con Fase 0: Preparación**

¿Listo para comenzar? ¡Vamos a implementar! 🎮

