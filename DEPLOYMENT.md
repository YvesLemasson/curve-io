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

### 3. Desplegar Frontend (Vercel)

1. Ir a [vercel.com](https://vercel.com)
2. Conectar repositorio
3. Configurar:
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 4. Desplegar Backend (Railway)

1. Ir a [railway.app](https://railway.app)
2. Conectar repositorio
3. Configurar:
   - **Root Directory**: `server`
   - **Start Command**: `npm start`
   - **Build Command**: `npm run build`
   - Variables de entorno:
     - `PORT` (auto)
     - `NODE_ENV=production`

### 5. Configurar CORS

En `server/src/index.ts`, actualizar CORS con la URL del frontend:

```typescript
cors: {
  origin: process.env.FRONTEND_URL || 'https://tu-app.vercel.app',
  methods: ['GET', 'POST'],
}
```

## 🔧 Variables de Entorno

### Server (.env)
```env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://tu-app.vercel.app
```

### Client (Vite)
```env
VITE_SERVER_URL=https://tu-server.railway.app
```

## 📝 Notas Importantes

1. **package-lock.json**: Ya está en `.gitignore` (opcional, algunos lo incluyen)
2. **node_modules**: No se sube (está en `.gitignore`)
3. **shared/**: Se sube al repo (código compartido)
4. **Builds**: Cada plataforma instala dependencias automáticamente

## 🎯 Recomendación Final

- **Desarrollo**: Monorepo local ✅
- **Producción**: 
  - Frontend → Vercel
  - Backend → Railway
  - Ambos conectados al mismo repo de GitHub

¡No habrá problemas para subir a internet! 🚀

