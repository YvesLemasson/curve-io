# Plan de Implementación: Editar Nombre del Jugador

## Objetivo
Permitir que el jugador edite su nombre de visualización en el Player Info panel. El nombre se guardará en la base de datos y se usará cuando se una a una nueva partida. El nombre NO se puede cambiar durante una partida activa.

## Requisitos
1. ✅ El jugador puede editar su nombre en el Player Info panel (main panel)
2. ✅ El nombre se guarda en la base de datos (tabla `users`)
3. ✅ El nombre se carga desde la BD al iniciar sesión
4. ✅ El nombre se muestra en las pantallas de juego (leaderboard, game over, etc.)
5. ✅ El nombre NO se puede cambiar durante una partida activa
6. ✅ Cuando se inicia una nueva partida, se usa el nombre guardado

## Arquitectura Actual

### Flujo Actual del Nombre
1. **Cliente (App.tsx línea 797-800)**: Obtiene el nombre de:
   ```typescript
   user?.user_metadata?.full_name || user?.email?.split("@")[0] || `Player ${Math.random()}`
   ```
2. **Al unirse al lobby (App.tsx línea 810)**: Envía el nombre al servidor
3. **Servidor (index.ts línea 294)**: Recibe el nombre en `PlayerJoinMessage.name`
4. **Base de datos**: La tabla `users` tiene un campo `name` (supabase-schema.sql línea 13)

### Componentes Clave
- **Player Sidebar** (`App.tsx` líneas 1236-1293): Muestra el nombre pero no permite editarlo
- **UserModel** (`server/src/models/userModel.ts`): Maneja operaciones de BD para usuarios
- **AuthContext** (`client/src/auth/AuthContext.tsx`): Maneja autenticación y sesión

## Plan de Implementación

### Fase 1: Backend - API para Actualizar Nombre

#### 1.1 Extender UserModel
**Archivo**: `server/src/models/userModel.ts`

Agregar método para actualizar el nombre del usuario:
```typescript
/**
 * Actualiza el nombre de visualización del usuario
 */
static async updateDisplayName(
  userId: string,
  displayName: string
): Promise<User> {
  // Validar que el nombre no esté vacío y tenga longitud razonable
  if (!displayName || displayName.trim().length === 0) {
    throw new Error('El nombre no puede estar vacío');
  }
  if (displayName.trim().length > 50) {
    throw new Error('El nombre no puede tener más de 50 caracteres');
  }

  const { data, error } = await supabase
    .from('users')
    .update({ name: displayName.trim() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating display name:', error);
    throw new Error(`Failed to update display name: ${error.message}`);
  }

  return data;
}
```

#### 1.2 Endpoint REST en el Servidor
**Archivo**: `server/src/index.ts`

Agregar endpoint REST para actualizar el nombre:
```typescript
// Endpoint para actualizar el nombre del usuario
app.put('/api/user/display-name', async (req, res) => {
  try {
    const { userId, displayName } = req.body;
    
    if (!userId || !displayName) {
      return res.status(400).json({ error: 'userId y displayName son requeridos' });
    }

    // Validar que el usuario esté autenticado (opcional: verificar token)
    const updatedUser = await UserModel.updateDisplayName(userId, displayName);
    
    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Error updating display name:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Fase 2: Frontend - UI para Editar Nombre

#### 2.1 Estado para el Nombre Editado
**Archivo**: `client/src/ui/App.tsx`

Agregar estado para el nombre del jugador:
```typescript
const [playerDisplayName, setPlayerDisplayName] = useState<string>("");
const [isEditingName, setIsEditingName] = useState<boolean>(false);
const [nameEditValue, setNameEditValue] = useState<string>("");
```

#### 2.2 Cargar Nombre desde BD al Iniciar Sesión
**Archivo**: `client/src/ui/App.tsx`

En el `useEffect` que maneja cambios de usuario:
```typescript
useEffect(() => {
  const loadPlayerName = async () => {
    if (user?.id) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error loading player name:', error);
        }
        
        if (data?.name) {
          setPlayerDisplayName(data.name);
        } else {
          // Si no hay nombre en BD, usar el nombre por defecto
          const defaultName = user.user_metadata?.full_name || 
                             user.email?.split("@")[0] || 
                             "Player";
          setPlayerDisplayName(defaultName);
        }
      } catch (err) {
        console.error('Error loading player name:', err);
        // Fallback al nombre por defecto
        const defaultName = user.user_metadata?.full_name || 
                           user.email?.split("@")[0] || 
                           "Player";
        setPlayerDisplayName(defaultName);
      }
    } else {
      // Usuario no autenticado
      setPlayerDisplayName("Guest Player");
    }
  };
  
  loadPlayerName();
}, [user]);
```

#### 2.3 Función para Guardar Nombre
**Archivo**: `client/src/ui/App.tsx`

```typescript
const handleSaveDisplayName = async () => {
  if (!user?.id) {
    console.error('Usuario no autenticado');
    return;
  }

  const trimmedName = nameEditValue.trim();
  if (trimmedName.length === 0) {
    alert('El nombre no puede estar vacío');
    return;
  }

  if (trimmedName.length > 50) {
    alert('El nombre no puede tener más de 50 caracteres');
    return;
  }

  try {
    // Verificar que no estemos en una partida activa
    if (currentView === "game" && !gameOverState) {
      alert('No puedes cambiar tu nombre durante una partida activa');
      setIsEditingName(false);
      return;
    }

    // Actualizar en Supabase directamente (más simple que endpoint REST)
    const { data, error } = await supabase
      .from('users')
      .update({ name: trimmedName })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    setPlayerDisplayName(trimmedName);
    setIsEditingName(false);
    console.log('✅ Nombre actualizado:', trimmedName);
  } catch (error: any) {
    console.error('Error saving display name:', error);
    alert(`Error al guardar el nombre: ${error.message}`);
  }
};
```

#### 2.4 UI en Player Sidebar
**Archivo**: `client/src/ui/App.tsx`

Modificar la sección del nombre en el Player Sidebar (líneas 1261-1272):
```typescript
<div className="player-sidebar-info">
  {isEditingName ? (
    <div className="player-sidebar-name-edit">
      <input
        type="text"
        value={nameEditValue}
        onChange={(e) => setNameEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSaveDisplayName();
          } else if (e.key === 'Escape') {
            setIsEditingName(false);
            setNameEditValue(playerDisplayName);
          }
        }}
        className="player-sidebar-name-input"
        maxLength={50}
        autoFocus
      />
      <div className="player-sidebar-name-actions">
        <button
          onClick={handleSaveDisplayName}
          className="player-sidebar-name-save"
        >
          ✓
        </button>
        <button
          onClick={() => {
            setIsEditingName(false);
            setNameEditValue(playerDisplayName);
          }}
          className="player-sidebar-name-cancel"
        >
          ✕
        </button>
      </div>
    </div>
  ) : (
    <div 
      className="player-sidebar-name"
      onClick={() => {
        // Solo permitir editar si no estamos en una partida activa
        if (currentView === "game" && !gameOverState) {
          return; // No hacer nada si estamos en partida activa
        }
        setNameEditValue(playerDisplayName);
        setIsEditingName(true);
      }}
      style={{ 
        cursor: (currentView === "game" && !gameOverState) ? 'default' : 'pointer',
        opacity: (currentView === "game" && !gameOverState) ? 0.6 : 1
      }}
      title={
        (currentView === "game" && !gameOverState) 
          ? "No puedes cambiar tu nombre durante una partida" 
          : "Click para editar"
      }
    >
      {playerDisplayName || 
       (user
         ? user.user_metadata?.full_name ||
           user.email?.split("@")[0] ||
           "Player"
         : "Guest Player")}
      {!(currentView === "game" && !gameOverState) && (
        <span className="player-sidebar-name-edit-icon">✏️</span>
      )}
    </div>
  )}
  <div className="player-sidebar-email">
    {user?.email || "Playing as guest"}
  </div>
</div>
```

#### 2.5 Inicializar nameEditValue cuando se activa edición
**Archivo**: `client/src/ui/App.tsx`

Asegurar que cuando se activa la edición, se inicializa con el nombre actual:
```typescript
// En el onClick del nombre:
onClick={() => {
  if (currentView === "game" && !gameOverState) {
    return;
  }
  setNameEditValue(playerDisplayName || 
    (user
      ? user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Player"
      : "Guest Player"));
  setIsEditingName(true);
}}
```

### Fase 3: Usar Nombre Guardado al Unirse a Partida

#### 3.1 Modificar handleConnectToServer
**Archivo**: `client/src/ui/App.tsx`

Cambiar la línea 797-800 para usar `playerDisplayName`:
```typescript
const playerName = playerDisplayName || 
  user?.user_metadata?.full_name ||
  user?.email?.split("@")[0] ||
  `Player ${Math.floor(Math.random() * 1000)}`;
```

### Fase 4: Estilos CSS

#### 4.1 Agregar Estilos para Edición de Nombre
**Archivo**: `client/src/ui/App.css`

Agregar estilos para el input y botones de edición:
```css
.player-sidebar-name {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-sidebar-name-edit-icon {
  font-size: 0.8rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.player-sidebar-name:hover .player-sidebar-name-edit-icon {
  opacity: 1;
}

.player-sidebar-name-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.player-sidebar-name-input {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 500;
  font-family: "Inter", "Roboto", "Arial", sans-serif;
  width: 100%;
  outline: none;
  transition: all 0.3s;
}

.player-sidebar-name-input:focus {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.15);
}

.player-sidebar-name-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.player-sidebar-name-save,
.player-sidebar-name-cancel {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  padding: 6px 12px;
  color: #ffffff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
  font-family: "Inter", "Roboto", "Arial", sans-serif;
}

.player-sidebar-name-save:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: #4caf50;
}

.player-sidebar-name-cancel:hover {
  background: rgba(244, 67, 54, 0.3);
  border-color: #f44336;
}
```

### Fase 5: Validaciones y Edge Cases

#### 5.1 Validaciones
- ✅ Nombre no vacío
- ✅ Longitud máxima 50 caracteres
- ✅ No permitir edición durante partida activa
- ✅ Sanitizar entrada (trim)

#### 5.2 Edge Cases
- ✅ Usuario no autenticado: mostrar "Guest Player" y no permitir edición
- ✅ Error al cargar desde BD: usar nombre por defecto
- ✅ Error al guardar: mostrar mensaje y mantener estado anterior
- ✅ Partida activa: deshabilitar edición visualmente

## Resumen de Archivos a Modificar

1. **`server/src/models/userModel.ts`**: Agregar método `updateDisplayName`
2. **`client/src/ui/App.tsx`**: 
   - Agregar estados para nombre y edición
   - Cargar nombre desde BD al iniciar sesión
   - Agregar UI de edición en Player Sidebar
   - Usar nombre guardado al unirse a partida
3. **`client/src/ui/App.css`**: Agregar estilos para edición de nombre

## Orden de Implementación Recomendado

1. **Paso 1**: Agregar método `updateDisplayName` en UserModel (backend)
2. **Paso 2**: Agregar estados y carga de nombre en App.tsx (frontend)
3. **Paso 3**: Agregar UI de edición en Player Sidebar (frontend)
4. **Paso 4**: Agregar estilos CSS
5. **Paso 5**: Modificar `handleConnectToServer` para usar nombre guardado
6. **Paso 6**: Probar todos los casos edge

## Notas Técnicas

- **Almacenamiento**: El nombre se guarda en `users.name` en Supabase
- **Sincronización**: El nombre se carga al iniciar sesión y se actualiza inmediatamente en la UI
- **Persistencia**: El nombre persiste entre sesiones gracias a la BD
- **Restricción de Edición**: Se valida que `currentView !== "game" || gameOverState` antes de permitir edición
- **Fallback**: Si no hay nombre en BD, se usa `user_metadata.full_name` o `email` como fallback

## Preguntas Pendientes

1. ¿Debemos sincronizar el nombre con `user_metadata.full_name` de Supabase Auth?
   - **Respuesta sugerida**: No, mantener separado. El `display_name` es específico del juego.

2. ¿Qué hacer si el usuario cambia su nombre mientras está en el lobby?
   - **Respuesta sugerida**: Permitir el cambio, pero el nombre en el lobby se actualizará cuando se una a la siguiente partida (no durante la partida actual).

3. ¿Debemos validar nombres duplicados?
   - **Respuesta sugerida**: No, permitir nombres duplicados (múltiples jugadores pueden tener el mismo nombre).

