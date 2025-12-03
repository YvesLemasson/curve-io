# 🚀 Guía de Despliegue - curve.pw

## 📦 Estructura del Repositorio

**Monorepo (un solo repositorio)** - Recomendado para este proyecto.

```
curve-io/          # Repositorio Git único
├── client/        # Frontend
├── server/        # Backend
└── shared/        # Código compartido
```

### ¿Por qué Monorepo?

✅ **Ventajas:**
- Código compartido (`shared/`) en el mismo repo
- Versionado conjunto (client y server sincronizados)
- Historial unificado
- Despliegue más simple
- CI/CD más fácil

❌ **Repos Separados:**
- Más complejo de mantener
- Sincronización manual de `shared/`
- Dos pipelines de CI/CD
- Más difícil de versionar

## 🌐 Opciones de Despliegue

### Opción 1: Despliegue Separado (Recomendado para producción)

#### Frontend (Client)
- **Vercel** (recomendado para React/Vite)
- **Netlify**
- **Cloudflare Pages**
- **GitHub Pages**

#### Backend (Server)
- **Railway** (recomendado - fácil y gratis)
- **Render**
- **Fly.io**
- **Heroku**
- **DigitalOcean App Platform**
- **AWS/GCP/Azure** (más complejo)

### Opción 2: Despliegue Conjunto

- **Docker + Docker Compose** (VPS propio)
- **Kubernetes** (más complejo)
- **AWS Amplify** (full-stack)

## 📋 Pasos para Desplegar

### 1. Preparar el Repositorio

```bash
# Ya está hecho ✅
git init
git add .
git commit -m "Initial commit"
```

### 2. Subir a GitHub/GitLab

```bash
# Crear repo en GitHub/GitLab
git remote add origin https://github.com/tu-usuario/curve-io.git
git branch -M main
git push -u origin main
```

### 3. Desplegar Frontend (Netlify)

1. Ir a [netlify.com](https://netlify.com) y crear una cuenta
2. Click en **"Add new site"** → **"Import an existing project"**
3. Conectar con GitHub y seleccionar tu repositorio `curve-io`
4. **Configurar manualmente (IMPORTANTE):**
   - **Base directory**: `client` ⚠️ (esto le dice a Netlify que busque el código en `client/`)
   - **Package directory**: `client/` (opcional, para monorepos)
   - **Build command**: `npm run build` ⚠️ (comando para construir el proyecto)
   - **Publish directory**: `dist` ⚠️ (directorio donde Vite genera los archivos estáticos)
     - **IMPORTANTE**: Como el Base directory es `client`, el path relativo es solo `dist`, **NO** `client/dist`
     - Si pones `client/dist`, Netlify buscará en `client/client/dist` y fallará
5. Click en **"Deploy site"**
6. Una vez desplegado, copia la URL (ej: `https://tu-app.netlify.app`)

**Nota**: El archivo `client/netlify.toml` también está configurado como respaldo, pero es mejor configurarlo manualmente la primera vez para asegurarte de que funcione correctamente.

### 4. Desplegar Backend (Railway)

1. Ir a [railway.app](https://railway.app) y crear una cuenta
2. Click en **"New Project"** → **"Deploy from GitHub repo"**
3. Seleccionar tu repositorio `curve-io`
4. **IMPORTANTE - Configurar Root Directory:**
   - Después de conectar el repo, ve a **Settings** (⚙️) → **Source**
   - En **Root Directory**, escribe exactamente: `server` (sin barra al final)
   - **Guarda los cambios** (esto es crítico)
5. Configurar comandos de build (si Railway no los detecta automáticamente):
   - Ve a **Settings** → **Deploy**
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - Guarda los cambios
6. En **Variables** (Settings → Variables), agregar:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://tu-app.netlify.app` (la URL de Netlify que copiaste)
7. Railway asignará automáticamente el `PORT` (no necesitas configurarlo)
8. Haz un **Redeploy** para aplicar los cambios
9. **Generar y obtener la URL pública de Railway:**
   - Ve a **Settings** → **Networking** → **Public Networking**
   - Click en **"Generate Domain"** (botón morado con rayo ⚡)
   - En el campo **"Enter the port your app is listening on"**, Railway puede mostrar un puerto por defecto
   - **IMPORTANTE**: Como tu servidor usa `process.env.PORT`, Railway asignará el puerto automáticamente
   - Si el campo muestra un puerto (ej: 8080), puedes dejarlo así o cambiarlo al puerto que Railway está usando
   - Para verificar el puerto, ve a **Settings** → **Variables** y busca `PORT`, o revisa los logs del deploy
   - Click en **"Generate Domain"**
   - Railway generará una URL como: `https://tu-servidor-production.up.railway.app`
   - **Copia esta URL completa** (incluyendo `https://`)

**Nota**: Los archivos `server/nixpacks.toml`, `server/railway.json` y `server/start.sh` ya están configurados, pero el **Root Directory** debe estar configurado en la interfaz de Railway.

### 5. Configurar Variables de Entorno del Frontend

1. **Obtener la URL de Railway:**
   - En Railway, ve a tu servicio
   - Busca la sección **"Networking"** o **"Public Domain"** en la pestaña principal
   - O ve a **Settings** → **Networking** → **Public Networking**
   - Copia la URL completa (ej: `https://tu-servidor-production.up.railway.app`)
   - ⚠️ **IMPORTANTE**: Asegúrate de copiar la URL completa con `https://`

2. **Configurar en Netlify:**
   - Ve a tu sitio en Netlify
   - Click en **Site settings** (⚙️) → **Environment variables**
   - Click en **"Add variable"**
   - **Key**: `VITE_SERVER_URL`
   - **Value**: Pega la URL de Railway (ej: `https://tu-servidor-production.up.railway.app`)
   - **Scope**: Selecciona **"All scopes"** o **"Production"**
   - Click en **"Save"**

3. **Redeploy en Netlify:**
   - Ve a **Deploys**
   - Click en los tres puntos (⋯) del último deploy → **"Redeploy"**
   - O haz un nuevo commit y push a GitHub

**Nota**: El CORS ya está configurado para usar `FRONTEND_URL` automáticamente. Asegúrate de haber configurado `FRONTEND_URL` en Railway con la URL de Netlify.

## 🔧 Variables de Entorno

### Server (Railway)
Configurar en Railway → Variables:
```env
NODE_ENV=production
FRONTEND_URL=https://tu-app.netlify.app
```
**Nota**: `PORT` se asigna automáticamente por Railway, no es necesario configurarlo.

### Client (Netlify)
Configurar en Netlify → Site settings → Environment variables:
```env
VITE_SERVER_URL=https://tu-servidor-production.up.railway.app
```
**Nota**: La URL de Railway generalmente tiene el formato `https://[nombre]-production.up.railway.app`

### Desarrollo Local
Para desarrollo local, crear archivos `.env` (no se suben a Git):

**`server/.env`**:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**`client/.env`**:
```env
VITE_SERVER_URL=http://localhost:3001
```

## 📝 Notas Importantes

1. **package-lock.json**: Ya está en `.gitignore` (opcional, algunos lo incluyen)
2. **node_modules**: No se sube (está en `.gitignore`)
3. **shared/**: Se sube al repo (código compartido)
4. **Builds**: Cada plataforma instala dependencias automáticamente

## 🎯 Recomendación Final

- **Desarrollo**: Monorepo local ✅
- **Producción**: 
  - Frontend → **Netlify** ✅
  - Backend → **Railway** ✅
  - Ambos conectados al mismo repo de GitHub

## ✅ Checklist de Despliegue

- [ ] Repositorio subido a GitHub
- [ ] Frontend desplegado en Netlify
- [ ] Backend desplegado en Railway
- [ ] Variable `FRONTEND_URL` configurada en Railway
- [ ] Variable `VITE_SERVER_URL` configurada en Netlify
- [ ] Redeploy del frontend después de configurar variables
- [ ] Probar conexión entre frontend y backend

## 🐛 Troubleshooting

### El frontend no se conecta al backend
- Verifica que `VITE_SERVER_URL` esté configurada en Netlify
- Asegúrate de hacer **redeploy** después de agregar la variable
- Verifica que la URL de Railway sea correcta (debe incluir `https://`)

### Error de CORS
- Verifica que `FRONTEND_URL` en Railway sea exactamente la URL de Netlify
- Asegúrate de que no haya `/` al final de las URLs
- Verifica que Railway esté usando la variable de entorno correctamente

### El build falla en Railway - "Railpack could not determine how to build"
Este error ocurre cuando Railway analiza la raíz del repositorio en lugar del directorio `server/`.

**⚠️ SOLUCIÓN CRÍTICA - Sigue estos pasos exactos:**

1. **Configurar Root Directory (ESTO ES LO MÁS IMPORTANTE):**
   - En Railway, ve a tu servicio/proyecto
   - Click en **Settings** (⚙️) en la parte superior
   - Click en **Source** en el menú lateral
   - Busca el campo **"Root Directory"**
   - **Borra cualquier valor que tenga** y escribe exactamente: `server`
   - **NO pongas barra al final** (no `server/`, solo `server`)
   - Click en **"Save"** o **"Update"**
   - ⚠️ **ESPERA** a que Railway guarde los cambios (puede tardar unos segundos)

2. **Configurar comandos manualmente (si es necesario):**
   - Ve a **Settings** → **Deploy**
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - Guarda los cambios

3. **Hacer Redeploy:**
   - Ve a la pestaña **Deployments**
   - Click en **"Redeploy"** o en los tres puntos (⋯) → **"Redeploy"**
   - O simplemente haz un nuevo commit y push a GitHub

4. **Verificar que los archivos estén en GitHub:**
   ```bash
   git add server/nixpacks.toml server/railway.json server/start.sh
   git commit -m "Agregar configuración de Railway"
   git push
   ```

**Si después de configurar Root Directory sigue fallando:**
- Verifica que escribiste `server` exactamente (sin mayúsculas, sin espacios)
- Asegúrate de haber guardado los cambios en Railway
- Espera 30-60 segundos después de guardar antes de hacer redeploy
- Verifica en los logs de Railway que ahora está buscando en el directorio `server/`

¡No habrá problemas para subir a internet! 🚀

