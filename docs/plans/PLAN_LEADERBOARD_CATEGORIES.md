# Plan: Leaderboard con Categorías (All-time, Month, Day)

## Objetivo
Añadir tres categorías al leaderboard:
1. **All-time**: Ranking global por ELO actual (ya existe)
2. **Month**: Ranking por aumento de ELO durante el mes actual
3. **Day**: Ranking por aumento de ELO durante el día actual

## Análisis de la Idea

### ✅ Ventajas:
- **Motiva a jugar regularmente**: Los rankings temporales dan oportunidades frescas
- **Menos intimidante**: Jugadores nuevos pueden destacar en rankings diarios/mensuales
- **Más dinámico**: Los rankings cambian constantemente
- **Ya tenemos la infraestructura**: La tabla `rating_history` tiene todo lo necesario

### ⚠️ Consideraciones:
- **Performance**: Calcular cambios de ELO requiere agregar datos de `rating_history`
- **Jugadores sin actividad**: ¿Qué hacer con jugadores que no jugaron en el período?
- **Zona horaria**: ¿Usar UTC o zona horaria del servidor?

## Implementación Propuesta

### Opción 1: Calcular cambio de ELO (Recomendada)
**Concepto**: Sumar todos los `rating_change` desde el inicio del período

**Ventajas**:
- Más preciso (muestra exactamente cuánto ganó/perdió)
- Funciona incluso si un jugador no tiene rating inicial del período
- Más eficiente (solo suma cambios)

**Query ejemplo**:
```sql
-- Month: Suma de rating_change desde inicio del mes
SELECT 
  ps.user_id,
  ps.elo_rating,
  ps.total_games,
  ps.total_wins,
  u.name,
  COALESCE(SUM(rh.rating_change), 0) as elo_change_month
FROM player_stats ps
LEFT JOIN users u ON u.id = ps.user_id
LEFT JOIN rating_history rh ON rh.user_id = ps.user_id 
  AND rh.created_at >= date_trunc('month', CURRENT_DATE)
GROUP BY ps.user_id, ps.elo_rating, ps.total_games, ps.total_wins, u.name
ORDER BY elo_change_month DESC
LIMIT 100;
```

### Opción 2: Rating inicial vs actual
**Concepto**: `rating_actual - rating_inicial_del_periodo`

**Desventajas**:
- Requiere encontrar el rating más antiguo del período
- Más complejo si no hay entrada en el período

## Estructura de Datos

### Frontend - Estado
```typescript
type LeaderboardCategory = 'all-time' | 'month' | 'day';

const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('all-time');
```

### Backend - Query Parameters
```typescript
// Función para obtener leaderboard por categoría
async function getLeaderboard(category: 'all-time' | 'month' | 'day', limit: number = 100) {
  switch(category) {
    case 'all-time':
      // Query actual (por elo_rating)
      break;
    case 'month':
      // Query con suma de rating_change desde inicio del mes
      break;
    case 'day':
      // Query con suma de rating_change desde inicio del día
      break;
  }
}
```

## UI/UX

### Componente de Tabs
```
┌─────────────────────────────────────────────┐
│  [All-time] [Month] [Day]    12d 5h        │
│                          (countdown discreto)│
├─────────────────────────────────────────────┤
│  Rank | Player | ELO | Win Rate            │
│  ...                                         │
└─────────────────────────────────────────────┘
```

**Diseño del Countdown:**
- Ubicación: Esquina superior derecha, al lado de los tabs
- Tamaño: Texto pequeño (0.75rem - 0.85rem)
- Color: rgba(255, 255, 255, 0.5) o similar (gris claro, discreto)
- Estilo: Sin fondo, solo texto
- Actualización: Cada minuto (o cada hora para month)

### Indicadores Visuales
- **All-time**: Muestra ELO actual
- **Month**: Muestra cambio de ELO del mes (ej: "+150")
- **Day**: Muestra cambio de ELO del día (ej: "+25")

### Countdown Discreto ⏰
Mostrar de forma discreta cuánto tiempo queda para que acabe el período:

**Para Day:**
- Ejemplo: "Resetea en 3h 25m" o "3h 25m"
- Ubicación: Pequeño texto debajo del título del tab o en la esquina superior derecha
- Estilo: Texto pequeño, color gris/opaco, no muy prominente

**Para Month:**
- Ejemplo: "Resetea en 12d 5h" o "12d 5h"
- Mismo estilo discreto

**Implementación:**
```typescript
// Calcular tiempo restante hasta el final del día/mes en UTC
const getTimeRemaining = (period: 'day' | 'month') => {
  const now = new Date();
  const nowUTC = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  
  let endTime: Date;
  if (period === 'day') {
    // Fin del día actual en UTC (próxima medianoche UTC)
    endTime = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate() + 1, 0, 0, 0));
  } else {
    // Fin del mes actual en UTC (primer día del próximo mes)
    endTime = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth() + 1, 1, 0, 0, 0));
  }
  
  const diff = endTime.getTime() - nowUTC.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (period === 'day') {
    return `${hours}h ${minutes}m`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
};
```

## Plan de Implementación

### Fase 1: Backend - Queries SQL
1. Crear función SQL para calcular cambio de ELO por período
2. Crear queries optimizadas con índices
3. Agregar endpoint o modificar función existente

### Fase 2: Frontend - UI
1. Agregar tabs para cambiar categoría
2. Modificar `loadLeaderboard` para aceptar categoría
3. Actualizar UI para mostrar cambio de ELO en Month/Day
4. Implementar countdown discreto que muestre tiempo restante
5. Actualizar countdown cada minuto (para Day) o cada hora (para Month)

### Fase 3: Optimización
1. Agregar índices si es necesario
2. Cachear resultados si es necesario
3. Testing

## Queries SQL Necesarias

### Month Leaderboard
```sql
SELECT 
  ps.user_id,
  ps.elo_rating,
  ps.total_games,
  ps.total_wins,
  u.name,
  COALESCE(SUM(rh.rating_change), 0) as elo_change
FROM player_stats ps
LEFT JOIN users u ON u.id = ps.user_id
LEFT JOIN rating_history rh ON rh.user_id = ps.user_id 
  AND rh.created_at >= date_trunc('month', CURRENT_DATE)
WHERE u.name IS NOT NULL  -- Solo jugadores con nombre
GROUP BY ps.user_id, ps.elo_rating, ps.total_games, ps.total_wins, u.name
HAVING COUNT(rh.id) > 0  -- Solo jugadores que jugaron este mes
ORDER BY elo_change DESC
LIMIT 100;
```

### Day Leaderboard
```sql
SELECT 
  ps.user_id,
  ps.elo_rating,
  ps.total_games,
  ps.total_wins,
  u.name,
  COALESCE(SUM(rh.rating_change), 0) as elo_change
FROM player_stats ps
LEFT JOIN users u ON u.id = ps.user_id
LEFT JOIN rating_history rh ON rh.user_id = ps.user_id 
  AND rh.created_at >= date_trunc('day', CURRENT_DATE)
WHERE u.name IS NOT NULL
GROUP BY ps.user_id, ps.elo_rating, ps.total_games, ps.total_wins, u.name
HAVING COUNT(rh.id) > 0  -- Solo jugadores que jugaron hoy
ORDER BY elo_change DESC
LIMIT 100;
```

## Consideraciones Adicionales

### ¿Qué hacer con jugadores sin actividad?
- **Opción A**: No mostrarlos (usar `HAVING COUNT(rh.id) > 0`)
- **Opción B**: Mostrarlos con cambio 0 (quitar el `HAVING`)

**Recomendación**: Opción A - Solo mostrar jugadores activos en el período

### Zona Horaria ⏰

**Por defecto, PostgreSQL/Supabase usa UTC (Coordinated Universal Time)**

Cuando usas:
- `NOW()` → Devuelve timestamp en UTC
- `CURRENT_DATE` → Fecha actual en UTC
- `date_trunc('day', CURRENT_DATE)` → Inicio del día en UTC (00:00:00 UTC)

**Ejemplo:**
- Si es 2:00 AM en España (UTC+1), en UTC sería 1:00 AM del mismo día
- El "día" en UTC comienza a las 00:00:00 UTC, no a las 00:00:00 hora local

**Opciones:**

1. **Usar UTC (Recomendado)** ✅
   ```sql
   date_trunc('day', CURRENT_DATE)  -- Inicio del día en UTC
   date_trunc('month', CURRENT_DATE)  -- Inicio del mes en UTC
   ```
   - **Ventaja**: Consistente, no depende de la ubicación del servidor
   - **Desventaja**: El "día" puede cambiar a una hora diferente según la zona horaria del jugador

2. **Usar zona horaria específica** (ej: 'Europe/Madrid')
   ```sql
   date_trunc('day', CURRENT_DATE AT TIME ZONE 'Europe/Madrid')
   ```
   - **Ventaja**: El "día" coincide con la zona horaria de los jugadores
   - **Desventaja**: Requiere decidir qué zona horaria usar (¿de qué país?)

**Recomendación**: Usar UTC para consistencia global. Si la mayoría de jugadores están en una zona horaria específica, puedes considerar usar esa zona horaria.

### Performance
- El índice `idx_rating_history_user` ya existe y ayuda
- Considerar agregar índice compuesto: `(user_id, created_at)` si no existe

## Próximos Pasos

1. ✅ Plan creado
2. ⏳ Implementar queries SQL
3. ⏳ Modificar frontend para soportar categorías
4. ⏳ Agregar UI de tabs
5. ⏳ Testing

