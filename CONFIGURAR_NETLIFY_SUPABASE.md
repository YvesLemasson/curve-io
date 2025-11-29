# 🔧 Configurar Supabase para Netlify

Este error ocurre porque el dominio de Netlify (`curveio.netlify.app`) no está configurado en Supabase. Sigue estos pasos:

## 📋 Pasos para Configurar Supabase con Netlify

### 1. Agregar Redirect URLs en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Authentication** → **URL Configuration**
3. En la sección **Redirect URLs**, agrega:
   - `https://curveio.netlify.app/auth/callback`
   - `https://curveio.netlify.app/**` (wildcard para todas las rutas)
4. Haz clic en **Save**

### 2. Agregar Site URL (Opcional pero recomendado)

En la misma página de **URL Configuration**:
1. En **Site URL**, agrega: `https://curveio.netlify.app`
2. Esto ayuda con el manejo de sesiones

### 3. Configurar Variables de Entorno en Netlify

1. Ve a tu proyecto en [Netlify Dashboard](https://app.netlify.com)
2. Navega a **Site settings** → **Environment variables**
3. Agrega estas variables:

```
VITE_SUPABASE_URL=https://nujwbmtbbhyesosokggr.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

**Para obtener el anon key:**
- Ve a Supabase Dashboard → **Settings** → **API**
- Copia el valor de **anon public key**

### 4. Configurar Google OAuth (si usas Google Login)

Si usas autenticación con Google, también necesitas agregar el dominio de Netlify en Google Cloud Console:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Navega a **APIs & Services** → **Credentials**
3. Encuentra tu OAuth 2.0 Client ID
4. En **Authorized JavaScript origins**, agrega:
   - `https://curveio.netlify.app`
5. En **Authorized redirect URIs**, agrega:
   - `https://nujwbmtbbhyesosokggr.supabase.co/auth/v1/callback`
   - (Este es el callback de Supabase, no el de tu app)

### 5. Redeploy en Netlify

Después de configurar las variables de entorno:
1. Ve a **Deploys** en Netlify
2. Haz clic en **Trigger deploy** → **Deploy site**
3. O simplemente haz un push a tu repositorio para que se despliegue automáticamente

## ✅ Verificación

Después de configurar todo:

1. **Verifica las Redirect URLs en Supabase:**
   - Deberías ver `https://curveio.netlify.app/auth/callback` en la lista

2. **Verifica las variables de entorno en Netlify:**
   - Deberías ver `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

3. **Prueba el login:**
   - Intenta hacer login con Google en tu sitio de Netlify
   - Debería redirigir correctamente después del login

4. **Prueba el logout:**
   - El error 403 debería desaparecer
   - El logout debería funcionar correctamente

## 🔍 Solución de Problemas

### Error 403 en logout

- **Causa**: El dominio no está en las Redirect URLs de Supabase
- **Solución**: Agrega `https://curveio.netlify.app/**` a las Redirect URLs

### Error "Auth session missing"

- **Causa**: La sesión expiró o no se guardó correctamente
- **Solución**: El código ahora maneja este caso automáticamente, limpiando el estado local

### Login funciona pero logout no

- **Causa**: Falta el dominio en las Redirect URLs
- **Solución**: Agrega el dominio completo a las Redirect URLs en Supabase

## 📝 Notas Importantes

- **Redirect URLs**: Supabase necesita saber qué dominios están permitidos para redirigir después del login/logout
- **Site URL**: Ayuda a Supabase a saber cuál es tu dominio principal
- **Variables de entorno**: Netlify necesita las variables para que el cliente de Supabase funcione
- **Google OAuth**: Si usas Google, también necesitas configurar el dominio en Google Cloud Console

## 🎯 Resumen Rápido

1. ✅ Agregar `https://curveio.netlify.app/auth/callback` a Redirect URLs en Supabase
2. ✅ Agregar variables de entorno en Netlify (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`)
3. ✅ Configurar Google OAuth con el dominio de Netlify (si aplica)
4. ✅ Redeploy en Netlify

¡Listo! 🎉

