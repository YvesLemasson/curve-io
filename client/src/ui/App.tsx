// Componente principal de la aplicación React
// Maneja routing y estructura general de la UI

import { useState, useEffect, useRef } from 'react';
import { Game } from '../game/game';
import './App.css';

// Importar Game aquí para evitar error de referencia circular
// import { NetworkClient } from '../network/client';

// Componente de barra de boost
function BoostBar({ charge, active, remaining }: { charge: number; active: boolean; remaining: number }) {
  const remainingSeconds = (remaining / 1000).toFixed(1);
  
  return (
    <div className="boost-bar-container">
      <div className="boost-label">BOOST</div>
      <div className="boost-bar">
        <div 
          className={`boost-fill ${active ? 'boost-active' : ''}`}
          style={{ width: `${charge}%` }}
        />
      </div>
      {active && (
        <div className="boost-timer">{remainingSeconds}s</div>
      )}
    </div>
  );
}

// Componente del modal de fin de partida
function GameOverModal({ 
  gameState, 
  onBackToMenu 
}: { 
  gameState: { players: Array<{ id: string; name: string; color: string; alive: boolean }>; winnerId?: string; tick: number } | null;
  onBackToMenu: () => void;
}) {
  if (!gameState) return null;

  const winner = gameState.winnerId 
    ? gameState.players.find(p => p.id === gameState.winnerId)
    : null;
  const deadPlayers = gameState.players.filter(p => !p.alive);
  const gameDuration = Math.floor(gameState.tick / 60); // Aproximadamente segundos (60 ticks por segundo)

  return (
    <div className="game-over-modal-overlay">
      <div className="game-over-modal">
        <h1 className="game-over-title">
          {winner ? '🏆 ¡Partida Finalizada!' : '🤝 Empate'}
        </h1>
        
        <div className="game-over-content">
          {/* Columna izquierda: Información de la partida */}
          <div className="game-over-left">
            {winner ? (
              <div className="winner-section">
                <div className="winner-name" style={{ color: winner.color }}>
                  {winner.name}
                </div>
                <p className="winner-label">es el ganador</p>
              </div>
            ) : (
              <div className="tie-section">
                <p>Todos los jugadores fueron eliminados</p>
              </div>
            )}

            <div className="game-summary">
              <h2>Resumen de la Partida</h2>
              
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Duración:</span>
                  <span className="stat-value">{gameDuration}s</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total de jugadores:</span>
                  <span className="stat-value">{gameState.players.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha: Información de jugadores */}
          <div className="game-over-right">
            <div className="players-summary">
              <h3>Jugadores</h3>
              <div className="players-list-summary">
                {winner && (
                  <div className="player-summary-item winner-item">
                    <div 
                      className="player-color-indicator" 
                      style={{ backgroundColor: winner.color }}
                    />
                    <span className="player-name-summary">{winner.name}</span>
                    <span className="player-status winner-status">🏆 Ganador</span>
                  </div>
                )}
                {deadPlayers.map((player) => (
                  <div key={player.id} className="player-summary-item">
                    <div 
                      className="player-color-indicator" 
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="player-name-summary">{player.name}</span>
                    <span className="player-status eliminated-status">Eliminado</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={onBackToMenu}
          className="back-to-menu-button"
        >
          Volver al Menú
        </button>
      </div>
    </div>
  );
}

// Componente del modal de selección de color
function ColorPickerModal({ 
  isOpen, 
  currentColor,
  usedColors,
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean;
  currentColor: string;
  usedColors: Set<string>;
  onClose: () => void;
  onConfirm: (color: string) => void;
}) {
  const [selectedColor, setSelectedColor] = useState<string>(currentColor);

  // 16 colores predefinidos
  const availableColors = [
    '#ff0000', // Rojo
    '#00ff00', // Verde
    '#0000ff', // Azul
    '#ffff00', // Amarillo
    '#ff00ff', // Magenta
    '#00ffff', // Cyan
    '#ff8000', // Naranja
    '#8000ff', // Morado
    '#ff0080', // Rosa
    '#00ff80', // Verde claro
    '#0080ff', // Azul claro
    '#ff8080', // Rosa claro
    '#80ff80', // Verde menta
    '#8080ff', // Azul claro
    '#ffff80', // Amarillo claro
    '#ff80ff', // Rosa magenta
  ];

  if (!isOpen) return null;

  return (
    <div className="color-picker-modal-overlay" onClick={onClose}>
      <div className="color-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Seleccionar Color</h2>
        <div className="color-picker-grid">
          {availableColors.map((color) => {
            const isUsed = usedColors.has(color) && color !== currentColor;
            const isSelected = selectedColor === color;
            return (
              <button
                key={color}
                className={`color-option ${isSelected ? 'selected' : ''} ${isUsed ? 'used' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => !isUsed && setSelectedColor(color)}
                disabled={isUsed}
                title={isUsed ? 'Color en uso' : color}
              >
                {isSelected && <span className="check-mark">✓</span>}
                {isUsed && <span className="used-mark">✗</span>}
              </button>
            );
          })}
        </div>
        <div className="color-picker-actions">
          <button 
            className="color-picker-cancel"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            className="color-picker-confirm"
            onClick={() => {
              if (selectedColor && !usedColors.has(selectedColor) || selectedColor === currentColor) {
                onConfirm(selectedColor);
              }
            }}
            disabled={usedColors.has(selectedColor) && selectedColor !== currentColor}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState<'menu' | 'game' | 'lobby'>('menu');
  const [boostState, setBoostState] = useState<{ active: boolean; charge: number; remaining: number } | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [gameOverState, setGameOverState] = useState<{ players: Array<{ id: string; name: string; color: string; alive: boolean }>; winnerId?: string; tick: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState<boolean>(false);
  const [touchLeft, setTouchLeft] = useState<boolean>(false);
  const [touchRight, setTouchRight] = useState<boolean>(false);
  const gameRef = useRef<Game | null>(null);

  // Manejar el evento beforeinstallprompt para PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir el prompt automático
      e.preventDefault();
      // Guardar el evento para usarlo después
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Verificar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Función para instalar la PWA
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt();

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('Usuario aceptó la instalación');
    } else {
      console.log('Usuario rechazó la instalación');
    }

    // Limpiar el prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  // Inicializar juego cuando se monta el componente
  useEffect(() => {
    if (!gameRef.current) {
      try {
        gameRef.current = new Game('gameCanvas');
      } catch (error) {
        console.error('Error al inicializar el juego:', error);
      }
    }

    // Cleanup al desmontar
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);
  
  // Actualizar estado del boost cada frame
  useEffect(() => {
    if (currentView !== 'game' || !gameRef.current) return;
    
    const interval = setInterval(() => {
      if (gameRef.current) {
        const state = gameRef.current.getLocalPlayerBoostState();
        setBoostState(state);
      }
    }, 16); // ~60 FPS
    
    return () => clearInterval(interval);
  }, [currentView]);

  // Monitorear el estado del juego para detectar cuando termina
  useEffect(() => {
    if (currentView !== 'game' || !gameRef.current) return;
    
    // Variable para evitar mostrar el modal múltiples veces
    let gameOverShown = false;
    
    const interval = setInterval(() => {
      if (gameRef.current && !gameOverShown) {
        const gameState = gameRef.current.getGameState();
        if (gameState.gameStatus === 'finished' || gameState.gameStatus === 'ended') {
          // El juego terminó, mostrar modal
          gameOverShown = true;
          const players = gameRef.current.getPlayers();
          setGameOverState({
            players: players.map(p => ({
              id: p.id,
              name: p.name,
              color: p.color,
              alive: p.alive
            })),
            winnerId: gameState.winnerId,
            tick: gameState.tick
          });
          
          // IMPORTANTE: Desactivar input cuando se muestra el modal
          // Esto permite que los toques lleguen al modal
          const inputManager = gameRef.current.getInputManager();
          inputManager.setGameActive(false);
        }
      }
    }, 50); // Verificar cada 50ms para detectar más rápido
    
    return () => clearInterval(interval);
  }, [currentView]);

  // Desactivar input cuando hay un modal abierto
  useEffect(() => {
    if (gameRef.current && gameOverState) {
      const inputManager = gameRef.current.getInputManager();
      inputManager.setGameActive(false);
    }
  }, [gameOverState]);

  // Función para conectar al servidor y mostrar lobby
  const handleConnectToServer = () => {
    // Si ya existe un juego con red, limpiarlo primero
    if (gameRef.current) {
      if (gameRef.current.isUsingNetwork()) {
        gameRef.current.destroy();
      } else {
        gameRef.current.destroy();
      }
    }

    // Crear nuevo juego con red
    try {
      gameRef.current = new Game('gameCanvas', true);
      
      // Configurar callback para estado de toques (feedback visual)
      const inputManager = gameRef.current.getInputManager();
      inputManager.onTouchStateChange((left, right) => {
        setTouchLeft(left);
        setTouchRight(right);
      });
    } catch (error) {
      console.error('Error al inicializar el juego:', error);
      return;
    }

    const networkClient = gameRef.current.getNetworkClient();
    if (!networkClient) {
      console.error('No se pudo obtener el cliente de red');
      return;
    }

    // IMPORTANTE: Configurar callbacks ANTES de conectar para que estén listos cuando lleguen los eventos
    networkClient.onLobbyPlayers((data) => {
      setLobbyPlayers(data.players);
    });

    networkClient.onPlayerJoined((data) => {
      setLocalPlayerId(data.playerId);
      // También actualizar el localPlayerId en la instancia de Game
      // para que el juego pueda enviar inputs correctamente
      if (gameRef.current) {
        gameRef.current.setLocalPlayerId(data.playerId);
      }
    });

    networkClient.onGameStart(() => {
      // Cuando el servidor inicia el juego, iniciar el juego local también
      // IMPORTANTE: En modo red NO llamamos init() porque los jugadores
      // se crean desde el estado del servidor en syncFromServer()
      if (gameRef.current) {
        // Limpiar cualquier jugador local previo
        gameRef.current.clearPlayers();
        // Solo iniciar el game loop, los jugadores vendrán del servidor
        gameRef.current.start();
        setCurrentView('game');
      }
    });

    networkClient.onError((error) => {
      console.error('Error de red:', error);
      alert(`Error: ${error}`);
    });

    networkClient.onConnect(() => {
      // Cuando se conecta, unirse al lobby
      setTimeout(() => {
        if (gameRef.current) {
          const playerName = `Player ${Math.floor(Math.random() * 1000)}`;
          gameRef.current.joinLobby(playerName);
        }
      }, 100);
    });

    // Cambiar a vista de lobby primero
    setCurrentView('lobby');
    
    // Conectar al servidor
    networkClient.connect();
  };

  // Función para iniciar el juego local
  const handleStartLocalGame = () => {
    if (gameRef.current) {
      // Si ya existe, destruirlo y crear uno nuevo
      if (gameRef.current.isUsingNetwork()) {
        gameRef.current.destroy();
        gameRef.current = new Game('gameCanvas', false);
      }
      
      gameRef.current.init(4); // 4 jugadores
      gameRef.current.start();
      setCurrentView('game');
    }
  };

  // Función para solicitar inicio del juego desde el lobby
  const handleStartGameFromLobby = () => {
    const networkClient = gameRef.current?.getNetworkClient();
    if (networkClient) {
      networkClient.requestStartGame();
    }
  };

  // Función para reiniciar el juego
  const handleRestart = () => {
    if (gameRef.current) {
      gameRef.current.stop();
      gameRef.current.init(4);
      gameRef.current.start();
      setCurrentView('game');
      setGameOverState(null);
    }
  };

  // Función para volver al menú desde el modal de fin de partida
  const handleBackToMenuFromGameOver = () => {
    if (gameRef.current) {
      gameRef.current.stop();
      if (gameRef.current.isUsingNetwork()) {
        const networkClient = gameRef.current.getNetworkClient();
        if (networkClient) {
          networkClient.disconnect();
        }
        gameRef.current.destroy();
        gameRef.current = new Game('gameCanvas');
      }
    }
    setGameOverState(null);
    setCurrentView('menu');
    setLobbyPlayers([]);
    // Limpiar estado de toques
    setTouchLeft(false);
    setTouchRight(false);
  };

  // Obtener el color del jugador local para el feedback visual
  const getLocalPlayerColor = (): string => {
    if (gameRef.current) {
      const players = gameRef.current.getPlayers();
      const localPlayer = players.find(p => p.id === localPlayerId || (!gameRef.current?.isUsingNetwork() && players.indexOf(p) === 0));
      return localPlayer?.color || '#ffffff';
    }
    return '#ffffff';
  };

  // Convertir color hex a rgba con opacidad para el gradiente
  const getLocalPlayerColorWithOpacity = (opacity: number = 0.3): string => {
    const color = getLocalPlayerColor();
    // Si es un color hex (#rrggbb), convertirlo a rgba
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Si ya es rgba o rgb, mantenerlo
    return color;
  };

  return (
    <div className="app">
      {/* Canvas del juego */}
      <canvas 
        id="gameCanvas" 
        style={{ 
          zIndex: 1,
          display: 'block'
        }} 
      />
      
      {/* Feedback visual táctil - solo en modo juego */}
      {currentView === 'game' && !gameOverState && (
        <>
          {/* Overlay izquierdo */}
          <div 
            className="touch-feedback touch-feedback-left"
            style={{
              opacity: touchLeft ? 1 : 0,
              '--touch-feedback-color': touchLeft ? getLocalPlayerColorWithOpacity(0.4) : 'transparent',
            } as React.CSSProperties}
          />
          {/* Overlay derecho */}
          <div 
            className="touch-feedback touch-feedback-right"
            style={{
              opacity: touchRight ? 1 : 0,
              '--touch-feedback-color': touchRight ? getLocalPlayerColorWithOpacity(0.4) : 'transparent',
            } as React.CSSProperties}
          />
        </>
      )}
      
      {/* UI Overlay - React maneja menús, HUD, etc. */}
      <div 
        className="ui-overlay" 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%',
          zIndex: 10,
          pointerEvents: (currentView === 'game' && !gameOverState) ? 'none' : 'auto'
        }}
      >
        {currentView === 'menu' && (
          <div className="main-menu">
            {showInstallButton && (
              <button 
                onClick={handleInstallClick}
                className="install-button"
                title="Instalar aplicación"
              >
                📱 Instalar App
              </button>
            )}
            <h1>curve.io</h1>
            <p>Juego multijugador en tiempo real</p>
            <button 
              onClick={handleStartLocalGame}
              className="start-button"
            >
              Juego Local
            </button>
            <button 
              onClick={handleConnectToServer}
              className="start-button"
              style={{ background: '#2196F3', marginTop: '10px' }}
            >
              Conectar al Servidor
            </button>
            <div className="controls-info">
              <p>Controles:</p>
              <p>A / ← : Girar izquierda</p>
              <p>D / → : Girar derecha</p>
              <p>A + D : Activar boost (velocidad +50%)</p>
            </div>
          </div>
        )}

        {currentView === 'lobby' && (
          <div className="lobby">
            <h1>Sala de Espera</h1>
            <div className="lobby-players">
              <h2>Jugadores ({lobbyPlayers.length})</h2>
              <div className="players-list">
                {lobbyPlayers.length === 0 ? (
                  <p className="waiting-text">Esperando jugadores...</p>
                ) : (
                  lobbyPlayers.map((player) => (
                    <div key={player.id} className="player-item">
                      <div 
                        className="player-color-indicator" 
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="player-name">{player.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="lobby-actions">
              <button 
                onClick={() => {
                  const currentPlayer = lobbyPlayers.find(p => p.id === localPlayerId);
                  if (currentPlayer) {
                    setShowColorPicker(true);
                  }
                }}
                className="change-color-button"
                style={{ marginBottom: '10px' }}
              >
                Cambiar Color
              </button>
              <button 
                onClick={handleStartGameFromLobby}
                className="start-button"
                disabled={lobbyPlayers.length < 2}
                style={{ 
                  opacity: lobbyPlayers.length < 2 ? 0.5 : 1,
                  cursor: lobbyPlayers.length < 2 ? 'not-allowed' : 'pointer'
                }}
              >
                {lobbyPlayers.length < 2 ? 'Esperando más jugadores...' : 'Start'}
              </button>
              <button 
                onClick={() => {
                  if (gameRef.current) {
                    const networkClient = gameRef.current.getNetworkClient();
                    if (networkClient) {
                      networkClient.disconnect();
                    }
                    gameRef.current.destroy();
                    gameRef.current = new Game('gameCanvas');
                  }
                  setCurrentView('menu');
                  setLobbyPlayers([]);
                  setLocalPlayerId(null);
                }}
                className="back-button"
                style={{ marginTop: '10px', background: '#666' }}
              >
                Volver al Menú
              </button>
            </div>
            
            {/* Modal de selección de color */}
            {showColorPicker && (
              <ColorPickerModal
                isOpen={showColorPicker}
                currentColor={lobbyPlayers.find(p => p.id === localPlayerId)?.color || '#ffffff'}
                usedColors={new Set(lobbyPlayers.map(p => p.color))}
                onClose={() => setShowColorPicker(false)}
                onConfirm={(color) => {
                  if (localPlayerId && gameRef.current) {
                    const networkClient = gameRef.current.getNetworkClient();
                    if (networkClient) {
                      networkClient.changeColor(localPlayerId, color);
                    }
                  }
                  setShowColorPicker(false);
                }}
              />
            )}
          </div>
        )}
        
        {currentView === 'game' && (
          <div className="game-hud">
            <div className="hud-top">
              <button 
                onClick={() => {
                  if (gameRef.current) {
                    gameRef.current.stop();
                    setCurrentView('menu');
                    setGameOverState(null);
                  }
                }}
                className="menu-button"
              >
                Menú
              </button>
              <button 
                onClick={handleRestart}
                className="restart-button"
              >
                Reiniciar
              </button>
              {gameRef.current?.isUsingNetwork() && (
                <div className="connection-status">
                  {gameRef.current?.getNetworkClient()?.getIsConnected() ? (
                    <span style={{ color: '#4CAF50' }}>● Conectado</span>
                  ) : (
                    <span style={{ color: '#f44336' }}>● Desconectado</span>
                  )}
                </div>
              )}
            </div>
            {boostState && (
              <div className="hud-bottom">
                <BoostBar 
                  charge={boostState.charge} 
                  active={boostState.active}
                  remaining={boostState.remaining}
                />
              </div>
            )}
          </div>
        )}

        {/* Modal de fin de partida */}
        {gameOverState && (
          <GameOverModal 
            gameState={gameOverState}
            onBackToMenu={handleBackToMenuFromGameOver}
          />
        )}
      </div>
    </div>
  );
}

export default App;

