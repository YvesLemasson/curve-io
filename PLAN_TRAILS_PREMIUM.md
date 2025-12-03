# 🎨 Plan de Implementación: Trails Premium con Efectos

## 📋 Resumen Ejecutivo

Implementar un sistema de trails premium con efectos visuales especiales que se pueden comprar y equipar. Los trails premium son **100% cosméticos** y no afectan el gameplay.

---

## 🎯 Objetivos

1. ✅ Crear sistema de trails premium con efectos visuales
2. ✅ Integrar con sistema de monetización existente
3. ✅ Mantener rendimiento óptimo (60 FPS)
4. ✅ Sincronización entre cliente y servidor
5. ✅ UI para comprar y equipar trails

---

## 🔍 Análisis del Sistema Actual

### Estado Actual del Trail

**Archivos clave:**
- `client/src/render/canvas.ts` - Método `drawTrail()` (líneas 113-174)
- `client/src/game/player.ts` - Clase `Player` con propiedad `trail`
- `client/src/game/game.ts` - Renderizado de trails (línea 382)

**Cómo funciona actualmente:**
```typescript
// Renderizado simple
this.canvas.drawTrail(trail, player.color, 3);
// Parámetros: trail (array de posiciones), color (string), lineWidth (number)
```

**Características actuales:**
- Trail es un array de `Position | null` (nulls para gaps)
- Se dibuja con `strokeStyle` y `lineWidth` fijos
- Color sólido basado en `player.color`
- Ancho de línea: 3px
- Sistema de gaps cada 3 segundos (500ms de gap)

---

## 🏗️ Arquitectura Propuesta

### 1. Sistema de Tipos de Trail

```typescript
// Tipos de trails premium
type TrailType = 
  | 'normal'           // Trail básico (gratis)
  | 'particles'        // Partículas brillantes
  | 'fire'             // Estela de fuego
  | 'ice'              // Estela de hielo
  | 'rainbow'          // Arcoíris animado
  | 'ghost'            // Semi-transparente con efecto fantasma
  | 'stars'            // Estrellas/confeti
  | 'electric'         // Rayos eléctricos
  | 'neon'             // Brillo neón
  | 'gradient'         // Degradado animado
```

### 2. Estructura de Datos

```typescript
interface TrailEffect {
  type: TrailType;
  color: string;                    // Color base del jugador
  config: {
    particleCount?: number;         // Para efectos de partículas
    particleSize?: number;
    animationSpeed?: number;
    opacity?: number;                // Para efecto ghost
    gradientColors?: string[];       // Para degradados
    glowIntensity?: number;          // Para efectos neón
  };
}
```

### 3. Modificaciones al Player

```typescript
// En client/src/game/player.ts
export class Player {
  public id: string;
  public name: string;
  public color: string;
  public trail: Array<Position | null>;
  public trailType: TrailType = 'normal';  // NUEVO
  public trailEffect?: TrailEffect;          // NUEVO (opcional)
  // ... resto de propiedades
}
```

---

## 💾 Base de Datos

### Tabla: `premium_trails`

```sql
CREATE TABLE premium_trails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'particles', 'fire', 'ice', etc.
  description TEXT,
  price_loops INTEGER NOT NULL, -- Precio en moneda virtual
  rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  is_limited BOOLEAN DEFAULT FALSE,
  available_until TIMESTAMP,
  config JSONB, -- Configuración específica del efecto
  preview_image_url VARCHAR(255), -- URL de imagen de preview
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_premium_trails_type ON premium_trails(type);
CREATE INDEX idx_premium_trails_rarity ON premium_trails(rarity);
```

### Tabla: `user_equipped_trails`

```sql
CREATE TABLE user_equipped_trails (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trail_id UUID REFERENCES premium_trails(id) ON DELETE CASCADE,
  equipped_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, trail_id)
);

-- Índice para búsqueda rápida
CREATE INDEX idx_user_equipped_trails_user ON user_equipped_trails(user_id);
```

**Nota:** Ya existe `user_inventory` en el plan de monetización, pero podemos usar una tabla específica para trails equipados.

---

## 🎨 Implementación de Efectos Visuales

### 1. Modificar `CanvasRenderer.drawTrail()`

**Ubicación:** `client/src/render/canvas.ts`

**Cambios propuestos:**

```typescript
drawTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number = 2,
  trailType: TrailType = 'normal',  // NUEVO
  effectConfig?: TrailEffectConfig   // NUEVO
): void {
  if (trail.length < 2) return;

  switch (trailType) {
    case 'normal':
      this.drawNormalTrail(trail, color, lineWidth);
      break;
    case 'particles':
      this.drawParticleTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'fire':
      this.drawFireTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'ice':
      this.drawIceTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'rainbow':
      this.drawRainbowTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'ghost':
      this.drawGhostTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'stars':
      this.drawStarsTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'electric':
      this.drawElectricTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'neon':
      this.drawNeonTrail(trail, color, lineWidth, effectConfig);
      break;
    case 'gradient':
      this.drawGradientTrail(trail, color, lineWidth, effectConfig);
      break;
    default:
      this.drawNormalTrail(trail, color, lineWidth);
  }
}
```

### 2. Implementación de Cada Efecto

#### 2.1 Trail Normal (Actual)
```typescript
private drawNormalTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number
): void {
  // Código actual - sin cambios
}
```

#### 2.2 Trail con Partículas
```typescript
private drawParticleTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  // Dibujar trail base
  this.drawNormalTrail(trail, color, lineWidth);
  
  // Agregar partículas brillantes
  const particleCount = config?.particleCount || 20;
  const particleSize = config?.particleSize || 3;
  
  for (let i = 0; i < trail.length; i += Math.floor(trail.length / particleCount)) {
    const point = trail[i];
    if (point) {
      // Dibujar partícula brillante
      this.ctx.fillStyle = color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = color;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, particleSize, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }
}
```

#### 2.3 Trail de Fuego
```typescript
private drawFireTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  // Gradiente de colores fuego (rojo -> naranja -> amarillo)
  const gradient = this.ctx.createLinearGradient(/* ... */);
  gradient.addColorStop(0, '#ff0000');  // Rojo
  gradient.addColorStop(0.5, '#ff8800'); // Naranja
  gradient.addColorStop(1, '#ffff00');   // Amarillo
  
  this.ctx.strokeStyle = gradient;
  this.ctx.lineWidth = lineWidth + 2; // Más grueso
  this.ctx.shadowBlur = 15;
  this.ctx.shadowColor = '#ff4400';
  
  // Dibujar trail con gradiente
  this.drawNormalTrail(trail, '', lineWidth + 2);
  
  this.ctx.shadowBlur = 0;
}
```

#### 2.4 Trail de Hielo
```typescript
private drawIceTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  // Gradiente azul claro -> blanco
  const gradient = this.ctx.createLinearGradient(/* ... */);
  gradient.addColorStop(0, '#00ccff');
  gradient.addColorStop(1, '#ffffff');
  
  this.ctx.strokeStyle = gradient;
  this.ctx.lineWidth = lineWidth;
  this.ctx.shadowBlur = 10;
  this.ctx.shadowColor = '#00ccff';
  
  this.drawNormalTrail(trail, '', lineWidth);
  this.ctx.shadowBlur = 0;
}
```

#### 2.5 Trail Arcoíris
```typescript
private drawRainbowTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  // Animación de arcoíris basada en tiempo
  const time = Date.now() / 1000;
  const hue = (time * 60) % 360; // Rotar 60 grados por segundo
  
  // Dibujar múltiples capas con diferentes colores
  for (let i = 0; i < 3; i++) {
    const offset = (hue + i * 60) % 360;
    const rainbowColor = `hsl(${offset}, 100%, 50%)`;
    this.ctx.strokeStyle = rainbowColor;
    this.ctx.lineWidth = lineWidth + (2 - i);
    this.drawNormalTrail(trail, rainbowColor, lineWidth + (2 - i));
  }
}
```

#### 2.6 Trail Fantasma
```typescript
private drawGhostTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  const opacity = config?.opacity || 0.5;
  
  // Dibujar múltiples capas con opacidad decreciente
  for (let i = 0; i < 3; i++) {
    const alpha = opacity * (1 - i * 0.3);
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth - i;
    this.drawNormalTrail(trail, color, lineWidth - i);
  }
  this.ctx.globalAlpha = 1.0;
}
```

#### 2.7 Trail con Estrellas
```typescript
private drawStarsTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  // Trail base
  this.drawNormalTrail(trail, color, lineWidth);
  
  // Agregar estrellas/confeti
  const starCount = config?.particleCount || 15;
  for (let i = 0; i < trail.length; i += Math.floor(trail.length / starCount)) {
    const point = trail[i];
    if (point) {
      this.drawStar(point.x, point.y, 5, color);
    }
  }
}

private drawStar(x: number, y: number, size: number, color: string): void {
  this.ctx.fillStyle = color;
  this.ctx.shadowBlur = 8;
  this.ctx.shadowColor = color;
  this.ctx.beginPath();
  // Dibujar estrella de 5 puntas
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) this.ctx.moveTo(px, py);
    else this.ctx.lineTo(px, py);
  }
  this.ctx.closePath();
  this.ctx.fill();
  this.ctx.shadowBlur = 0;
}
```

#### 2.8 Trail Eléctrico
```typescript
private drawElectricTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  // Trail base con color eléctrico
  this.ctx.strokeStyle = '#00ffff';
  this.ctx.lineWidth = lineWidth;
  this.ctx.shadowBlur = 10;
  this.ctx.shadowColor = '#00ffff';
  this.drawNormalTrail(trail, '#00ffff', lineWidth);
  
  // Agregar "rayos" aleatorios
  const time = Date.now();
  for (let i = 0; i < trail.length - 1; i++) {
    if (Math.random() < 0.1) { // 10% de probabilidad
      const point = trail[i];
      const nextPoint = trail[i + 1];
      if (point && nextPoint) {
        // Dibujar rayo zigzag
        this.drawZigzag(point, nextPoint, '#ffffff');
      }
    }
  }
  this.ctx.shadowBlur = 0;
}
```

#### 2.9 Trail Neón
```typescript
private drawNeonTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  const glowIntensity = config?.glowIntensity || 20;
  
  // Múltiples capas para efecto neón
  for (let i = 0; i < 3; i++) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth + (glowIntensity - i * 5);
    this.ctx.shadowBlur = glowIntensity - i * 5;
    this.ctx.shadowColor = color;
    this.drawNormalTrail(trail, color, lineWidth + (glowIntensity - i * 5));
  }
  this.ctx.shadowBlur = 0;
}
```

#### 2.10 Trail con Degradado Animado
```typescript
private drawGradientTrail(
  trail: Array<{ x: number; y: number } | null>,
  color: string,
  lineWidth: number,
  config?: TrailEffectConfig
): void {
  const gradientColors = config?.gradientColors || [color, '#ffffff'];
  const time = Date.now() / 1000;
  
  // Crear gradiente animado a lo largo del trail
  // ... implementación compleja de gradiente animado
}
```

---

## 🔄 Sincronización Cliente-Servidor

### Modificaciones al Protocolo

**Archivo:** `shared/protocol.ts`

```typescript
// Agregar trailType al PlayerState
export interface PlayerState {
  id: string;
  name: string;
  color: string;
  position: Position;
  angle: number;
  alive: boolean;
  trail: Array<Position | null>;
  trailType?: TrailType;  // NUEVO
  // ... resto de propiedades
}
```

### Modificaciones al GameServer

**Archivo:** `server/src/game/gameServer.ts`

```typescript
// Al crear jugador, obtener su trail equipado
private async createPlayer(userId: string, ...): Promise<Player> {
  // Obtener trail equipado del usuario
  const equippedTrail = await this.getUserEquippedTrail(userId);
  
  const player = new Player(
    userId,
    name,
    color,
    startPosition,
    startAngle,
    speed
  );
  
  if (equippedTrail) {
    player.trailType = equippedTrail.type;
    player.trailEffect = equippedTrail.config;
  }
  
  return player;
}

private async getUserEquippedTrail(userId: string): Promise<TrailEffect | null> {
  // Query a la base de datos
  const { data } = await supabase
    .from('user_equipped_trails')
    .select('premium_trails(*)')
    .eq('user_id', userId)
    .single();
  
  if (data?.premium_trails) {
    return {
      type: data.premium_trails.type,
      color: '', // Se asignará con el color del jugador
      config: data.premium_trails.config
    };
  }
  
  return null;
}
```

### Modificaciones al Cliente

**Archivo:** `client/src/game/game.ts`

```typescript
// En el método render()
private render(): void {
  this.canvas.clear();

  for (const player of this.players) {
    if (player.alive) {
      const trail = player.getTrail();
      if (trail.length >= 2) {
        // NUEVO: Pasar trailType y effectConfig
        this.canvas.drawTrail(
          trail, 
          player.color, 
          3,
          player.trailType || 'normal',
          player.trailEffect
        );
      }
      // ... resto del render
    }
  }
}
```

---

## 🛍️ Sistema de Compra y Equipamiento

### 1. Modelo de Datos

**Archivo:** `client/src/models/premiumModel.ts`

```typescript
export interface PremiumTrail {
  id: string;
  name: string;
  type: TrailType;
  description: string;
  price_loops: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  is_limited: boolean;
  available_until?: string;
  config: TrailEffectConfig;
  preview_image_url?: string;
}

export async function getAvailableTrails(): Promise<PremiumTrail[]> {
  const { data, error } = await supabase
    .from('premium_trails')
    .select('*')
    .or('available_until.is.null,available_until.gt.' + new Date().toISOString())
    .order('rarity', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function purchaseTrail(userId: string, trailId: string): Promise<boolean> {
  // 1. Verificar que el usuario tiene suficientes loops
  // 2. Obtener precio del trail
  // 3. Descontar loops
  // 4. Agregar a inventario
  // 5. Registrar compra
}

export async function equipTrail(userId: string, trailId: string): Promise<boolean> {
  // 1. Verificar que el usuario posee el trail
  // 2. Desequipar trail actual
  // 3. Equipar nuevo trail
}
```

### 2. UI de Tienda

**Componente:** Agregar sección de trails en la tienda existente

```typescript
// En client/src/ui/App.tsx
const [availableTrails, setAvailableTrails] = useState<PremiumTrail[]>([]);
const [equippedTrailId, setEquippedTrailId] = useState<string | null>(null);

// Cargar trails disponibles
useEffect(() => {
  loadAvailableTrails();
  loadEquippedTrail();
}, []);

const loadAvailableTrails = async () => {
  const trails = await getAvailableTrails();
  setAvailableTrails(trails);
};

const handleEquipTrail = async (trailId: string) => {
  await equipTrail(user?.id, trailId);
  setEquippedTrailId(trailId);
  // Recargar juego para aplicar cambios
};
```

---

## 📊 Optimización de Rendimiento

### Consideraciones

1. **Límite de partículas:** Máximo 50 partículas por trail
2. **Caché de efectos:** Pre-calcular gradientes y efectos estáticos
3. **LOD (Level of Detail):** Reducir efectos en trails largos
4. **RequestAnimationFrame:** Usar para animaciones suaves
5. **Pooling de objetos:** Reutilizar objetos de partículas

### Código de Optimización

```typescript
// En CanvasRenderer
private particlePool: Particle[] = [];
private getParticle(): Particle {
  return this.particlePool.pop() || new Particle();
}

private recycleParticle(particle: Particle): void {
  particle.reset();
  this.particlePool.push(particle);
}
```

---

## 📝 Checklist de Implementación

### Fase 1: Base de Datos y Modelos
- [ ] Crear tabla `premium_trails`
- [ ] Crear tabla `user_equipped_trails`
- [ ] Crear funciones SQL para equipar/desequipar
- [ ] Actualizar modelo `PremiumTrail` en TypeScript
- [ ] Crear funciones de API para comprar/equipar

### Fase 2: Sistema de Renderizado
- [ ] Modificar `CanvasRenderer.drawTrail()` para soportar tipos
- [ ] Implementar `drawNormalTrail()` (refactorizar código actual)
- [ ] Implementar `drawParticleTrail()`
- [ ] Implementar `drawFireTrail()`
- [ ] Implementar `drawIceTrail()`
- [ ] Implementar `drawRainbowTrail()`
- [ ] Implementar `drawGhostTrail()`
- [ ] Implementar `drawStarsTrail()`
- [ ] Implementar `drawElectricTrail()`
- [ ] Implementar `drawNeonTrail()`
- [ ] Implementar `drawGradientTrail()`

### Fase 3: Sincronización
- [ ] Agregar `trailType` a `PlayerState` en protocolo
- [ ] Modificar `GameServer` para cargar trail equipado
- [ ] Modificar `Game` (cliente) para pasar trailType al render
- [ ] Actualizar `Player` class para incluir trailType
- [ ] Probar sincronización en multiplayer

### Fase 4: UI y Compra
- [ ] Agregar sección de trails en la tienda
- [ ] Crear componente de preview de trail
- [ ] Implementar botón de compra
- [ ] Implementar botón de equipar
- [ ] Mostrar trail equipado actualmente
- [ ] Agregar filtros por rareza/tipo

### Fase 5: Contenido Inicial
- [ ] Crear 3-5 trails premium iniciales
- [ ] Diseñar previews/imágenes
- [ ] Configurar precios en loops
- [ ] Probar compra y equipamiento

### Fase 6: Testing y Optimización
- [ ] Probar todos los efectos visuales
- [ ] Medir rendimiento (FPS)
- [ ] Optimizar efectos más pesados
- [ ] Probar en diferentes dispositivos
- [ ] Ajustar configuraciones de efectos

---

## 🎨 Trails Iniciales Sugeridos

### 1. Estrellas Brillantes (Common)
- **Tipo:** `stars`
- **Precio:** 50 loops
- **Descripción:** "Deja un rastro de estrellas brillantes"
- **Config:** `{ particleCount: 15, particleSize: 4 }`

### 2. Fuego (Rare)
- **Tipo:** `fire`
- **Precio:** 150 loops
- **Descripción:** "Una estela ardiente de fuego"
- **Config:** `{ glowIntensity: 15 }`

### 3. Hielo (Rare)
- **Tipo:** `ice`
- **Precio:** 150 loops
- **Descripción:** "Un rastro gélido y brillante"
- **Config:** `{ glowIntensity: 12 }`

### 4. Arcoíris (Epic)
- **Tipo:** `rainbow`
- **Precio:** 300 loops
- **Descripción:** "Un arcoíris animado que cambia de color"
- **Config:** `{ animationSpeed: 60 }`

### 5. Neón (Epic)
- **Tipo:** `neon`
- **Precio:** 300 loops
- **Descripción:** "Brillo neón intenso"
- **Config:** `{ glowIntensity: 25 }`

### 6. Fantasma (Legendary)
- **Tipo:** `ghost`
- **Precio:** 500 loops
- **Descripción:** "Efecto fantasma semi-transparente"
- **Config:** `{ opacity: 0.5 }`

---

## 🚀 Próximos Pasos

1. **Revisar y aprobar este plan**
2. **Decidir qué trails implementar primero** (recomiendo: estrellas, fuego, hielo)
3. **Crear estructura de base de datos**
4. **Implementar sistema de renderizado base**
5. **Probar efectos visuales individualmente**
6. **Integrar con sistema de compra**
7. **Lanzar beta con 3-5 trails**

---

## 💡 Notas Técnicas

- **Rendimiento:** Los efectos más pesados (rainbow, gradient) pueden afectar FPS. Considerar LOD.
- **Compatibilidad:** Asegurar que todos los efectos funcionen en móviles.
- **Sincronización:** El trailType debe sincronizarse correctamente en multiplayer.
- **Caché:** Pre-calcular gradientes y efectos estáticos para mejor rendimiento.

---

**¿Listo para comenzar la implementación?** 🎨




