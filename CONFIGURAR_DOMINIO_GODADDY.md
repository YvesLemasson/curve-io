# 🌐 Guía: Conectar Dominio GoDaddy (curve.pw) con Netlify

## 📋 Prerrequisitos

- ✅ Dominio `curve.pw` comprado en GoDaddy
- ✅ Sitio desplegado en Netlify (ej: `curveio.netlify.app`)
- ✅ Acceso al panel de GoDaddy
- ✅ Acceso al panel de Netlify

---

## 🚀 Paso 1: Agregar Dominio en Netlify

1. **Ve a Netlify:**
   - Abre [app.netlify.com](https://app.netlify.com)
   - Selecciona tu sitio (ej: `curveio`)

2. **Ir a Domain Management:**
   - Click en **Site settings** (⚙️) en el menú superior
   - Click en **Domain management** en el menú lateral

3. **Agregar dominio personalizado:**
   - Click en **"Add custom domain"**
   - Escribe: `curve.pw`
   - Click en **"Verify"** o **"Add domain"**

4. **Netlify te mostrará las instrucciones de DNS:**
   - Netlify te dará valores específicos para configurar
   - **IMPORTANTE**: Copia estos valores, los necesitarás en GoDaddy
   - Generalmente verás algo como:
     - **A Record**: `75.2.60.5` (o similar)
     - **CNAME Record**: `curve.pw` → `curveio.netlify.app`

5. **Si Netlify te pide verificar el dominio:**
   - Puede pedirte agregar un registro TXT para verificación
   - Sigue las instrucciones que te dé Netlify

---

## 🔧 Paso 2: Configurar DNS en GoDaddy

### Opción A: Usando el Panel de GoDaddy (Recomendado)

1. **Ir a la gestión de DNS:**
   - En el panel de GoDaddy, click en **"Dominio"** en el menú izquierdo
   - O busca **"Administrar el dominio"** en los enlaces rápidos
   - Click en **"DNS"** o **"Zona DNS"**

2. **Editar registros DNS:**
   - Busca la sección de **"Registros"** o **"Records"**
   - Verás una tabla con registros existentes

3. **Agregar/Editar registro A (para dominio raíz):**
   - Busca un registro **A** que apunte a `@` o `curve.pw`
   - Si existe, **edítalo**. Si no existe, **agrégalo**:
     - **Tipo**: `A`
     - **Nombre/Host**: `@` o `curve.pw` (depende de la interfaz)
     - **Valor/Dirección**: El valor que te dio Netlify (ej: `75.2.60.5`)
     - **TTL**: `600` (o el valor por defecto)
     - Click en **"Guardar"** o **"Save"**

4. **Agregar registro CNAME (opcional, para www):**
   - Si quieres que `www.curve.pw` también funcione:
     - **Tipo**: `CNAME`
     - **Nombre/Host**: `www`
     - **Valor**: `curveio.netlify.app` (o el valor que te dio Netlify)
     - **TTL**: `600`
     - Click en **"Guardar"**

5. **Eliminar registros conflictivos (si existen):**
   - Si hay registros A o CNAME antiguos que apuntan a otros lugares, elimínalos
   - Solo deja los que apuntan a Netlify

### Opción B: Si Netlify te da instrucciones específicas

- **Sigue exactamente las instrucciones que Netlify te muestre**
- Netlify puede usar diferentes métodos según el dominio:
  - **Método 1**: Registro A (dirección IP)
  - **Método 2**: CNAME (apunta a Netlify)
  - **Método 3**: Nameservers de Netlify (menos común)

---

## ⏱️ Paso 3: Esperar Propagación DNS

1. **Tiempo de propagación:**
   - Puede tardar desde **5 minutos hasta 48 horas**
   - Generalmente toma **15-30 minutos**

2. **Verificar propagación:**
   - Puedes usar herramientas como:
     - [whatsmydns.net](https://www.whatsmydns.net)
     - [dnschecker.org](https://dnschecker.org)
   - Busca `curve.pw` y verifica que apunte a Netlify

3. **En Netlify:**
   - Ve a **Domain management**
   - El dominio debería cambiar de estado a **"Verified"** o **"Active"**
   - Si dice **"Pending"**, espera un poco más

---

## 🔒 Paso 4: Configurar SSL/HTTPS (Automático)

1. **Netlify configura SSL automáticamente:**
   - Una vez que el DNS esté configurado, Netlify generará un certificado SSL
   - Esto puede tardar unos minutos

2. **Verificar SSL:**
   - En **Domain management**, deberías ver un candado 🔒
   - El certificado SSL se renueva automáticamente

---

## 🔄 Paso 5: Actualizar Variables de Entorno

### En Railway (Backend):

1. Ve a tu proyecto en Railway
2. **Settings** → **Variables**
3. **Edita** la variable `FRONTEND_URL`:
   - **Antes**: `https://curveio.netlify.app`
   - **Ahora**: `https://curve.pw`
4. **Guarda** los cambios
5. **Redeploy** el servicio (opcional, pero recomendado)

### En Supabase (si usas autenticación):

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. **Authentication** → **URL Configuration**
3. En **Redirect URLs**, agrega:
   - `https://curve.pw/auth/callback`
   - `https://curve.pw/**` (wildcard)
4. En **Site URL**, cambia a: `https://curve.pw`
5. **Save**

### En Google OAuth (si usas Google Login):

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Encuentra tu OAuth 2.0 Client ID
4. En **Authorized JavaScript origins**, agrega:
   - `https://curve.pw`
5. **Save**

---

## ✅ Verificación Final

1. **Probar el dominio:**
   - Abre `https://curve.pw` en tu navegador
   - Debería cargar tu sitio de Netlify

2. **Verificar SSL:**
   - Deberías ver el candado 🔒 en la barra de direcciones
   - La URL debe ser `https://` (no `http://`)

3. **Probar funcionalidades:**
   - Login/Logout (si usas autenticación)
   - Conexión con el backend (Railway)
   - Todas las funciones de tu app

---

## 🐛 Solución de Problemas

### El dominio no carga después de configurar DNS

**Posibles causas:**
- DNS aún no se ha propagado (espera más tiempo)
- Valores DNS incorrectos (verifica que sean exactos)
- Registros conflictivos en GoDaddy

**Solución:**
1. Verifica los valores DNS en GoDaddy
2. Usa [whatsmydns.net](https://www.whatsmydns.net) para ver la propagación
3. Espera hasta 48 horas (aunque generalmente es más rápido)

### Netlify dice "Domain not verified"

**Solución:**
1. Verifica que los registros DNS estén correctos
2. Si Netlify pidió un registro TXT, asegúrate de haberlo agregado
3. Espera unos minutos y haz clic en **"Verify"** de nuevo en Netlify

### Error de SSL/Certificado

**Solución:**
1. Espera unos minutos (Netlify genera el certificado automáticamente)
2. En Netlify, ve a **Domain management** → **HTTPS**
3. Si hay errores, Netlify te mostrará qué hacer

### El sitio carga pero no se conecta al backend

**Solución:**
1. Verifica que hayas actualizado `FRONTEND_URL` en Railway
2. Verifica que `VITE_SERVER_URL` esté configurada en Netlify
3. Haz un **Redeploy** en Netlify después de cambiar variables

---

## 📝 Resumen Rápido

1. ✅ Agregar `curve.pw` en Netlify → Domain management
2. ✅ Copiar valores DNS que te da Netlify
3. ✅ Configurar registros DNS en GoDaddy (A o CNAME)
4. ✅ Esperar propagación DNS (15-30 min generalmente)
5. ✅ Actualizar `FRONTEND_URL` en Railway a `https://curve.pw`
6. ✅ Actualizar Redirect URLs en Supabase (si usas auth)
7. ✅ Verificar que `https://curve.pw` funcione

---

## 🎯 Notas Importantes

- **No elimines** el dominio `curveio.netlify.app` de Netlify, puede seguir funcionando como respaldo
- **Mantén** ambos dominios configurados si quieres que ambos funcionen
- **El SSL es automático** en Netlify, no necesitas configurarlo manualmente
- **Los cambios de DNS pueden tardar**, sé paciente

¡Listo! 🎉 Tu dominio `curve.pw` debería estar funcionando con Netlify.

