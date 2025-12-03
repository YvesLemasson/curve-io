# 🏆 Fase 1: Instalación del Sistema de Rating/MMR

Este documento explica cómo instalar el sistema básico de rating Elo/MMR para curve.io.

## 📋 Requisitos Previos

- Base de datos Supabase configurada
- Schema base instalado (`supabase-schema.sql`)
- Acceso al SQL Editor de Supabase

## 🚀 Pasos de Instalación

### Paso 1: Ejecutar la Migración SQL

1. Abre el **Supabase Dashboard**
2. Ve a **SQL Editor**
3. Abre el archivo `server/phase1-rating-migration.sql`
4. Copia todo el contenido del archivo
5. Pégalo en el SQL Editor de Supabase
6. Haz clic en **Run** para ejecutar la migración

### Paso 2: Verificar la Instalación

Después de ejecutar la migración, verifica que todo se haya creado correctamente:

```sql
-- Verificar columnas agregadas a player_stats
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'player_stats' 
AND column_name IN ('elo_rating', 'peak_rating', 'rating_change');

-- Verificar tabla rating_history
SELECT COUNT(*) FROM rating_history;

-- Verificar función calculate_new_rating
SELECT proname FROM pg_proc WHERE proname = 'calculate_new_rating';

-- Verificar trigger actualizado
SELECT tgname FROM pg_trigger WHERE tgname = 'update_stats_on_participant_insert';
```

### Paso 3: Inicializar Ratings Existentes (Opcional)

Si ya tienes jugadores en la base de datos, puedes inicializar sus ratings:

```sql
-- Inicializar ratings para jugadores existentes sin rating
UPDATE player_stats 
SET 
  elo_rating = 1000,
  peak_rating = 1000,
  rating_change = 0
WHERE elo_rating IS NULL OR peak_rating IS NULL;
```

## ✅ Verificación Funcional

Para verificar que el sistema funciona:

1. **Juega una partida** (online o local)
2. **Verifica que el rating se actualice**:
   - Abre el sidebar del jugador (botón ☰ en el menú)
   - Deberías ver tu rating y estadísticas
   - Después de cada partida, el rating debería cambiar

3. **Verifica el historial**:
   ```sql
   SELECT * FROM rating_history 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## 📊 Cómo Funciona

### Sistema de Rating Elo

- **Rating inicial**: Todos los jugadores empiezan con 1000 puntos
- **Cálculo**: El rating cambia después de cada partida basado en:
  - Rating promedio de los oponentes
  - Posición final en la partida (1 = ganador, 2 = segundo, etc.)
  - Resultado esperado vs resultado real

### Fórmula

```
Nuevo Rating = Rating Actual + K × (Resultado Real - Resultado Esperado)

Donde:
- K = 30 (factor de volatilidad)
- Resultado Real = Basado en posición (1.0 para ganador, 0.8 para segundo, etc.)
- Resultado Esperado = Probabilidad de ganar basada en diferencia de ratings
```

### Columnas Agregadas

- `elo_rating`: Rating actual del jugador
- `peak_rating`: Rating máximo alcanzado
- `rating_change`: Cambio de rating en la última partida

### Tabla Nueva

- `rating_history`: Historial de todos los cambios de rating (para gráficos futuros)

## 🐛 Solución de Problemas

### Error: "column already exists"
Si obtienes este error, significa que la migración ya se ejecutó parcialmente. Puedes usar:

```sql
-- Verificar qué columnas ya existen
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'player_stats';

-- Si las columnas ya existen, solo ejecuta las partes que faltan
```

### Error: "function already exists"
La función `calculate_new_rating` ya existe. Esto está bien, el script la reemplazará.

### Los ratings no se actualizan después de una partida

1. Verifica que el trigger esté activo:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger 
   WHERE tgname = 'update_stats_on_participant_insert';
   ```

2. Verifica los logs del servidor para ver si hay errores

3. Verifica que `game_participants` se esté insertando correctamente

## 📝 Notas

- El rating se calcula automáticamente después de cada partida
- Los jugadores nuevos empiezan con 1000 puntos
- El rating puede subir o bajar dependiendo del rendimiento
- El `peak_rating` solo aumenta, nunca disminuye

## 🔄 Próximos Pasos

Después de instalar la Fase 1, puedes proceder con:
- **Fase 2**: Sistema de Ligas (Bronce, Plata, Oro, etc.)
- **Fase 3**: Sistema de Logros
- **Fase 4**: Rachas y Rankings Temporales

---

¿Problemas? Revisa los logs del servidor y la consola del navegador para más detalles.






