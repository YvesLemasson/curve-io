# 🔍 Debug: Problema con Rating no Visible

## Pasos para Diagnosticar

### 1. Verificar Consola del Navegador

1. Abre el navegador (Chrome/Edge recomendado)
2. Presiona **F12** para abrir las herramientas de desarrollador
3. Ve a la pestaña **Console**
4. Abre el sidebar del jugador (botón ☰)
5. Busca mensajes que empiecen con `[PlayerStats]`

**Mensajes esperados:**
- `[PlayerStats] Loading stats for user: [tu-user-id]`
- `[PlayerStats] Query result: { data: {...}, error: null }` o similar
- `[PlayerStats] Stats loaded: {...}` o `[PlayerStats] No stats found, using defaults`

### 2. Verificar Errores Comunes

#### Error: "relation 'player_stats' does not exist"
**Solución:** La migración SQL no se ha ejecutado. Ejecuta `phase1-rating-migration.sql` en Supabase.

#### Error: "new row violates row-level security policy"
**Solución:** Verifica que las políticas RLS estén correctas. Debería haber:
```sql
CREATE POLICY "Anyone can read stats" ON public.player_stats
  FOR SELECT USING (true);
```

#### Error: "column 'elo_rating' does not exist"
**Solución:** La migración no se completó. Verifica que las columnas existan:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'player_stats' 
AND column_name IN ('elo_rating', 'peak_rating', 'rating_change');
```

### 3. Verificar en Supabase

1. Ve a **Supabase Dashboard** → **Table Editor**
2. Selecciona la tabla `player_stats`
3. Busca tu `user_id` (puedes encontrarlo en la consola del navegador)
4. Verifica que existan las columnas `elo_rating`, `peak_rating`, `rating_change`

### 4. Verificar Variables de Entorno

Asegúrate de que el cliente tenga las variables de entorno correctas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Puedes verificarlo en la consola:
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL);
```

### 5. Test Manual en Consola

Abre la consola del navegador y ejecuta:

```javascript
// Obtener el cliente de Supabase
const { supabase } = await import('./src/config/supabase.ts');

// Obtener el usuario actual
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);

// Intentar cargar estadísticas
const { data, error } = await supabase
  .from('player_stats')
  .select('elo_rating, peak_rating, rating_change, total_games, total_wins')
  .eq('user_id', user.id)
  .single();

console.log('Stats:', { data, error });
```

## Soluciones Rápidas

### Si no hay estadísticas en la BD:

Ejecuta en Supabase SQL Editor:
```sql
-- Crear estadísticas iniciales para tu usuario
INSERT INTO player_stats (user_id, elo_rating, peak_rating, rating_change, total_games, total_wins)
VALUES ('TU_USER_ID_AQUI', 1000, 1000, 0, 0, 0)
ON CONFLICT (user_id) DO NOTHING;
```

### Si el sidebar no muestra nada:

1. Verifica que `user` no sea `null` en la consola
2. Verifica que `playerStats` no sea `null` después de cargar
3. Revisa si hay errores de CSS que oculten el contenido

### Si las estadísticas se cargan pero no se muestran:

1. Verifica que el CSS esté cargado correctamente
2. Inspecciona el elemento en DevTools (F12 → Elements)
3. Verifica que `.player-sidebar-stats` tenga contenido

## Contacto

Si después de seguir estos pasos el problema persiste, comparte:
1. Los mensajes de la consola (especialmente los que empiezan con `[PlayerStats]`)
2. Cualquier error en rojo en la consola
3. Una captura de pantalla del sidebar


