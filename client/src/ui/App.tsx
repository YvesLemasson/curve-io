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

function App() {
  const [currentView, setCurrentView] = useState<'menu' | 'game' | 'matchmaking'>('menu');
  const [boostState, setBoostState] = useState<{ active: boolean; charge: number; remaining: number } | null>(null);
  const gameRef = useRef<Game | null>(null);

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

  // Función para iniciar el juego
  const handleStartGame = (useNetwork: boolean = false) => {
    if (gameRef.current) {
      // Si ya existe, destruirlo y crear uno nuevo
      if (gameRef.current.isUsingNetwork() !== useNetwork) {
        gameRef.current.destroy();
        gameRef.current = new Game('gameCanvas', useNetwork);
      }
      
      gameRef.current.init(4); // 4 jugadores
      gameRef.current.start();
      setCurrentView('game');
    }
  };

  // Función para reiniciar el juego
  const handleRestart = () => {
    if (gameRef.current) {
      gameRef.current.stop();
      gameRef.current.init(4);
      gameRef.current.start();
      setCurrentView('game');
    }
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
          pointerEvents: currentView === 'game' ? 'none' : 'auto'
        }}
      >
        {currentView === 'menu' && (
          <div className="main-menu">
            <h1>curve.io</h1>
            <p>Juego multijugador en tiempo real</p>
            <button 
              onClick={() => handleStartGame(false)}
              className="start-button"
            >
              Juego Local
            </button>
            <button 
              onClick={() => handleStartGame(true)}
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
        
        {currentView === 'game' && (
          <div className="game-hud">
            <div className="hud-top">
              <button 
                onClick={() => {
                  if (gameRef.current) {
                    gameRef.current.stop();
                    setCurrentView('menu');
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
      </div>
    </div>
  );
}

export default App;

