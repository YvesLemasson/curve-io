# 📁 Organización de Documentación

## 📊 Análisis de Archivos en la Raíz

### ✅ Archivos que DEBEN estar en la raíz
- `README.md` - Documentación principal del proyecto
- `package-lock.json` - Lockfile del monorepo (si aplica)
- Scripts de inicio (`start-*.bat`, `start-*.ps1`) - Útiles en la raíz

### 🗑️ Archivos a ELIMINAR o MOVER

#### Archivos Temporales/De Prueba:
- ❌ `.netlify-deploy-trigger` - Solo contiene "test", parece temporal
- ❌ `dominios.md` - Lista de dominios con precios, notas temporales

#### Documentación que debe organizarse:

**Guías de Configuración/Deployment:**
- `DEPLOYMENT.md` → `docs/deployment/`
- `CONFIGURAR_DOMINIO_GODADDY.md` → `docs/deployment/`
- `CONFIGURAR_NETLIFY_SUPABASE.md` → `docs/deployment/`
- `SUPABASE_SETUP.md` → `docs/deployment/`
- `SUPABASE_ENV_VARIABLES.md` → `docs/deployment/`

**Análisis Técnicos:**
- `ANALISIS_BOOST.md` → `docs/analysis/`
- `ANALISIS_CONSISTENCIA_FPS_WEBSOCKETS.md` → `docs/analysis/`
- `EXPLICACION_BACKPRESSURE.md` → `docs/analysis/`
- `FACTORES_LAG_ADICIONALES.md` → `docs/analysis/`

**Planes de Implementación:**
- `PLAN_EDITAR_NOMBRE_JUGADOR.md` → `docs/plans/`
- `PLAN_LEADERBOARD_CATEGORIES.md` → `docs/plans/`
- `PLAN_MATCHMAKING.md` → `docs/plans/`
- `PLAN_MONETIZACION_FREEMIUM.md` → `docs/plans/`
- `PLAN_OPTIMIZACION_WEBSOCKETS.md` → `docs/plans/`
- `PLAN_OPTIMIZACION.md` → `docs/plans/`
- `PLAN_SISTEMA_RANKING.md` → `docs/plans/`
- `PLAN_TRAILS_PREMIUM.md` → `docs/plans/`

**Guías de Desarrollo:**
- `FLUJO_IMPLEMENTACION.md` → `docs/development/`
- `INICIO_RAPIDO.md` → `docs/development/`
- `IMPLEMENTACION_INTERPOLACION_INPUT.md` → `docs/development/`
- `TESTING_LOOPS.md` → `docs/development/`

**Documentación de Configuración:**
- `ELIMINAR_LOGS_PRODUCCION.md` → `docs/configuration/`
- `CURRENCY_NAMES_PROPOSALS.md` → `docs/design/` o `docs/plans/`
- `Estilos.md` → `docs/design/`

## 📂 Estructura Propuesta

```
curve-io/
├── README.md                    ✅ Mantener en raíz
├── package-lock.json            ✅ Mantener en raíz (si es monorepo)
├── start-*.bat / start-*.ps1    ✅ Mantener en raíz (scripts útiles)
│
├── docs/
│   ├── deployment/              📦 Guías de despliegue
│   │   ├── DEPLOYMENT.md
│   │   ├── CONFIGURAR_DOMINIO_GODADDY.md
│   │   ├── CONFIGURAR_NETLIFY_SUPABASE.md
│   │   ├── SUPABASE_SETUP.md
│   │   └── SUPABASE_ENV_VARIABLES.md
│   │
│   ├── analysis/                🔍 Análisis técnicos
│   │   ├── ANALISIS_BOOST.md
│   │   ├── ANALISIS_CONSISTENCIA_FPS_WEBSOCKETS.md
│   │   ├── EXPLICACION_BACKPRESSURE.md
│   │   └── FACTORES_LAG_ADICIONALES.md
│   │
│   ├── plans/                   📋 Planes de implementación
│   │   ├── PLAN_EDITAR_NOMBRE_JUGADOR.md
│   │   ├── PLAN_LEADERBOARD_CATEGORIES.md
│   │   ├── PLAN_MATCHMAKING.md
│   │   ├── PLAN_MONETIZACION_FREEMIUM.md
│   │   ├── PLAN_OPTIMIZACION_WEBSOCKETS.md
│   │   ├── PLAN_OPTIMIZACION.md
│   │   ├── PLAN_SISTEMA_RANKING.md
│   │   ├── PLAN_TRAILS_PREMIUM.md
│   │   └── CURRENCY_NAMES_PROPOSALS.md
│   │
│   ├── development/             💻 Guías de desarrollo
│   │   ├── FLUJO_IMPLEMENTACION.md
│   │   ├── INICIO_RAPIDO.md
│   │   ├── IMPLEMENTACION_INTERPOLACION_INPUT.md
│   │   └── TESTING_LOOPS.md
│   │
│   ├── design/                  🎨 Documentación de diseño
│   │   └── Estilos.md
│   │
│   └── ORGANIZACION_DOCUMENTACION.md  (este archivo)
│
└── [resto del proyecto]
```

## 🗑️ Archivos a Eliminar

1. **`.netlify-deploy-trigger`** - Solo contiene "test", parece temporal
2. **`dominios.md`** - Notas temporales sobre dominios, no es documentación permanente

## ✅ Beneficios de la Organización

1. **Más fácil de navegar** - Documentación agrupada por categoría
2. **Raíz más limpia** - Solo archivos esenciales en la raíz
3. **Mejor mantenimiento** - Fácil encontrar y actualizar documentación
4. **Profesional** - Estructura clara y organizada

## 📝 Notas

- El `README.md` debe mantenerse en la raíz (estándar de proyectos)
- Los scripts de inicio (`start-*.bat`, `start-*.ps1`) son útiles en la raíz
- Si `package-lock.json` es del monorepo, mantenerlo en la raíz
- Crear un `docs/README.md` con índice de toda la documentación


