# Arquitectura Híbrida - curve.io Client

## 🎯 Decisión de Arquitectura

El cliente de curve.io usa una **arquitectura híbrida** que combina:
- **React** para UI compleja (menús, matchmaking, gestión de usuarios)
- **Vanilla TypeScript** para el juego (Canvas, game loop, lógica)

## 📐 Estructura

```
client/src/
├── game/          # Lógica del juego (Vanilla TS)
│   ├── player.ts
│   ├── collision.ts
│   └── game.ts
├── render/        # Renderizado Canvas (Vanilla TS)
│   └── canvas.ts
├── network/       # Comunicación con servidor (Vanilla TS)
│   └── client.ts
└── ui/            # Interfaz de usuario (React)
    ├── components/  # Componentes React
    │   ├── MainMenu.tsx
    │   ├── Matchmaking.tsx
    │   ├── GameHUD.tsx
    │   └── UserProfile.tsx
    ├── App.tsx      # Componente principal
    └── App.css
```

## 🔄 Cómo Funciona

### 1. Inicialización
- `main.tsx` monta React en `#root`
- React renderiza `App.tsx` que contiene el canvas
- El juego (Vanilla TS) se inicializa y toma control del canvas

### 2. Durante el Juego
- **Canvas**: Renderizado por Vanilla TS (60 FPS, game loop)
- **UI Overlay**: React maneja HUD, menús, overlays
- **Comunicación**: Eventos o estado compartido entre ambos

### 3. Comunicación React ↔ Game

```typescript
// Opción 1: Eventos personalizados
window.dispatchEvent(new CustomEvent('game:start'));
window.addEventListener('game:state', (e) => { ... });

// Opción 2: Estado compartido (singleton)
import { gameState } from '../game/gameState';
// React lee gameState, Game escribe gameState
```

## ✅ Ventajas

1. **Rendimiento**: Canvas sin overhead de React en el game loop
2. **Escalabilidad**: React para UI compleja (routing, forms, state management)
3. **Separación de responsabilidades**: UI y juego separados
4. **Flexibilidad**: Fácil agregar features complejas (matchmaking, perfiles)

## 🚀 Uso Futuro

Esta arquitectura permite fácilmente agregar:
- **React Router**: Para navegación entre pantallas
- **State Management**: Redux/Zustand para estado global de UI
- **Formularios**: React Hook Form para login/registro
- **Animaciones**: Framer Motion para transiciones
- **Matchmaking UI**: Componentes React complejos

El juego sigue siendo Vanilla TS para máximo rendimiento.

