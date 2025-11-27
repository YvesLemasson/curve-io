// Punto de entrada del cliente - Arquitectura Híbrida
// React para UI compleja, Vanilla TS para el juego

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';

// Inicializar React UI
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('curve.io - Cliente iniciado (React UI + Vanilla TS Game)');

