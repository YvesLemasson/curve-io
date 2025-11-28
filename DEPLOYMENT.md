# 🚀 Guía de Despliegue - curve.io

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
4. Configurar:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
5. Click en **"Deploy site"**
6. Una vez desplegado, copia la URL (ej: `https://tu-app.netlify.app`)

**Nota**: El archivo `client/netlify.toml` ya está configurado con estas opciones.

### 4. Desplegar Backend (Railway)

1. Ir a [railway.app](https://railway.app) y crear una cuenta
2. Click en **"New Project"** → **"Deploy from GitHub repo"**
3. Seleccionar tu repositorio `curve-io`
4. Configurar:
   - **Root Directory**: `server` (en Settings → Source)
   - Railway usará los archivos `nixpacks.toml` y `railway.json` para configurar el build automáticamente
5. En **Variables**, agregar:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://tu-app.netlify.app` (la URL de Netlify que copiaste)
6. Railway asignará automáticamente el `PORT` (no necesitas configurarlo)
7. Una vez desplegado, copia la URL pública (ej: `https://tu-servidor.railway.app`)

**Nota**: Los archivos `server/nixpacks.toml` y `server/railway.json` ya están configurados para que Railway sepa cómo construir y ejecutar el proyecto.

### 5. Configurar Variables de Entorno del Frontend

1. Volver a Netlify
2. Ir a **Site settings** → **Environment variables**
3. Agregar:
   - `VITE_SERVER_URL` = `https://tu-servidor.railway.app` (la URL de Railway que copiaste)
4. **Redeploy** el sitio para que tome la nueva variable

**Nota**: El CORS ya está configurado para usar `FRONTEND_URL` automáticamente.

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
VITE_SERVER_URL=https://tu-servidor.railway.app
```

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

**Solución paso a paso:**

1. **Configurar Root Directory en Railway:**
   - Ve a tu proyecto en Railway
   - Click en **Settings** → **Source**
   - En **Root Directory**, escribe: `server`
   - Guarda los cambios

2. **Verificar archivos de configuración:**
   - Asegúrate de que estos archivos estén en `server/`:
     - `package.json` ✅
     - `nixpacks.toml` ✅
     - `railway.json` ✅
     - `start.sh` ✅

3. **Si el error persiste, configura manualmente:**
   - Ve a **Settings** → **Deploy**
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start` (o `bash start.sh`)
   - Guarda y haz un redeploy

4. **Asegúrate de que el código esté en GitHub:**
   ```bash
   git add server/
   git commit -m "Agregar configuración de Railway"
   git push
   ```

5. **En Railway, haz un redeploy:**
   - Click en **Deployments** → **Redeploy** o espera a que detecte los cambios automáticamente

¡No habrá problemas para subir a internet! 🚀

