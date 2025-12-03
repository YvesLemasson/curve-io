# Guía de Configuración de Supabase para curve.io

Esta guía te ayudará a configurar Supabase para autenticación con Google y almacenamiento de partidas.

## 📋 Pasos de Configuración

### 1. Crear las Tablas en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **SQL Editor** (en el menú lateral)
3. Abre el archivo `server/supabase-schema.sql`
4. Copia todo el contenido SQL
5. Pégalo en el SQL Editor de Supabase
6. Haz clic en **Run** (o presiona Ctrl+Enter)
7. Verifica que no haya errores

### 2. Obtener las Keys de Supabase

1. En el Dashboard de Supabase, ve a **Settings** → **API**
2. Encontrarás:
   - **Project URL**: `https://nujwbmtbbhyesosokggr.supabase.co` (tu URL será diferente)
   - **anon public key**: Esta es la clave pública (segura para el cliente)
   - **service_role key**: Esta es la clave privada (solo para el servidor, NO la expongas al cliente)

### 3. Configurar Variables de Entorno

#### En el Servidor (`server/.env`):

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
PORT=3001
FRONTEND_URL=http://localhost:3000
```

#### En el Cliente (`client/.env`):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

**⚠️ IMPORTANTE:**
- Crea archivos `.env` (no `.env.example`) en ambas carpetas
- Agrega `.env` a `.gitignore` para no subir las keys a Git
- El `service_role_key` es SENSIBLE, nunca lo expongas en el cliente

### 4. Configurar Autenticación con Google

#### Paso 4.1: Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a **APIs & Services** → **Credentials**
4. Haz clic en **Create Credentials** → **OAuth client ID**
5. Si es la primera vez, configura la pantalla de consentimiento OAuth
6. Selecciona **Web application** como tipo
7. Configura:
   - **Name**: curve.io (o el nombre que prefieras)
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (desarrollo)
     - `https://tu-dominio.com` (producción)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/auth/callback` (desarrollo)
     - `https://tu-dominio.com/auth/callback` (producción)
8. Guarda y copia el **Client ID** y **Client Secret**

#### Paso 4.2: Configurar en Supabase

1. En Supabase Dashboard, ve a **Authentication** → **Providers**
2. Busca **Google** en la lista
3. Activa el toggle de Google
4. Ingresa:
   - **Client ID (for OAuth)**: El Client ID de Google
   - **Client Secret (for OAuth)**: El Client Secret de Google
5. Haz clic en **Save**

#### Paso 4.3: Configurar Redirect URL en Supabase

1. Ve a **Authentication** → **URL Configuration**
2. Agrega a **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (desarrollo)
   - `https://tu-dominio.com/auth/callback` (producción)
3. Guarda los cambios

### 5. Verificar la Configuración

1. Inicia el servidor: `cd server && npm run dev`
2. Inicia el cliente: `cd client && npm run dev`
3. Deberías poder hacer login con Google

## 🔍 Verificación de Tablas

Para verificar que las tablas se crearon correctamente:

1. Ve a **Table Editor** en Supabase Dashboard
2. Deberías ver estas tablas:
   - `users`
   - `games`
   - `game_participants`
   - `player_stats`

## 📊 Estructura de Datos

### users
- Perfiles de usuario extendiendo `auth.users`
- Se crea automáticamente cuando un usuario se autentica

### games
- Registro de todas las partidas
- `status`: 'waiting', 'playing', 'finished'
- `winner_id`: ID del jugador ganador

### game_participants
- Participantes en cada partida
- `position`: 1 = ganador, 2 = segundo, etc.
- `score`: Puntos del jugador en esa partida

### player_stats
- Estadísticas agregadas por jugador
- Se actualiza automáticamente cuando se crea un `game_participant`
- Incluye: total_games, total_wins, total_score, best_score

## 🚀 Próximos Pasos

1. ✅ Configurar variables de entorno
2. ✅ Ejecutar el schema SQL
3. ✅ Configurar Google OAuth
4. Integrar AuthContext en tu App.tsx
5. Agregar botón de login en la UI
6. Integrar guardado de partidas en gameServer.ts

## 🐛 Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que los archivos `.env` existan y tengan las variables correctas
- Reinicia el servidor después de crear/modificar `.env`

### Error: "Failed to create game"
- Verifica que las tablas se hayan creado correctamente
- Revisa los logs del servidor para más detalles

### Error al hacer login con Google
- Verifica que las Redirect URLs estén configuradas correctamente
- Asegúrate de que el Client ID y Secret sean correctos
- Revisa la consola del navegador para errores

### RLS (Row Level Security) bloqueando operaciones
- Las políticas RLS están configuradas en el schema
- Si necesitas ajustarlas, ve a **Authentication** → **Policies** en Supabase



