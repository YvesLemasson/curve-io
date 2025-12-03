import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // Eliminar console.log y debugger en producción
    minify: 'esbuild', // esbuild es más rápido que terser y viene incluido
  },
  esbuild: {
    // Eliminar TODOS los console.* en producción (log, warn, info, debug)
    // Solo mantener console.error para errores críticos
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // Alternativa más agresiva: eliminar también console.error
    // drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
  },
}));

