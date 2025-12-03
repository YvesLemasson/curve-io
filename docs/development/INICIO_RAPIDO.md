# 🚀 Guía de Inicio Rápido - curve.io

## Problema: Error de Conexión al Servidor

Si ves el error `ERR_CONNECTION_REFUSED` o `xhr poll error`, significa que **el servidor no está corriendo**.

## ✅ Solución: Iniciar el Servidor

### Paso 1: Abrir una Terminal

Abre una nueva terminal en tu editor o en PowerShell/CMD.

### Paso 2: Navegar a la Carpeta del Servidor

```bash
cd server
```

### Paso 3: Iniciar el Servidor

```bash
npm run dev
```

Deberías ver un mensaje como:
```
🚀 Servidor curve.io corriendo en puerto 3001
📡 WebSocket disponible en ws://localhost:3001
```

### Paso 4: Verificar que Funciona

1. El servidor debe estar corriendo en **http://localhost:3001**
2. Puedes verificar visitando: http://localhost:3001/health
3. Deberías ver: `{"status":"ok","message":"curve.io server is running"}`

### Paso 5: Recargar el Cliente

Una vez que el servidor esté corriendo, recarga la página del cliente (F5 o Ctrl+R).

Deberías ver en la consola del navegador:
```
[NetworkClient] ✅ Conectado al servidor exitosamente
```

## 🔧 Solución de Problemas

### El servidor no inicia

1. **Verifica que Node.js esté instalado:**
   ```bash
   node --version
   ```
   Debería mostrar v18 o superior.

2. **Instala las dependencias:**
   ```bash
   cd server
   npm install
   ```

3. **Verifica que el puerto 3001 esté libre:**
   ```bash
   # En Windows PowerShell:
   netstat -ano | findstr :3001
   
   # Si hay algo corriendo, cierra ese proceso o cambia el puerto en server/src/index.ts
   ```

### El cliente no se conecta

1. **Verifica que el servidor esté corriendo** (ver arriba)
2. **Verifica la URL del servidor** en la consola del navegador
3. **Verifica que no haya errores en la consola del servidor**

## 📝 Notas Importantes

- **El servidor debe estar corriendo ANTES de intentar conectar el cliente**
- **Mantén la terminal del servidor abierta** mientras usas la aplicación
- **Para detener el servidor**, presiona `Ctrl+C` en la terminal donde está corriendo

## 🎯 Flujo Completo de Desarrollo

1. **Terminal 1 - Servidor:**
   ```bash
   cd server
   npm run dev
   ```

2. **Terminal 2 - Cliente (si es necesario):**
   ```bash
   cd client
   npm run dev
   ```

3. **Abrir el navegador** en http://localhost:3000

¡Listo! 🎉



