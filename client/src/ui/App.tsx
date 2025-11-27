// Componente principal de la aplicación React
// Maneja routing y estructura general de la UI

import { useState, useEffect, useRef } from 'react';
import { Game } from '../game/game';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState<'menu' | 'game' | 'matchmaking'>('menu');
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

  // Función para iniciar el juego
  const handleStartGame = () => {
    if (gameRef.current) {
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
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%',
          zIndex: 1
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
              onClick={handleStartGame}
              className="start-button"
            >
              Iniciar Juego
            </button>
            <div className="controls-info">
              <p>Controles:</p>
              <p>A / ← : Girar izquierda</p>
              <p>D / → : Girar derecha</p>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

