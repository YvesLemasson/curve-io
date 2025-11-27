# 🚀 Configurar GitHub - Guía Rápida

## Pasos para subir tu proyecto a GitHub

### 1. Crear repositorio en GitHub

1. Ve a [github.com](https://github.com) e inicia sesión
2. Click en el botón **"+"** (arriba derecha) → **"New repository"**
3. Configura:
   - **Repository name**: `curve-io`
   - **Description**: "Juego multijugador en tiempo real - curve.io"
   - **Visibility**: Público o Privado (tu elección)
   - ⚠️ **NO marques** "Initialize with README" (ya tenemos uno)
   - ⚠️ **NO agregues** .gitignore ni licencia
4. Click en **"Create repository"**

### 2. Conectar tu repositorio local

**Opción A: Usar el script (Windows PowerShell)**
```powershell
.\setup-github.ps1 -RepoUrl "https://github.com/TU-USUARIO/curve-io.git"
```

**Opción B: Comandos manuales**
```bash
git remote add origin https://github.com/TU-USUARIO/curve-io.git
git branch -M main
git push -u origin main
```

⚠️ **Reemplaza `TU-USUARIO`** con tu nombre de usuario de GitHub

### 3. Verificar

Después del push, deberías ver todos tus archivos en GitHub.

## ✅ Listo

Una vez configurado, cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

## 🔐 Autenticación

Si GitHub te pide autenticación:
- **Token Personal**: Ve a GitHub Settings → Developer settings → Personal access tokens
- O usa **GitHub CLI**: `gh auth login`

