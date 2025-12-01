# 🏆 Plan: Sistema de Ranking Competitivo para curve.io

## 📋 Resumen Ejecutivo

Este documento propone múltiples sistemas de ranking que fomenten la competitividad y retención de jugadores en curve.io. Cada sistema puede implementarse de forma independiente o combinarse según las necesidades del juego.

---

## 🎯 Objetivos del Sistema de Ranking

1. **Fomentar la competitividad**: Motivar a los jugadores a mejorar y competir
2. **Retención**: Hacer que los jugadores regresen para mejorar su posición
3. **Progresión clara**: Mostrar avance tangible del jugador
4. **Equidad**: Emparejar jugadores de nivel similar
5. **Variedad**: Ofrecer múltiples formas de destacar

---

## 🎮 Sistemas de Ranking Propuestos

### 1. Sistema de Elo/MMR (Matchmaking Rating) ⭐ **RECOMENDADO**

**Concepto**: Sistema de puntuación basado en el rendimiento contra otros jugadores.

#### Cómo Funciona:

- Cada jugador tiene un **rating inicial** (ej: 1000 puntos)
- Al ganar/perder, el rating cambia según:
  - **Rating del oponente**: Ganar contra jugadores mejores da más puntos
  - **Resultado esperado**: Si eres favorito y ganas, ganas menos puntos
  - **Posición final**: El ganador gana más puntos que el segundo lugar

#### Fórmula Propuesta:

```
Nuevo Rating = Rating Actual + K × (Resultado Real - Resultado Esperado)

Donde:
- K = Factor de volatilidad (30-50 para nuevos jugadores, 15-25 para veteranos)
- Resultado Real = Puntos obtenidos en la partida (normalizado 0-1)
- Resultado Esperado = Probabilidad de ganar basada en diferencia de ratings
```

#### Ventajas:

- ✅ Emparejamiento más justo
- ✅ Refleja habilidad real del jugador
- ✅ Sistema probado (ajedrez, League of Legends, etc.)
- ✅ Se adapta automáticamente al nivel del jugador

#### Desventajas:

- ⚠️ Puede ser intimidante para nuevos jugadores
- ⚠️ Requiere suficientes jugadores para funcionar bien

#### Implementación:

- **Nueva columna en `player_stats`**: `elo_rating` (INTEGER, default 1000)
- **Nueva tabla `rating_history`**: Para tracking de cambios
- **Función SQL**: Calcular nuevo rating después de cada partida

---

### 2. Sistema de Ligas/Divisiones 🥇

**Concepto**: Dividir jugadores en categorías (Bronce, Plata, Oro, etc.)

#### Estructura Propuesta:

```
🥉 BRONCE (0-1199 puntos)
  - Bronce V (0-239)
  - Bronce IV (240-479)
  - Bronce III (480-719)
  - Bronce II (720-959)
  - Bronce I (960-1199)

🥈 PLATA (1200-1599 puntos)
  - Plata V (1200-1279)
  - Plata IV (1280-1359)
  - Plata III (1360-1439)
  - Plata II (1440-1519)
  - Plata I (1520-1599)

🥇 ORO (1600-1999 puntos)
  - Oro V, IV, III, II, I

💎 DIAMANTE (2000-2399 puntos)
  - Diamante V, IV, III, II, I

👑 MAESTRO (2400+ puntos)
  - Top 100 jugadores por rating
```

#### Ventajas:

- ✅ Progresión visual clara
- ✅ Metas alcanzables (subir de división)
- ✅ Orgullo de pertenencia a una liga
- ✅ Fácil de entender para nuevos jugadores

#### Desventajas:

- ⚠️ Puede crear frustración al "descender" de liga
- ⚠️ Requiere definir bien los rangos

#### Implementación:

- **Función SQL**: `get_player_league(rating)` que retorna liga y división
- **Vista materializada**: `player_rankings` con liga calculada
- **UI**: Mostrar insignia de liga en perfil y leaderboard

---

### 3. Sistema de Temporadas 📅

**Concepto**: Reiniciar rankings periódicamente (cada 1-3 meses) con recompensas.

#### Estructura:

- **Duración**: 2-3 meses por temporada
- **Ranking de Temporada**: Separado del ranking global
- **Recompensas al final**:
  - Títulos exclusivos según liga alcanzada
  - Avatares/badges especiales
  - Insignias en perfil

#### Ventajas:

- ✅ Da oportunidades frescas a todos
- ✅ Motiva a jugar activamente
- ✅ Crea eventos y expectativa
- ✅ Permite experimentar con cambios

#### Desventajas:

- ⚠️ Puede frustrar a jugadores que pierden progreso
- ⚠️ Requiere mantenimiento activo

#### Implementación:

- **Nueva tabla `seasons`**: `id`, `name`, `start_date`, `end_date`, `status`
- **Nueva tabla `season_rankings`**: `user_id`, `season_id`, `rating`, `league`, `position`
- **Función SQL**: `archive_season()` para guardar resultados finales
- **Trigger**: Reiniciar ratings al inicio de nueva temporada

---

### 4. Sistema de Logros/Badges 🏅

**Concepto**: Reconocimientos por logros específicos.

#### Logros Propuestos:

**Basados en Victorias:**

- 🥇 "Primera Victoria" - Ganar tu primera partida
- 🏆 "Invencible" - Ganar 10 partidas seguidas
- 👑 "Rey de la Curva" - Ganar 100 partidas
- 💪 "Luchador" - Ganar 50 partidas siendo el último en morir

**Basados en Estadísticas:**

- ⚡ "Velocista" - Sobrevivir más de 5 minutos en una ronda
- 🎯 "Preciso" - Ganar sin usar boost
- 🔥 "Racha Caliente" - Ganar 5 partidas en un día
- 📈 "Mejora Constante" - Subir 200 puntos de rating en una semana

**Basados en Posición:**

- 🥈 "Segundo Lugar" - Terminar segundo 10 veces
- 🥉 "Tercer Lugar" - Terminar tercero 20 veces
- 🎖️ "Consistente" - Terminar en top 3 en 50 partidas

**Especiales:**

- 🌟 "Leyenda" - Alcanzar liga Maestro
- ⭐ "Estrella" - Alcanzar liga Diamante
- 🎪 "Showman" - Ganar una partida con 8+ jugadores

#### Ventajas:

- ✅ Múltiples formas de destacar
- ✅ Motiva a jugadores casuales
- ✅ Coleccionables
- ✅ Historia de logros visible

#### Desventajas:

- ⚠️ Requiere diseño y balance de logros
- ⚠️ Puede ser abrumador si hay muchos

#### Implementación:

- **Nueva tabla `achievements`**: `id`, `name`, `description`, `icon`, `category`
- **Nueva tabla `user_achievements`**: `user_id`, `achievement_id`, `unlocked_at`, `progress`
- **Función SQL**: `check_achievements(user_id)` que verifica y desbloquea logros
- **Trigger**: Ejecutar después de cada partida

---

### 5. Sistema de Streaks (Rachas) 🔥

**Concepto**: Rastrear rachas de victorias y derrotas.

#### Tipos de Rachas:

- **Win Streak**: Victorias consecutivas
- **Loss Streak**: Derrotas consecutivas
- **Play Streak**: Días consecutivos jugando

#### Bonificaciones:

- **Win Streak Bonus**: +10% puntos de rating por cada victoria en racha (máx. +50%)
- **Comeback Bonus**: Si rompes una racha de derrotas, bonus extra
- **Daily Login**: Bonus por jugar días consecutivos

#### Ventajas:

- ✅ Motiva a seguir jugando
- ✅ Crea momentos emocionantes
- ✅ Recompensa consistencia

#### Desventajas:

- ⚠️ Puede crear presión negativa
- ⚠️ Requiere balance cuidadoso

#### Implementación:

- **Nuevas columnas en `player_stats`**:
  - `current_win_streak` (INTEGER)
  - `best_win_streak` (INTEGER)
  - `current_loss_streak` (INTEGER)
  - `last_played_date` (DATE)
  - `consecutive_days` (INTEGER)

---

### 6. Sistema de Rankings por Categorías 📊

**Concepto**: Múltiples leaderboards para diferentes métricas.

#### Categorías Propuestas:

1. **🏆 Ranking Global** (Rating/MMR)
2. **⭐ Más Victorias** (Total wins)
3. **🎯 Mejor Win Rate** (Wins/Games, min. 20 partidas)
4. **⚡ Racha Actual** (Current win streak)
5. **🔥 Mejor Racha** (Best win streak)
6. **📈 Más Mejora** (Rating ganado esta semana)
7. **🎮 Más Activo** (Partidas jugadas este mes)
8. **💎 Top Score** (Mejor puntuación en una partida)

#### Ventajas:

- ✅ Permite destacar en diferentes áreas
- ✅ Incluye a jugadores casuales
- ✅ Más oportunidades de estar en top

#### Desventajas:

- ⚠️ Puede diluir la importancia del ranking principal
- ⚠️ Requiere más queries y mantenimiento

#### Implementación:

- **Vista materializada**: `leaderboard_categories` con índices optimizados
- **API endpoints**: `/api/leaderboard/:category`
- **Cache**: Redis para rankings que cambian frecuentemente

---

### 7. Sistema de Rankings Temporales (Diario/Semanal/Mensual) 📅

**Concepto**: Rankings que se reinician periódicamente.

#### Tipos:

- **📅 Ranking Diario**: Top jugadores del día
- **📆 Ranking Semanal**: Top jugadores de la semana
- **📊 Ranking Mensual**: Top jugadores del mes

#### Ventajas:

- ✅ Da oportunidades frescas constantemente
- ✅ Motiva a jugar regularmente
- ✅ Menos intimidante que rankings globales

#### Desventajas:

- ⚠️ Requiere más procesamiento
- ⚠️ Puede ser confuso tener múltiples rankings

#### Implementación:

- **Nueva tabla `temporal_rankings`**: `user_id`, `period_type` (daily/weekly/monthly), `period_start`, `rating`, `position`
- **Job programado**: Resetear rankings al inicio de cada período
- **Vista materializada**: Para queries rápidas

---

## 🗄️ Cambios en Base de Datos Propuestos

### Tablas Nuevas:

```sql
-- Sistema de Rating/MMR
ALTER TABLE player_stats ADD COLUMN elo_rating INTEGER DEFAULT 1000;
ALTER TABLE player_stats ADD COLUMN peak_rating INTEGER DEFAULT 1000;
ALTER TABLE player_stats ADD COLUMN rating_change INTEGER DEFAULT 0; -- Cambio en última partida

-- Sistema de Rachas
ALTER TABLE player_stats ADD COLUMN current_win_streak INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN best_win_streak INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN current_loss_streak INTEGER DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN last_played_date DATE;
ALTER TABLE player_stats ADD COLUMN consecutive_days INTEGER DEFAULT 0;

-- Historial de Rating (opcional, para gráficos)
CREATE TABLE rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  rating_change INTEGER NOT NULL,
  game_id UUID REFERENCES games(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temporadas
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'upcoming', -- 'upcoming', 'active', 'ended'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rankings de Temporada
CREATE TABLE season_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 1000,
  league TEXT, -- 'bronze', 'silver', 'gold', 'diamond', 'master'
  division INTEGER, -- 1-5
  position INTEGER, -- Posición final en la temporada
  UNIQUE(user_id, season_id)
);

-- Logros
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- URL o emoji
  category TEXT, -- 'victory', 'statistics', 'special'
  requirement_type TEXT, -- 'wins', 'streak', 'rating', 'custom'
  requirement_value INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logros Desbloqueados
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0, -- Para logros progresivos
  UNIQUE(user_id, achievement_id)
);

-- Rankings Temporales
CREATE TABLE temporal_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  rating INTEGER DEFAULT 1000,
  position INTEGER,
  UNIQUE(user_id, period_type, period_start)
);

-- Índices para performance
CREATE INDEX idx_rating_history_user ON rating_history(user_id, created_at DESC);
CREATE INDEX idx_season_rankings_season ON season_rankings(season_id, rating DESC);
CREATE INDEX idx_season_rankings_user ON season_rankings(user_id);
CREATE INDEX idx_temporal_rankings_period ON temporal_rankings(period_type, period_start, rating DESC);
CREATE INDEX idx_player_stats_elo ON player_stats(elo_rating DESC);
```

---

## 🔧 Funciones SQL Propuestas

### 1. Calcular Nuevo Rating (Elo)

```sql
CREATE OR REPLACE FUNCTION calculate_new_rating(
  current_rating INTEGER,
  opponent_ratings INTEGER[],
  position INTEGER, -- 1 = ganador, 2 = segundo, etc.
  total_players INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  k_factor INTEGER := 30; -- Ajustable según experiencia del jugador
  expected_score NUMERIC := 0;
  actual_score NUMERIC;
  avg_opponent_rating NUMERIC;
  rating_change INTEGER;
BEGIN
  -- Calcular rating promedio de oponentes
  SELECT AVG(r) INTO avg_opponent_rating FROM unnest(opponent_ratings) AS r;

  -- Calcular resultado esperado (fórmula Elo)
  expected_score := 1.0 / (1.0 + POWER(10.0, (avg_opponent_rating - current_rating) / 400.0));

  -- Calcular resultado real (normalizado 0-1)
  -- El ganador obtiene 1.0, segundo 0.8, tercero 0.6, etc.
  actual_score := 1.0 - ((position - 1) * 0.2 / (total_players - 1));

  -- Calcular cambio de rating
  rating_change := ROUND(k_factor * (actual_score - expected_score));

  RETURN current_rating + rating_change;
END;
$$ LANGUAGE plpgsql;
```

### 2. Obtener Liga y División

```sql
CREATE OR REPLACE FUNCTION get_player_league(rating INTEGER)
RETURNS TABLE(league TEXT, division INTEGER, division_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN rating >= 2400 THEN 'master'
      WHEN rating >= 2000 THEN 'diamond'
      WHEN rating >= 1600 THEN 'gold'
      WHEN rating >= 1200 THEN 'silver'
      ELSE 'bronze'
    END AS league,
    CASE
      WHEN rating >= 2400 THEN 1
      WHEN rating >= 2000 THEN (2400 - rating) / 80 + 1
      WHEN rating >= 1600 THEN (2000 - rating) / 80 + 1
      WHEN rating >= 1200 THEN (1600 - rating) / 80 + 1
      ELSE (1200 - rating) / 240 + 1
    END::INTEGER AS division,
    CASE
      WHEN rating >= 2400 THEN 'Maestro'
      WHEN rating >= 2000 THEN 'Diamante ' || ((2400 - rating) / 80 + 1)::TEXT
      WHEN rating >= 1600 THEN 'Oro ' || ((2000 - rating) / 80 + 1)::TEXT
      WHEN rating >= 1200 THEN 'Plata ' || ((1600 - rating) / 80 + 1)::TEXT
      ELSE 'Bronce ' || ((1200 - rating) / 240 + 1)::TEXT
    END AS division_name;
END;
$$ LANGUAGE plpgsql;
```

### 3. Actualizar Estadísticas Post-Partida

```sql
CREATE OR REPLACE FUNCTION update_player_stats_with_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_rating INTEGER;
  old_rating INTEGER;
  rating_change INTEGER;
  is_winner BOOLEAN;
  opponent_ratings INTEGER[];
BEGIN
  -- Obtener rating actual
  SELECT elo_rating INTO old_rating
  FROM player_stats
  WHERE user_id = NEW.user_id;

  -- Si no existe, crear con rating inicial
  IF old_rating IS NULL THEN
    INSERT INTO player_stats (user_id, elo_rating, peak_rating)
    VALUES (NEW.user_id, 1000, 1000)
    ON CONFLICT (user_id) DO NOTHING;
    old_rating := 1000;
  END IF;

  -- Obtener ratings de oponentes
  SELECT ARRAY_AGG(ps.elo_rating) INTO opponent_ratings
  FROM game_participants gp
  JOIN player_stats ps ON ps.user_id = gp.user_id
  WHERE gp.game_id = NEW.game_id AND gp.user_id != NEW.user_id;

  -- Calcular nuevo rating
  new_rating := calculate_new_rating(
    old_rating,
    COALESCE(opponent_ratings, ARRAY[1000]),
    NEW.position,
    (SELECT COUNT(*) FROM game_participants WHERE game_id = NEW.game_id)
  );

  rating_change := new_rating - old_rating;
  is_winner := NEW.position = 1;

  -- Actualizar estadísticas
  UPDATE player_stats
  SET
    elo_rating = new_rating,
    peak_rating = GREATEST(peak_rating, new_rating),
    rating_change = rating_change,
    total_games = total_games + 1,
    total_wins = total_wins + CASE WHEN is_winner THEN 1 ELSE 0 END,
    total_score = total_score + NEW.score,
    best_score = GREATEST(best_score, NEW.score),
    -- Actualizar rachas
    current_win_streak = CASE
      WHEN is_winner THEN current_win_streak + 1
      ELSE 0
    END,
    best_win_streak = CASE
      WHEN is_winner THEN GREATEST(best_win_streak, current_win_streak + 1)
      ELSE best_win_streak
    END,
    current_loss_streak = CASE
      WHEN is_winner THEN 0
      ELSE current_loss_streak + 1
    END,
    last_played_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  -- Guardar en historial
  INSERT INTO rating_history (user_id, rating, rating_change, game_id)
  VALUES (NEW.user_id, new_rating, rating_change, NEW.game_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reemplazar trigger existente
DROP TRIGGER IF EXISTS update_stats_on_participant_insert ON game_participants;
CREATE TRIGGER update_stats_on_participant_insert
  AFTER INSERT ON game_participants
  FOR EACH ROW EXECUTE FUNCTION update_player_stats_with_rating();
```

---

## 📱 Cambios en Frontend Propuestos

### Nuevas Páginas/Vistas:

1. **Perfil de Jugador** (`/profile/:userId`)

   - Rating actual y liga
   - Gráfico de progreso de rating
   - Logros desbloqueados
   - Estadísticas detalladas
   - Historial de partidas recientes

2. **Leaderboard Mejorado** (`/leaderboard`)

   - Tabs para diferentes categorías
   - Filtros (global, temporada, diario, etc.)
   - Búsqueda de jugadores
   - Tu posición destacada

3. **Página de Logros** (`/achievements`)

   - Lista de todos los logros
   - Progreso hacia logros no desbloqueados
   - Categorías y filtros

4. **Página de Temporadas** (`/seasons`)
   - Temporada actual
   - Rankings de temporada
   - Temporadas pasadas
   - Recompensas

### Componentes Nuevos:

- `RatingDisplay`: Muestra rating y liga con animaciones
- `LeagueBadge`: Insignia de liga (Bronce, Plata, etc.)
- `AchievementCard`: Tarjeta de logro
- `ProgressBar`: Barra de progreso hacia siguiente liga
- `RatingChart`: Gráfico de evolución de rating
- `StreakIndicator`: Indicador de racha actual

---

## 🚀 Plan de Implementación Recomendado

### Fase 1: Fundamentos (Semanas 1-2)

1. ✅ Implementar sistema de Elo/MMR básico
2. ✅ Agregar columnas de rating a `player_stats`
3. ✅ Crear función de cálculo de rating
4. ✅ Actualizar trigger de estadísticas
5. ✅ Mostrar rating en UI básica

### Fase 2: Sistema de Ligas (Semanas 3-4)

1. ✅ Implementar función de ligas
2. ✅ Crear componentes de UI para ligas
3. ✅ Agregar insignias/emojis de liga
4. ✅ Mostrar liga en perfil y leaderboard
5. ✅ Barra de progreso hacia siguiente división

### Fase 3: Logros (Semanas 5-6)

1. ✅ Crear tabla de logros
2. ✅ Implementar sistema de verificación
3. ✅ Crear página de logros
4. ✅ Notificaciones al desbloquear
5. ✅ Mostrar logros en perfil

### Fase 4: Rachas y Rankings Temporales (Semanas 7-8)

1. ✅ Implementar sistema de rachas
2. ✅ Rankings diarios/semanales
3. ✅ Bonificaciones por rachas
4. ✅ UI para mostrar rachas

### Fase 5: Temporadas (Semanas 9-10)

1. ✅ Sistema de temporadas
2. ✅ Reinicio de rankings
3. ✅ Recompensas de temporada
4. ✅ Página de temporadas

---

## 🎨 Consideraciones de UX/UI

### Visualización de Rating:

- **Formato**: Mostrar rating con separador de miles (ej: 1,234)
- **Cambios**: Mostrar `+15` o `-8` después de partidas
- **Colores**: Verde para subidas, rojo para bajadas
- **Animaciones**: Transiciones suaves al cambiar rating

### Visualización de Ligas:

- **Insignias grandes** en perfil
- **Iconos pequeños** en leaderboard
- **Colores distintivos** por liga
- **Efectos visuales** para ligas altas (Maestro, Diamante)

### Notificaciones:

- **Toast notifications** al subir de liga
- **Modal especial** al alcanzar nueva liga
- **Notificaciones** al desbloquear logros
- **Celebración** al romper récords personales

---

## 📊 Métricas de Éxito

Para medir si el sistema de ranking está funcionando:

1. **Retención**: % de jugadores que regresan después de 7 días
2. **Engagement**: Partidas jugadas por usuario por semana
3. **Competitividad**: % de jugadores que juegan 10+ partidas
4. **Satisfacción**: Feedback de usuarios sobre el sistema
5. **Balance**: Distribución de jugadores en ligas (no todos en Bronce)

---

## 🔄 Mejoras Futuras (Post-MVP)

1. **Matchmaking Inteligente**: Emparejar por rating similar
2. **Ranked vs Casual**: Separar partidas competitivas de casuales
3. **Sistema de Equipos**: Rankings por equipos/clanes
4. **Torneos**: Eventos competitivos programados
5. **Replay System**: Ver partidas pasadas
6. **Análisis de Rendimiento**: Estadísticas avanzadas por jugador

---

## 📝 Notas Finales

- **Priorizar**: Empezar con Elo + Ligas (Fases 1-2) para impacto máximo
- **Iterar**: Ajustar fórmulas y rangos según datos reales
- **Comunicar**: Explicar claramente cómo funciona el sistema a los jugadores
- **Balancear**: Asegurar que el sistema recompense habilidad, no solo tiempo jugado

---

## 🎯 Recomendación Final

**Sistema Mínimo Viable (MVP) para máxima competitividad:**

1. ✅ **Sistema de Elo/MMR** (base fundamental)
2. ✅ **Sistema de Ligas** (progresión visual)
3. ✅ **Sistema de Rachas** (motivación a corto plazo)
4. ✅ **Leaderboard mejorado** (visibilidad)

Estos 4 sistemas juntos crearán un ecosistema competitivo sólido sin sobrecargar la implementación inicial.
