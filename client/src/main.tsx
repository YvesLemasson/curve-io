// Punto de entrada del cliente - Arquitectura Híbrida
// React para UI compleja, Vanilla TS para el juego

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import App from './ui/App';
import { AuthCallback } from './auth/AuthCallback';
import './utils/testLoops'; // Cargar utilidades de testing (solo en desarrollo)

// Inicializar React UI
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

console.log('curve.io - Cliente iniciado (React UI + Vanilla TS Game)');

