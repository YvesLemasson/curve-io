# 📝 Crear archivo .env para el servidor

## Pasos para configurar las variables de entorno

### 1. Obtener las credenciales de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Settings** → **API**
3. Encontrarás:
   - **Project URL**: `https://xxxxx.supabase.co` (copia esta URL)
   - **service_role key**: Esta es la clave privada (copia esta key)

### 2. Crear el archivo .env

En la carpeta `server`, crea un archivo llamado `.env` (sin extensión) con el siguiente contenido:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Reemplaza:**
- `https://tu-proyecto.supabase.co` con tu Project URL real
- `tu-service-role-key-aqui` con tu service_role key real

### 3. Ejemplo de archivo .env completo

```env
SUPABASE_URL=https://nujwbmtbbhyesosokggr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51andibXRiYmh5ZXNvc29rZ2dyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5ODk2NzIwMCwiZXhwIjoyMDE0NTQzMjAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### 4. Verificar que el archivo existe

El archivo `.env` debe estar en:
```
server/.env
```

### 5. Reiniciar el servidor

Después de crear el archivo `.env`, reinicia el servidor:

```bash
# Detén el servidor (Ctrl+C) y vuelve a iniciarlo
npm run dev
```

## ⚠️ Importante

- **NUNCA** subas el archivo `.env` a Git (ya está en `.gitignore`)
- **NUNCA** compartas tu `SUPABASE_SERVICE_ROLE_KEY` públicamente
- El `service_role key` tiene permisos completos, úsalo solo en el servidor

## ✅ Verificación

Si todo está bien configurado, deberías ver:

```
🚀 Servidor curve.io corriendo en puerto 3001
📡 WebSocket disponible en ws://localhost:3001
```

Si ves un error sobre variables de entorno faltantes, verifica que:
1. El archivo `.env` existe en `server/.env`
2. Las variables están escritas correctamente (sin espacios extra)
3. No hay comillas alrededor de los valores (a menos que sean necesarias)

