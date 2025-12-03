# 🔐 Variables de Entorno de Supabase para Producción

Esta guía te muestra exactamente qué variables de entorno configurar en Netlify y Railway.

## 📋 Variables a Configurar

### 🖥️ Railway (Servidor/Backend)

Ve a tu proyecto en Railway → **Settings** → **Variables** y agrega:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
FRONTEND_URL=https://tu-app.netlify.app
NODE_ENV=production
```

**🔒 IMPORTANTE DE SEGURIDAD:**
- **NUNCA** compartas tu `SUPABASE_SERVICE_ROLE_KEY` públicamente
- Obtén tus credenciales desde el Dashboard de Supabase → Settings → API
- Si tus credenciales fueron expuestas, **rótalas inmediatamente** en Supabase

**⚠️ IMPORTANTE:**
- Reemplaza `https://tu-app.netlify.app` con la URL real de tu sitio en Netlify
- `PORT` se asigna automáticamente por Railway, no lo configures

### 🌐 Netlify (Cliente/Frontend)

Ve a tu sitio en Netlify → **Site settings** (⚙️) → **Environment variables** y agrega:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
VITE_SERVER_URL=https://tu-servidor-production.up.railway.app
```

**🔒 IMPORTANTE DE SEGURIDAD:**
- Obtén tus credenciales desde el Dashboard de Supabase → Settings → API
- La `anon key` es pública pero debe usarse solo en el cliente con RLS habilitado

**⚠️ IMPORTANTE:**
- Reemplaza `https://tu-servidor-production.up.railway.app` con la URL real de tu servidor en Railway
- Después de agregar las variables, haz un **Redeploy** en Netlify

## 📝 Pasos Detallados

### Paso 1: Configurar Railway

1. Ve a [railway.app](https://railway.app) y abre tu proyecto
2. Click en tu servicio (el que tiene el servidor)
3. Ve a **Settings** (⚙️) en la parte superior
4. Click en **Variables** en el menú lateral
5. Click en **"New Variable"** o **"Add Variable"**
6. Agrega cada variable una por una:
   - **Key**: `SUPABASE_URL`
   - **Value**: `https://tu-proyecto.supabase.co` (obtén esta URL desde Supabase Dashboard → Settings → API)
   - Click en **"Add"**
7. Repite para las demás variables:
   - `SUPABASE_SERVICE_ROLE_KEY` = `tu-service-role-key-aqui` (obtén desde Supabase Dashboard → Settings → API → service_role key)
   - `FRONTEND_URL` = `https://tu-app.netlify.app` (tu URL de Netlify)
   - `NODE_ENV` = `production`
8. Railway hará un redeploy automáticamente cuando agregues variables

### Paso 2: Configurar Netlify

1. Ve a [app.netlify.com](https://app.netlify.com) y abre tu sitio
2. Ve a **Site settings** (⚙️) en el menú superior
3. Click en **Environment variables** en el menú lateral
4. Click en **"Add variable"**
5. Agrega cada variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://tu-proyecto.supabase.co` (obtén desde Supabase Dashboard → Settings → API)
   - **Scope**: Selecciona **"All scopes"** o **"Production"**
   - Click en **"Save"**
6. Repite para:
   - `VITE_SUPABASE_ANON_KEY` = `tu-anon-key-aqui` (obtén desde Supabase Dashboard → Settings → API → anon public key)
   - `VITE_SERVER_URL` = `https://tu-servidor-production.up.railway.app` (tu URL de Railway)
7. **IMPORTANTE**: Después de agregar las variables, ve a **Deploys** y haz click en **"Trigger deploy"** → **"Deploy site"** para redeployar con las nuevas variables

## ✅ Verificación

### Verificar Railway
1. Ve a **Deployments** en Railway
2. Click en el último deploy
3. Revisa los logs para verificar que las variables se están usando
4. Busca mensajes como "Supabase client initialized" o errores relacionados

### Verificar Netlify
1. Ve a **Deploys** en Netlify
2. Click en el último deploy
3. Revisa los logs del build
4. Verifica que no haya errores relacionados con variables de entorno

## 🔒 Seguridad

- ✅ **anon key** es segura para el cliente (usa RLS)
- ⚠️ **service_role key** es PRIVADA, solo para el servidor
- ❌ **NUNCA** expongas la service_role key en el cliente
- ✅ Las variables en Netlify/Railway están encriptadas
- ✅ **Credenciales en documentación:** Si tu repositorio es privado y no ha sido comprometido, no es necesario rotar las credenciales que estaban en la documentación. Solo rota si el repo es público o ha sido accedido por terceros.

## 🐛 Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que las variables estén escritas exactamente como se muestra (sin espacios extra)
- Asegúrate de haber hecho redeploy después de agregar las variables

### Error: "Failed to connect to Supabase"
- Verifica que la URL de Supabase sea correcta
- Asegúrate de que las keys sean las correctas (copiadas completas)

### Variables no se aplican en Netlify
- Haz un **Redeploy manual** después de agregar las variables
- Verifica que el Scope sea "All scopes" o "Production"



