# curve.pw

Juego multijugador en tiempo real basado en "Achtung die Kurve".

## 🎮 Descripción

curve.pw es un juego .io donde múltiples jugadores controlan líneas que se mueven constantemente. El objetivo es ser el último en sobrevivir evitando colisiones con otras líneas y los bordes del área de juego.

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- npm o yarn

### Instalación

1. Instalar dependencias del cliente:
```bash
cd client
npm install
```

2. Instalar dependencias del servidor:
```bash
cd server
npm install
```

### Desarrollo

1. Iniciar el servidor:
```bash
cd server
npm run dev
```

2. Iniciar el cliente (en otra terminal):
```bash
cd client
npm run dev
```

3. Abrir el navegador en `http://localhost:3000`

## 📁 Estructura del Proyecto

```
curve-io/
├── client/          # Frontend (TypeScript + Vite)
├── server/          # Backend (Node.js + Socket.io)
└── shared/          # Código compartido (tipos, protocolo)
```

## 🛠️ Stack Tecnológico

- **Frontend**: 
  - **UI**: React, React Router (menús, matchmaking, gestión de usuarios)
  - **Juego**: TypeScript, Canvas API (game loop, renderizado)
  - **Red**: Socket.io-client
  - **Build**: Vite
- **Backend**: Node.js, TypeScript, Socket.io, Express
- **Comunicación**: WebSockets
- **Arquitectura**: Híbrida (React para UI compleja, Vanilla TS para juego)

## 📝 Estado del Proyecto

En desarrollo - Fase 0: Preparación ✅

## 🔧 Git y Despliegue

Este proyecto usa un **monorepo** (un solo repositorio para client, server y shared).

- ✅ Repositorio Git inicializado
- 📦 `.gitignore` configurado
- 📚 Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para guía de despliegue

### Comandos Git Básicos

```bash
# Ver estado
git status

# Agregar cambios
git add .

# Commit
git commit -m "Descripción del cambio"

# Subir a GitHub/GitLab (después de crear el repo remoto)
git remote add origin https://github.com/tu-usuario/curve-io.git
git push -u origin main
```

## 📄 Licencia

MIT

