# 📁 Organización de Archivos SQL

## Estructura Recomendada

### ✅ Archivos a MANTENER (Schemas y Migraciones Principales)

**Schemas Base:**
- `supabase-schema.sql` - Schema base del proyecto
- `premium-colors-schema.sql` - Schema para items premium
- `loops-currency-schema.sql` - Schema para moneda virtual "Loops" ⚠️ **USAR ESTE** (no virtual-currency-schema.sql)

**Migraciones Principales:**
- `phase1-rating-migration.sql` - Sistema de rating/ELO
- `phase1-add-total-players.sql` - Campo total_players para ELO mejorado

**Datos Iniciales:**
- `premium-trails-fire.sql` - Trails de fuego
- `premium-trails-particles.sql` - Trails de partículas
- `add-removed-colors-as-premium.sql` - Colores premium adicionales

**Documentación:**
- `PHASE1_INSTALLATION.md`
- `PHASE1_TOTAL_PLAYERS_INSTALLATION.md`
- `CREAR_ENV.md`

**Configuración:**
- `tsconfig.json`
- `nixpacks.toml`
- `railway.json`
- `start.sh`

### 🗑️ Archivos a ELIMINAR o MOVER (Redundantes/Obsoletos)

**Duplicados:**
- ❌ `virtual-currency-schema.sql` - **ELIMINAR** (usa "curves", obsoleto. Usar `loops-currency-schema.sql`)
- ❌ `add-total-players-column.sql` - **ELIMINAR** (duplicado de `phase1-add-total-players.sql`)
- ❌ `create-calculate-rating-function.sql` - **ELIMINAR** (ya incluido en `phase1-rating-migration.sql`)

**Fixes ya aplicados (mover a carpeta `sql/archive/` o eliminar):**
- `fix-trigger-elo.sql` - Ya aplicado
- `fix-trigger-elo-v2.sql` - Versión mejorada, ya aplicado
- `fix-rating-change-ambiguous.sql` - Ya aplicado
- `fix-total-players-in-trigger.sql` - Ya aplicado
- `fix-old-items-price-loops.sql` - Ya aplicado
- `fix-user-inventory-rls.sql` - Ya aplicado
- `fix-users-rls-for-leaderboard.sql` - Ya aplicado
- `supabase-schema-update.sql` - Ya aplicado

**Scripts de debugging/testing (mover a `sql/utils/` o eliminar):**
- `check-function-exists.sql`
- `check-missing-rating-history.sql`
- `cleanup-waiting-games.sql`
- `debug-trigger-elo.sql`
- `enable-trigger-elo.sql`
- `test-trigger-manual.sql`
- `verify-new-game-creation.sql`
- `verify-trigger.sql`
- `add-loops-test.sql`

**Mejoras opcionales (mover a `sql/optional/`):**
- `improve-elo-asymmetric.sql` - Mejora opcional del sistema ELO

## 📂 Estructura Actual (✅ Implementada)

```
server/
├── sql/
│   ├── schemas/          ✅ Schemas principales
│   │   ├── supabase-schema.sql
│   │   ├── premium-colors-schema.sql
│   │   └── loops-currency-schema.sql
│   ├── migrations/       ✅ Migraciones principales
│   │   ├── phase1-rating-migration.sql
│   │   └── phase1-add-total-players.sql
│   ├── seeds/            ✅ Datos iniciales
│   │   ├── premium-trails-fire.sql
│   │   ├── premium-trails-particles.sql
│   │   └── add-removed-colors-as-premium.sql
│   ├── utils/            ✅ Scripts de debugging/testing
│   │   ├── check-function-exists.sql
│   │   ├── verify-trigger.sql
│   │   ├── add-loops-test.sql
│   │   └── ...
│   ├── archive/          ✅ Fixes ya aplicados (historial)
│   │   ├── fix-trigger-elo.sql
│   │   └── ...
│   └── optional/         ✅ Mejoras opcionales
│       └── improve-elo-asymmetric.sql
├── docs/                 ✅ Documentación
│   ├── PHASE1_INSTALLATION.md
│   ├── PHASE1_TOTAL_PLAYERS_INSTALLATION.md
│   └── CREAR_ENV.md
└── [archivos de configuración en raíz]
```

## ⚠️ Notas Importantes

1. **`loops-currency-schema.sql` vs `virtual-currency-schema.sql`**: 
   - El código usa `add_loops()` y columna `loops`
   - **Usar `loops-currency-schema.sql`** y eliminar `virtual-currency-schema.sql`

2. **Fixes**: Si ya están aplicados en producción, se pueden archivar o eliminar.

3. **Scripts de debugging**: Útiles para desarrollo, pero no necesarios en producción.

4. **Orden de ejecución**:
   1. `supabase-schema.sql`
   2. `premium-colors-schema.sql`
   3. `loops-currency-schema.sql`
   4. `phase1-rating-migration.sql`
   5. `phase1-add-total-players.sql`
   6. Scripts de seeds (opcional)

