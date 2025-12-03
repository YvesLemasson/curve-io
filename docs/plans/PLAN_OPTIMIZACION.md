# Plan de Optimización - Reducción de Lag

## 📊 Análisis del Sistema Actual

### Estado Actual
- **Servidor**: 60 ticks/segundo, envía estado completo cada tick a todos los clientes
- **Cliente**: 60 FPS (requestAnimationFrame), recibe estado completo del servidor
- **Input**: 20 Hz (cada 50ms)
- **Colisiones**: O(n²) - cada jugador verifica contra todos los otros trails
- **Renderizado**: Dibuja todos los trails completos cada frame
- **Trails**: Se acumulan hasta 1000 puntos, se envían completos en cada update
- **Red**: Sin compresión, sin delta compression, sin throttling

---

## 🎯 Optimizaciones por Prioridad

### 🔴 PRIORIDAD ALTA (Impacto Inmediato en Lag)

#### 1. **Spatial Hash / Quadtree para Colisiones**
**Impacto**: ⭐⭐⭐⭐⭐ (Reduce O(n²) a O(n))
**Esfuerzo**: Medio
**Archivo**: `server/src/game/spatialHash.ts`, `client/src/game/spatialHash.ts`

**Descripción**:
- Dividir el canvas en celdas (grid)
- Solo verificar colisiones con trails en celdas adyacentes
- Reducir complejidad de O(n²) a O(n) o mejor

**Implementación**:
```typescript
// Dividir canvas en grid de 100x100 píxeles
// Solo verificar colisiones en celdas cercanas al jugador
// Actualizar hash cuando jugador cambia de celda
```

**Beneficio**: 
- Con 10 jugadores: de 100 verificaciones a ~10-20 por jugador
- Reducción de ~80-90% en tiempo de colisiones

---

#### 2. **Delta Compression en Red**
**Impacto**: ⭐⭐⭐⭐⭐ (Reduce ancho de banda 70-90%)
**Esfuerzo**: Medio-Alto
**Archivo**: `server/src/network/deltaCompression.ts`, `client/src/network/deltaCompression.ts`

**Descripción**:
- En lugar de enviar estado completo, enviar solo cambios
- Primera vez: estado completo
- Siguientes: solo posiciones/ángulos que cambiaron
- Comprimir trails (solo últimos N puntos nuevos)

**Implementación**:
```typescript
// Servidor: Comparar estado anterior con actual
// Solo enviar: { playerId, position?, angle?, trailNewPoints[] }
// Cliente: Aplicar delta al estado local
```

**Beneficio**:
- Estado completo: ~50-100KB con 10 jugadores
- Delta: ~5-15KB (solo cambios)
- Reducción de latencia de red significativa

---

#### 3. **Throttling de Broadcast**
**Impacto**: ⭐⭐⭐⭐ (Reduce carga de red 50-70%)
**Esfuerzo**: Bajo
**Archivo**: `server/src/game/gameServer.ts`

**Descripción**:
- No enviar estado a todos en cada tick
- Enviar a cada cliente cada 2-3 ticks (20-30 Hz en lugar de 60 Hz)
- O usar rate limiting por cliente (máx 30 updates/seg)

**Implementación**:
```typescript
// Mantener contador por cliente
// Solo broadcast cada N ticks o cada X ms
// Alternativa: enviar solo cuando hay cambios significativos
```

**Beneficio**:
- Reducción de 60 broadcasts/seg a 20-30/seg
- Menos carga en servidor y red
- Latencia visual mínima (2-3 frames)

---

#### 4. **Interpolación y Predicción en Cliente**
**Impacto**: ⭐⭐⭐⭐ (Mejora percepción de lag)
**Esfuerzo**: Alto
**Archivo**: `client/src/game/interpolation.ts`, `client/src/game/prediction.ts`

**Descripción**:
- **Interpolación**: Suavizar movimiento entre updates del servidor
- **Predicción**: Mostrar movimiento local inmediato, corregir después
- Buffer de estados para interpolación

**Implementación**:
```typescript
// Mantener buffer de últimos 3-5 estados del servidor
// Interpolar posición entre estados
// Predecir movimiento local y corregir cuando llega estado del servidor
```

**Beneficio**:
- Movimiento suave incluso con 30 Hz de updates
- Input más responsivo (sin esperar servidor)
- Mejor experiencia con latencia alta

---

### 🟡 PRIORIDAD MEDIA (Mejoras Significativas)

#### 5. **Optimización de Renderizado**
**Impacto**: ⭐⭐⭐ (Mejora FPS en clientes)
**Esfuerzo**: Medio
**Archivo**: `client/src/render/canvas.ts`

**Descripción**:
- **Dirty Regions**: Solo redibujar áreas que cambiaron
- **Viewport Culling**: Solo dibujar trails visibles
- **Batch Drawing**: Agrupar operaciones de dibujo
- **Offscreen Canvas**: Pre-renderizar trails estáticos

**Implementación**:
```typescript
// Mantener canvas offscreen para trails antiguos
// Solo dibujar nuevos segmentos de trail
// Usar requestAnimationFrame con prioridad
```

**Beneficio**:
- Reducción de operaciones de dibujo 50-70%
- Mejor FPS en dispositivos de gama baja
- Menos uso de GPU

---

#### 6. **Limitar y Optimizar Trails**
**Impacto**: ⭐⭐⭐ (Reduce memoria y red)
**Esfuerzo**: Bajo-Medio
**Archivo**: `server/src/game/gameServer.ts`, `client/src/game/player.ts`

**Descripción**:
- Reducir tamaño máximo de trail (de 1000 a 500-700)
- Solo enviar últimos N puntos nuevos en delta
- Comprimir trails antiguos (menos precisión)
- Eliminar trails de jugadores muertos

**Implementación**:
```typescript
// Trail máximo: 500 puntos
// Solo enviar últimos 10-20 puntos nuevos
// Comprimir trails antiguos (reducir precisión decimal)
```

**Beneficio**:
- Menos memoria (~50% menos)
- Menos datos en red
- Colisiones más rápidas (menos puntos a verificar)

---

#### 7. **Object Pooling**
**Impacto**: ⭐⭐⭐ (Reduce garbage collection)
**Esfuerzo**: Medio
**Archivo**: `client/src/utils/objectPool.ts`, `server/src/utils/objectPool.ts`

**Descripción**:
- Reutilizar objetos Position en lugar de crear nuevos
- Pool de arrays para trails
- Reducir allocations y GC pauses

**Implementación**:
```typescript
// Pool de objetos Position
// Pool de arrays para trails
// Reutilizar en lugar de crear nuevos
```

**Beneficio**:
- Menos pausas de GC
- FPS más estables
- Menor uso de memoria

---

#### 8. **Optimización de Colisiones - Early Exit**
**Impacto**: ⭐⭐⭐ (Reduce tiempo de colisiones)
**Esfuerzo**: Bajo
**Archivo**: `server/src/game/collision.ts`, `client/src/game/collision.ts`

**Descripción**:
- Verificar colisiones más probables primero (cercanas)
- Early exit cuando se encuentra colisión
- Saltar verificaciones innecesarias (jugadores muy lejos)

**Implementación**:
```typescript
// Ordenar trails por distancia al jugador
// Verificar colisiones cercanas primero
// Saltar si distancia > threshold
```

**Beneficio**:
- Reducción de 20-40% en tiempo de colisiones
- Menos cálculos innecesarios

---

### 🟢 PRIORIDAD BAJA (Mejoras Incrementales)

#### 9. **Compresión de Mensajes**
**Impacto**: ⭐⭐ (Reduce ancho de banda 20-30%)
**Esfuerzo**: Medio
**Archivo**: `server/src/network/compression.ts`, `client/src/network/compression.ts`

**Descripción**:
- Usar MessagePack o similar en lugar de JSON
- Comprimir mensajes grandes (>1KB)
- Reducir overhead de serialización

**Beneficio**:
- Menos ancho de banda
- Latencia ligeramente menor

---

#### 10. **Optimización de Input**
**Impacto**: ⭐⭐ (Mejora responsividad)
**Esfuerzo**: Bajo
**Archivo**: `client/src/game/input.ts`, `client/src/game/game.ts`

**Descripción**:
- Enviar input inmediatamente (sin throttling de 50ms)
- O reducir throttling a 33ms (30 Hz)
- Priorizar inputs críticos (boost)

**Beneficio**:
- Input más responsivo
- Menor latencia percibida

---

#### 11. **Lazy Loading de Trails**
**Impacto**: ⭐⭐ (Reduce carga inicial)
**Esfuerzo**: Bajo
**Archivo**: `client/src/game/game.ts`

**Descripción**:
- No renderizar trails completos de jugadores lejanos
- Cargar trails progresivamente
- Reducir detalle de trails antiguos

**Beneficio**:
- Menos carga inicial
- Mejor rendimiento con muchos jugadores

---

## 📈 Plan de Implementación Recomendado

### Fase 1: Quick Wins (1-2 días)
1. ✅ Throttling de Broadcast (#3)
2. ✅ Limitar Trails (#6)
3. ✅ Early Exit en Colisiones (#8)

**Impacto esperado**: Reducción de lag 30-40%

### Fase 2: Optimizaciones Clave (3-5 días)
1. ✅ Spatial Hash (#1)
2. ✅ Delta Compression (#2)
3. ✅ Optimización de Renderizado (#5)

**Impacto esperado**: Reducción de lag adicional 40-50%

### Fase 3: Pulido (2-3 días)
1. ✅ Interpolación y Predicción (#4)
2. ✅ Object Pooling (#7)
3. ✅ Optimización de Input (#10)

**Impacto esperado**: Reducción de lag adicional 10-20%

### Fase 4: Mejoras Incrementales (Opcional)
1. ✅ Compresión de Mensajes (#9)
2. ✅ Lazy Loading (#11)

**Impacto esperado**: Mejoras menores pero notables

---

## 🎯 Métricas Objetivo

### Antes de Optimizaciones
- **Latencia de red**: 50-100ms (depende de conexión)
- **FPS**: 60 (pero con stutters)
- **CPU servidor**: Alto con 10+ jugadores
- **Ancho de banda**: ~500KB/s por cliente
- **Tiempo de colisiones**: ~5-10ms por tick

### Después de Fase 1-2
- **Latencia de red**: 30-60ms (mejor)
- **FPS**: 60 (estable)
- **CPU servidor**: Medio (50% menos)
- **Ancho de banda**: ~100-150KB/s por cliente (70% menos)
- **Tiempo de colisiones**: ~1-2ms por tick (80% menos)

### Después de Todas las Fases
- **Latencia de red**: 20-40ms (excelente)
- **FPS**: 60 (muy estable)
- **CPU servidor**: Bajo (70% menos)
- **Ancho de banda**: ~50-100KB/s por cliente (85% menos)
- **Tiempo de colisiones**: ~0.5-1ms por tick (90% menos)

---

## 🔍 Técnicas Específicas

### Spatial Hash
```typescript
// Grid de 100x100 píxeles
const CELL_SIZE = 100;
const getCellKey = (x: number, y: number) => 
  `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;

// Solo verificar colisiones en celdas adyacentes
const nearbyCells = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1]
];
```

### Delta Compression
```typescript
// Estado anterior vs actual
const delta = {
  players: players.map(p => {
    const old = previousState.players.find(op => op.id === p.id);
    if (!old) return p; // Nuevo jugador
    
    const changes: any = { id: p.id };
    if (old.position.x !== p.position.x || old.position.y !== p.position.y) {
      changes.position = p.position;
    }
    if (old.angle !== p.angle) changes.angle = p.angle;
    if (p.trail.length > old.trail.length) {
      changes.trailNew = p.trail.slice(old.trail.length);
    }
    return Object.keys(changes).length > 1 ? changes : null;
  }).filter(Boolean)
};
```

### Interpolación
```typescript
// Buffer de estados
const stateBuffer: GameState[] = [];
const BUFFER_SIZE = 5;

// Interpolar entre estados
const interpolate = (t: number, state1: GameState, state2: GameState) => {
  // t entre 0 y 1
  return {
    position: {
      x: state1.position.x + (state2.position.x - state1.position.x) * t,
      y: state1.position.y + (state2.position.y - state1.position.y) * t
    }
  };
};
```

---

## 📝 Notas de Implementación

### Orden de Prioridad
1. **Spatial Hash** - Mayor impacto en rendimiento
2. **Delta Compression** - Mayor impacto en latencia
3. **Throttling** - Fácil y efectivo
4. **Interpolación** - Mejora experiencia
5. **Renderizado** - Mejora FPS

### Consideraciones
- **Testing**: Probar con 10, 20, 50 jugadores
- **Profiling**: Usar Chrome DevTools y Node.js profiler
- **Métricas**: Monitorear FPS, latencia, CPU, memoria
- **Rollback**: Mantener código anterior comentado para comparar

### Herramientas de Medición
- Chrome DevTools Performance
- Node.js `--prof` y `--prof-process`
- Socket.io metrics
- Custom FPS counter
- Network tab para ancho de banda

---

## ✅ Checklist de Implementación

### Fase 1
- [ ] Implementar throttling de broadcast (20-30 Hz)
- [ ] Reducir tamaño máximo de trail (500-700)
- [ ] Agregar early exit en colisiones
- [ ] Medir mejoras

### Fase 2
- [ ] Implementar spatial hash
- [ ] Implementar delta compression
- [ ] Optimizar renderizado (dirty regions)
- [ ] Medir mejoras

### Fase 3
- [ ] Implementar interpolación
- [ ] Implementar predicción
- [ ] Agregar object pooling
- [ ] Optimizar input
- [ ] Medir mejoras

### Fase 4
- [ ] Agregar compresión de mensajes
- [ ] Implementar lazy loading
- [ ] Medir mejoras finales

---

## 🚀 Resultado Esperado

Con todas las optimizaciones implementadas:
- **Lag reducido en 80-90%**
- **Ancho de banda reducido en 85%**
- **CPU servidor reducido en 70%**
- **FPS estable en 60**
- **Experiencia fluida incluso con 20+ jugadores**

---

**Última actualización**: Plan de optimización para reducir lag en curve.pw
**Prioridad**: Implementar Fase 1-2 primero para máximo impacto

