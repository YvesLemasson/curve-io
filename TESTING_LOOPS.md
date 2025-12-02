# 🪙 Guía para Agregar Loops en Testing

Si tu balance de Loops muestra 0, puede ser porque:
1. **No tienes loops** - Tu usuario nunca ha recibido loops
2. **No se están cargando** - Hay un problema con la consulta (menos probable)

## 🚀 Forma Más Fácil: Desde la Consola del Navegador

### Paso 1: Abre la Consola
- Presiona `F12` o `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Option+I` (Mac)
- Ve a la pestaña "Console"

### Paso 2: Asegúrate de estar Autenticado
- Debes haber iniciado sesión con tu cuenta de prueba

### Paso 3: Agrega Loops
```javascript
// Agregar 1000 loops
await window.testLoops.addTestLoops(1000);

// Agregar una cantidad personalizada
await window.testLoops.addTestLoops(5000);

// Agregar con descripción personalizada
await window.testLoops.addTestLoops(2000, 'Loops para comprar items premium');
```

### Paso 4: Verifica tu Balance
```javascript
// Ver tu balance actual
await window.testLoops.getMyLoops();

// Obtener tu user ID
await window.testLoops.getMyUserId();
```

## 📝 Forma Alternativa: Desde Supabase SQL Editor

Si prefieres usar SQL directamente:

### 1. Obtener tu User ID
```sql
-- Buscar tu user_id por email
SELECT id, email, name 
FROM auth.users 
WHERE email = 'tu-email@ejemplo.com';
```

### 2. Agregar Loops
```sql
-- Reemplaza 'TU_USER_ID_AQUI' con el UUID que obtuviste
SELECT add_loops(
  'TU_USER_ID_AQUI'::UUID,
  1000,
  'reward',
  'test_bonus',
  'Loops de prueba para testing'
);
```

### 3. Verificar Balance
```sql
SELECT loops, total_earned, total_spent, last_updated
FROM public.user_currency
WHERE user_id = 'TU_USER_ID_AQUI'::UUID;
```

## 🔍 Verificar Transacciones

Para ver el historial de transacciones:

```sql
SELECT * 
FROM public.currency_transactions
WHERE user_id = 'TU_USER_ID_AQUI'::UUID
ORDER BY created_at DESC
LIMIT 20;
```

## ⚠️ Solución de Problemas

### Si `window.testLoops` no está disponible:
1. Asegúrate de estar en modo desarrollo (`npm run dev`)
2. Recarga la página
3. Verifica que no haya errores en la consola

### Si la función SQL `add_loops` no existe:
1. Ejecuta el script `server/loops-currency-schema.sql` en Supabase
2. Asegúrate de que la función esté creada correctamente

### Si el balance sigue en 0 después de agregar loops:
1. Verifica que el `user_id` sea correcto
2. Revisa la consola del navegador por errores
3. Verifica en Supabase que la transacción se haya registrado:
   ```sql
   SELECT * FROM public.currency_transactions 
   WHERE user_id = 'TU_USER_ID_AQUI'::UUID 
   ORDER BY created_at DESC LIMIT 5;
   ```

## 💡 Tips

- **Cantidades recomendadas para testing**: 1000-5000 loops
- **Los loops se agregan**, no se reemplazan (se suman al balance actual)
- **Cada transacción se registra** en `currency_transactions` para auditoría
- **El balance se actualiza en tiempo real** cuando usas `window.testLoops.addTestLoops()`

