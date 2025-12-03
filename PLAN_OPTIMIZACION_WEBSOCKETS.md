# 🚀 Plan de Optimización de WebSockets - Adaptación a FPS y Dispositivos

## 📊 Estado Actual

### Configuración Actual
- **Servidor**: 60 ticks/segundo, broadcast cada 2 ticks = **30 Hz fijo**
- **Cliente Input**: 50ms intervalo = **20 Hz fijo**
- **Delta Compression**: ✅ Implementado (envía estado completo cada 300 ticks)
- **Detección de FPS**: ❌ No existe
- **Adaptación dinámica**: ❌ No existe
- **Diferenciación por dispositivo**: ❌ No existe
- **Interpolación/Predicción**: ❌ No existe

### Problemas Identificados

1. **Frecuencias fijas no se adaptan**
   - Móviles (30 FPS) reciben 30 Hz de updates (puede ser excesivo)
   - Desktop (60 FPS) recibe 30 Hz (puede sentirse lento)
   - No hay ajuste según capacidad del dispositivo

2. **Sin detección de rendimiento**
   - No se mide FPS real del cliente
   - No se detecta lag o stuttering
   - No hay feedback del cliente al servidor sobre su capacidad

3. **Sin optimización por tipo de dispositivo**
   - Móviles necesitan menos updates (ahorro de batería)
   - Desktop puede manejar más updates (mejor experiencia)
   - Tablets en medio

4. **Sin interpolación/predicción**
   - Movimiento puede verse entrecortado con 30 Hz
   - No hay suavizado entre updates del servidor

---

## 🎯 Objetivos de Optimización

### Objetivos Principales
1. **Adaptación dinámica** basada en FPS real del cliente
2. **Diferenciación por dispositivo** (móvil, tablet, desktop)
3. **Throttling adaptativo** según rendimiento
4. **Interpolación** para suavizar movimiento con menos updates
5. **Detección de rendimiento** en tiempo real

### Métricas Objetivo

| Dispositivo | FPS Objetivo | Update Rate Objetivo | Input Rate Objetivo |
|------------|--------------|---------------------|---------------------|
| Móvil (bajo rendimiento) | 30 FPS | 15-20 Hz | 15-20 Hz |
| Móvil (alto rendimiento) | 60 FPS | 20-30 Hz | 20-30 Hz |
| Tablet | 60 FPS | 25-30 Hz | 25-30 Hz |
| Desktop | 60 FPS | 30-60 Hz | 30-60 Hz |

---

## 🔧 Mejoras Propuestas

### 1. **Sistema de Detección de FPS y Rendimiento** ⭐⭐⭐⭐⭐
**Impacto**: Alto - Base para todas las optimizaciones
**Esfuerzo**: Medio

#### Implementación
- **Cliente**: Medir FPS real usando `requestAnimationFrame`
- **Cliente**: Detectar tipo de dispositivo (móvil/tablet/desktop)
- **Cliente**: Medir latencia de red (ping)
- **Cliente**: Enviar métricas al servidor periódicamente

#### Métricas a medir
```typescript
interface ClientMetrics {
  fps: number;              // FPS real del cliente
  deviceType: 'mobile' | 'tablet' | 'desktop';
  networkLatency: number;   // Ping en ms
  frameTime: number;        // Tiempo por frame en ms
  droppedFrames: number;    // Frames perdidos
  batteryLevel?: number;    // Nivel de batería (móvil)
}
```

#### Beneficios
- Servidor puede ajustar rate según capacidad del cliente
- Cliente puede optimizar localmente según su FPS
- Mejor experiencia en todos los dispositivos

---

### 2. **Adaptación Dinámica de Broadcast Rate** ⭐⭐⭐⭐⭐
**Impacto**: Muy Alto - Reduce carga y mejora experiencia
**Esfuerzo**: Medio-Alto

#### Implementación
- **Servidor**: Mantener rate por cliente (no global)
- **Servidor**: Ajustar `broadcastInterval` según métricas del cliente
- **Servidor**: Mínimo 15 Hz, máximo 60 Hz
- **Servidor**: Reducir rate si cliente reporta FPS bajo

#### Lógica de adaptación
```typescript
// Servidor ajusta rate según métricas del cliente
function calculateBroadcastInterval(clientMetrics: ClientMetrics): number {
  const { fps, deviceType, networkLatency } = clientMetrics;
  
  // Base rate según dispositivo
  let baseRate = 30; // Hz
  if (deviceType === 'mobile') baseRate = 20;
  if (deviceType === 'tablet') baseRate = 25;
  if (deviceType === 'desktop') baseRate = 30;
  
  // Ajustar según FPS real
  if (fps < 30) {
    // Cliente con bajo FPS - reducir rate
    baseRate = Math.max(15, baseRate * 0.7);
  } else if (fps >= 55) {
    // Cliente con buen FPS - aumentar rate
    baseRate = Math.min(60, baseRate * 1.2);
  }
  
  // Ajustar según latencia
  if (networkLatency > 100) {
    // Alta latencia - reducir rate (menos datos = menos lag)
    baseRate = Math.max(15, baseRate * 0.8);
  }
  
  // Convertir a interval (ticks)
  // 60 ticks/seg / baseRate Hz = interval
  return Math.ceil(60 / baseRate);
}
```

#### Beneficios
- Móviles reciben menos updates (ahorro de batería)
- Desktop recibe más updates (mejor experiencia)
- Adaptación automática según rendimiento

---

### 3. **Adaptación Dinámica de Input Rate** ⭐⭐⭐⭐
**Impacto**: Alto - Mejora responsividad y reduce carga
**Esfuerzo**: Medio

#### Implementación
- **Cliente**: Ajustar `inputSendInterval` según FPS
- **Cliente**: Sincronizar con rate de broadcast del servidor
- **Cliente**: Enviar input más frecuente si FPS es alto

#### Lógica
```typescript
// Cliente ajusta rate de input según FPS
function calculateInputInterval(fps: number, deviceType: string): number {
  let baseInterval = 50; // ms (20 Hz)
  
  if (deviceType === 'mobile') {
    baseInterval = 66; // 15 Hz para móviles
  } else if (deviceType === 'desktop' && fps >= 55) {
    baseInterval = 33; // 30 Hz para desktop con buen FPS
  }
  
  return baseInterval;
}
```

#### Beneficios
- Input más responsivo en dispositivos capaces
- Menos carga en dispositivos limitados
- Mejor sincronización con servidor

---

### 4. **Sistema de Interpolación de Movimiento** ⭐⭐⭐⭐⭐
**Impacto**: Muy Alto - Suaviza movimiento con menos updates
**Esfuerzo**: Alto

#### Implementación
- **Cliente**: Buffer de últimos 3-5 estados del servidor
- **Cliente**: Interpolar posición entre estados
- **Cliente**: Usar timestamp del servidor para sincronización

#### Lógica de interpolación
```typescript
class InterpolationBuffer {
  private states: Array<{ state: GameState; timestamp: number }> = [];
  private readonly BUFFER_SIZE = 5;
  private readonly INTERPOLATION_DELAY = 50; // ms de delay para suavizar
  
  addState(state: GameState, serverTime: number): void {
    this.states.push({ state, timestamp: serverTime });
    if (this.states.length > this.BUFFER_SIZE) {
      this.states.shift();
    }
  }
  
  getInterpolatedState(currentTime: number): GameState | null {
    if (this.states.length < 2) return null;
    
    const targetTime = currentTime - this.INTERPOLATION_DELAY;
    const state1 = this.states[0];
    const state2 = this.states[1];
    
    if (targetTime < state1.timestamp) return state1.state;
    if (targetTime > state2.timestamp) return state2.state;
    
    // Interpolar entre estados
    const t = (targetTime - state1.timestamp) / (state2.timestamp - state1.timestamp);
    return this.interpolate(state1.state, state2.state, t);
  }
}
```

#### Beneficios
- Movimiento suave incluso con 15-20 Hz de updates
- Mejor experiencia visual
- Permite reducir rate sin perder calidad

---

### 5. **Predicción de Movimiento Local** ⭐⭐⭐⭐
**Impacto**: Alto - Mejora responsividad percibida
**Esfuerzo**: Alto

#### Implementación
- **Cliente**: Mostrar movimiento local inmediatamente
- **Cliente**: Corregir cuando llega estado del servidor
- **Cliente**: Usar reconciliación suave (no snap)

#### Lógica
```typescript
// Cliente predice movimiento local
class ClientPrediction {
  private predictedState: GameState | null = null;
  private serverState: GameState | null = null;
  
  predictLocal(input: Input): void {
    // Aplicar input localmente inmediatamente
    this.predictedState = this.applyInput(this.predictedState, input);
  }
  
  reconcile(serverState: GameState): void {
    // Corregir predicción con estado del servidor
    if (this.predictedState) {
      // Interpolar suavemente hacia estado del servidor
      this.predictedState = this.smoothReconcile(
        this.predictedState,
        serverState
      );
    }
    this.serverState = serverState;
  }
}
```

#### Beneficios
- Input instantáneo (sin esperar servidor)
- Mejor experiencia con latencia alta
- Corrección suave sin "snap"

---

### 6. **Throttling Inteligente por Cliente** ⭐⭐⭐⭐
**Impacto**: Alto - Reduce carga del servidor
**Esfuerzo**: Medio

#### Implementación
- **Servidor**: Mantener contador de broadcast por cliente
- **Servidor**: Solo enviar si hay cambios significativos
- **Servidor**: Priorizar jugadores cercanos al cliente

#### Lógica
```typescript
// Servidor decide si enviar update a cliente específico
function shouldBroadcastToClient(
  clientId: string,
  gameState: GameState,
  lastSentState: GameState,
  clientMetrics: ClientMetrics
): boolean {
  // Si es estado completo (cada 300 ticks), siempre enviar
  if (isFullStateTick(gameState.tick)) return true;
  
  // Si hay cambios significativos, enviar
  if (hasSignificantChanges(gameState, lastSentState)) return true;
  
  // Si cliente tiene buen rendimiento, enviar más frecuente
  if (clientMetrics.fps >= 55) {
    return checkRateLimit(clientId, 30); // 30 Hz
  }
  
  // Cliente con bajo rendimiento, enviar menos frecuente
  return checkRateLimit(clientId, 15); // 15 Hz
}
```

#### Beneficios
- Menos carga en servidor
- Updates más relevantes
- Mejor uso de ancho de banda

---

### 7. **Detección y Adaptación de Batería (Móviles)** ⭐⭐⭐
**Impacto**: Medio - Ahorro de batería
**Esfuerzo**: Bajo

#### Implementación
- **Cliente**: Detectar nivel de batería (Battery API)
- **Cliente**: Reducir rate automáticamente si batería baja
- **Cliente**: Modo "ahorro de batería" opcional

#### Lógica
```typescript
// Cliente ajusta según batería
function adjustForBattery(batteryLevel: number, baseRate: number): number {
  if (batteryLevel < 0.2) {
    // Batería crítica - reducir rate significativamente
    return baseRate * 0.5; // 50% del rate
  } else if (batteryLevel < 0.5) {
    // Batería baja - reducir rate moderadamente
    return baseRate * 0.75; // 75% del rate
  }
  return baseRate;
}
```

#### Beneficios
- Ahorro de batería en móviles
- Experiencia más larga
- Modo opcional para usuarios

---

### 8. **Compresión Adicional de Mensajes** ⭐⭐⭐
**Impacto**: Medio - Reduce ancho de banda
**Esfuerzo**: Bajo-Medio

#### Implementación
- **Servidor**: Comprimir JSON antes de enviar (gzip)
- **Servidor**: Usar binario para datos numéricos
- **Cliente**: Descomprimir automáticamente

#### Beneficios
- 30-50% menos ancho de banda
- Mejor para conexiones lentas
- Menos latencia en redes lentas

---

## 📋 Plan de Implementación

### Fase 1: Fundamentos (2-3 días)
1. ✅ Sistema de detección de FPS
2. ✅ Detección de tipo de dispositivo
3. ✅ Envío de métricas al servidor
4. ✅ Estructura para adaptación dinámica

**Archivos a modificar:**
- `client/src/game/game.ts` - Agregar detección de FPS
- `client/src/network/client.ts` - Enviar métricas
- `server/src/index.ts` - Recibir y procesar métricas
- `server/src/game/gameServer.ts` - Almacenar métricas por cliente

---

### Fase 2: Adaptación Dinámica (3-4 días)
1. ✅ Broadcast rate adaptativo por cliente
2. ✅ Input rate adaptativo
3. ✅ Throttling inteligente

**Archivos a modificar:**
- `server/src/game/gameServer.ts` - Rate por cliente
- `server/src/matchmaking/matchmakingManager.ts` - Gestionar rates
- `client/src/game/game.ts` - Ajustar input rate

---

### Fase 3: Interpolación y Predicción (4-5 días)
1. ✅ Buffer de estados
2. ✅ Interpolación de movimiento
3. ✅ Predicción local
4. ✅ Reconciliación suave

**Archivos a crear:**
- `client/src/game/interpolation.ts` - Sistema de interpolación
- `client/src/game/prediction.ts` - Predicción local

**Archivos a modificar:**
- `client/src/game/game.ts` - Integrar interpolación
- `client/src/network/deltaCompression.ts` - Timestamps

---

### Fase 4: Optimizaciones Adicionales (2-3 días)
1. ✅ Detección de batería (móviles)
2. ✅ Compresión adicional
3. ✅ Métricas y logging

**Archivos a modificar:**
- `client/src/game/game.ts` - Detección de batería
- `server/src/network/deltaCompression.ts` - Compresión

---

## 🎯 Configuraciones Recomendadas por Dispositivo

### Móvil (Bajo Rendimiento)
- **FPS objetivo**: 30 FPS
- **Broadcast rate**: 15-20 Hz
- **Input rate**: 15-20 Hz
- **Interpolación**: Sí (buffer 3 estados)
- **Predicción**: No (ahorro de CPU)

### Móvil (Alto Rendimiento)
- **FPS objetivo**: 60 FPS
- **Broadcast rate**: 20-30 Hz
- **Input rate**: 20-30 Hz
- **Interpolación**: Sí (buffer 4 estados)
- **Predicción**: Sí (suave)

### Tablet
- **FPS objetivo**: 60 FPS
- **Broadcast rate**: 25-30 Hz
- **Input rate**: 25-30 Hz
- **Interpolación**: Sí (buffer 4 estados)
- **Predicción**: Sí

### Desktop
- **FPS objetivo**: 60 FPS
- **Broadcast rate**: 30-60 Hz
- **Input rate**: 30-60 Hz
- **Interpolación**: Sí (buffer 5 estados)
- **Predicción**: Sí (completa)

---

## 📊 Métricas a Monitorear

### Cliente
- FPS real
- Frame time (ms)
- Frames perdidos
- Latencia de red (ping)
- Tamaño de mensajes recibidos
- Tasa de updates recibidos

### Servidor
- Broadcast rate por cliente
- Tamaño de mensajes enviados
- CPU por sala
- Memoria por sala
- Latencia promedio

### Red
- Ancho de banda por cliente
- Mensajes por segundo
- Tamaño promedio de mensajes
- Compresión ratio

---

## 🔍 Testing y Validación

### Escenarios de Prueba
1. **Móvil con 30 FPS**: Verificar que rate se reduce automáticamente
2. **Desktop con 60 FPS**: Verificar que rate aumenta
3. **Conexión lenta**: Verificar que rate se adapta
4. **Batería baja**: Verificar modo ahorro
5. **Múltiples dispositivos**: Verificar que cada uno recibe rate apropiado

### Métricas de Éxito
- ✅ Móviles: 30 FPS estables, batería dura más
- ✅ Desktop: 60 FPS estables, movimiento suave
- ✅ Reducción de ancho de banda: 20-30%
- ✅ Mejora en latencia percibida: 30-50%
- ✅ Sin stuttering en ningún dispositivo

---

## 🚨 Consideraciones Importantes

### Compatibilidad
- Battery API no está disponible en todos los navegadores
- Detección de dispositivo puede fallar
- Fallback a configuración por defecto si falla

### Seguridad
- Validar métricas del cliente (no confiar ciegamente)
- Límites máximos y mínimos en rates
- Prevenir abuso (cliente reportando FPS falso)

### Rendimiento
- Medición de FPS no debe afectar rendimiento
- Interpolación debe ser eficiente
- Buffer de estados limitado

---

## 📝 Notas Finales

### Prioridad de Implementación
1. **Fase 1** (Fundamentos) - Crítico
2. **Fase 2** (Adaptación) - Muy importante
3. **Fase 3** (Interpolación) - Importante
4. **Fase 4** (Optimizaciones) - Opcional

### Impacto Esperado
- **Móviles**: 30-40% menos consumo de batería
- **Desktop**: 20-30% mejor experiencia (movimiento más suave)
- **Servidor**: 15-25% menos carga
- **Red**: 20-30% menos ancho de banda

### Próximos Pasos
1. Implementar Fase 1 (detección de FPS y métricas)
2. Probar en diferentes dispositivos
3. Ajustar algoritmos según resultados
4. Implementar Fase 2 (adaptación dinámica)
5. Continuar con fases siguientes

---

## 🔗 Referencias

- [PLAN_OPTIMIZACION.md](./PLAN_OPTIMIZACION.md) - Optimizaciones generales
- [FLUJO_IMPLEMENTACION.md](./FLUJO_IMPLEMENTACION.md) - Flujo de implementación
- Delta Compression ya implementado en `server/src/network/deltaCompression.ts`
- Spatial Hash ya implementado en `client/src/game/spatialHash.ts`


