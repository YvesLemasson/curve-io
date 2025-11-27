// Componente principal de la aplicación React
// Maneja routing y estructura general de la UI

import { useState, useEffect } from 'react';
import './App.css';

// TODO: Importar componentes cuando se creen
// import GameView from './components/GameView';
// import MainMenu from './components/MainMenu';
// import Matchmaking from './components/Matchmaking';

function App() {
  const [currentView, setCurrentView] = useState<'menu' | 'game' | 'matchmaking'>('menu');

  return (
    <div className="app">
      {/* Canvas del juego se montará aquí cuando se inicialice */}
      <canvas id="gameCanvas" style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        zIndex: 1
      }} />
      
      {/* UI Overlay - React maneja menús, HUD, etc. */}
      <div className="ui-overlay" style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        zIndex: 10,
        pointerEvents: currentView === 'game' ? 'none' : 'auto'
      }}>
        {currentView === 'menu' && (
          <div className="main-menu">
            <h1>curve.io</h1>
            <p>UI con React - Juego con Vanilla TS</p>
            {/* TODO: Componente MainMenu */}
          </div>
        )}
        
        {currentView === 'matchmaking' && (
          <div className="matchmaking">
            <h2>Buscando partida...</h2>
            {/* TODO: Componente Matchmaking */}
          </div>
        )}
        
        {currentView === 'game' && (
          <div className="game-hud">
            {/* HUD del juego (contador, ping, etc.) */}
            {/* TODO: Componente GameHUD */}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

