# Script para conectar el repositorio local con GitHub
# Ejecutar después de crear el repositorio en GitHub

param(
    [Parameter(Mandatory=$true)]
    [string]$RepoUrl
)

Write-Host "🔗 Conectando repositorio local con GitHub..." -ForegroundColor Cyan

# Agregar remote
git remote add origin $RepoUrl

# Renombrar branch a main (si está en master)
git branch -M main

# Verificar
Write-Host "`n✅ Remote configurado:" -ForegroundColor Green
git remote -v

Write-Host "`n📤 Para hacer push, ejecuta:" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor White

