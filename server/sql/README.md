# 📁 Scripts SQL - Guía de Uso

Esta carpeta contiene todos los scripts SQL organizados por categoría.

## 📂 Estructura

### `schemas/` - Schemas Principales
Schemas base que definen la estructura de la base de datos. **Ejecutar en orden:**

1. `supabase-schema.sql` - Schema base del proyecto
2. `premium-colors-schema.sql` - Schema para items premium
3. `loops-currency-schema.sql` - Schema para moneda virtual "Loops"

### `migrations/` - Migraciones
Scripts de migración que agregan nuevas funcionalidades:

- `phase1-rating-migration.sql` - Sistema de rating/ELO
- `phase1-add-total-players.sql` - Campo total_players para ELO mejorado

### `seeds/` - Datos Iniciales
Scripts para poblar la base de datos con datos iniciales (opcional):

- `premium-trails-fire.sql` - Trails de fuego
- `premium-trails-particles.sql` - Trails de partículas
- `add-removed-colors-as-premium.sql` - Colores premium adicionales

### `utils/` - Utilidades y Debugging
Scripts útiles para desarrollo, debugging y mantenimiento:

- `check-function-exists.sql` - Verificar que funciones existen
- `verify-trigger.sql` - Verificar triggers
- `add-loops-test.sql` - Agregar loops de prueba
- `cleanup-waiting-games.sql` - Limpiar partidas antiguas
- Y más...

### `archive/` - Historial
Fixes y scripts ya aplicados (solo para referencia histórica):

- Todos los archivos `fix-*.sql` que ya fueron aplicados en producción

### `optional/` - Mejoras Opcionales
Mejoras que no son esenciales pero pueden ser útiles:

- `improve-elo-asymmetric.sql` - Sistema ELO asimétrico mejorado

## 🚀 Orden de Ejecución Recomendado

Para una instalación nueva:

1. **Schemas** (en orden):
   ```sql
   -- 1. Schema base
   sql/schemas/supabase-schema.sql
   
   -- 2. Items premium
   sql/schemas/premium-colors-schema.sql
   
   -- 3. Moneda virtual
   sql/schemas/loops-currency-schema.sql
   ```

2. **Migraciones** (en orden):
   ```sql
   -- 1. Sistema de rating
   sql/migrations/phase1-rating-migration.sql
   
   -- 2. Campo total_players
   sql/migrations/phase1-add-total-players.sql
   ```

3. **Seeds** (opcional):
   ```sql
   -- Datos iniciales (opcional)
   sql/seeds/premium-trails-fire.sql
   sql/seeds/premium-trails-particles.sql
   sql/seeds/add-removed-colors-as-premium.sql
   ```

## 📝 Notas

- Los scripts en `archive/` ya fueron aplicados y solo se mantienen para referencia
- Los scripts en `utils/` son para desarrollo/debugging, no son necesarios en producción
- Los scripts en `optional/` son mejoras opcionales que puedes aplicar si lo deseas

## ⚠️ Importante

- **NUNCA** ejecutes scripts de `archive/` en producción (ya están aplicados)
- Siempre verifica el contenido de los scripts antes de ejecutarlos
- Haz backup de tu base de datos antes de ejecutar migraciones importantes


