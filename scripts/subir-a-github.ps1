# Conecta este proyecto con tu repositorio de GitHub y sube los cambios.
#
# Antes de ejecutarlo, crea el repositorio VACIO en https://github.com/new
#   Nombre: coatzadrone-cl
#   NO marques "Add a README file"
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\subir-a-github.ps1 -Usuario TU-USUARIO
#
# La primera vez se abre una ventana de GitHub para iniciar sesion.
# Despues de eso, para publicar cambios basta con: git add . ; git commit -m "..." ; git push

param(
  [Parameter(Mandatory = $true)][string]$Usuario,
  [string]$Repositorio = "coatzadrone-cl"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$url = "https://github.com/$Usuario/$Repositorio.git"

if (git remote 2>$null | Select-String -Quiet '^origin$') {
  Write-Host "Actualizando el remoto 'origin' a $url"
  git remote set-url origin $url
} else {
  Write-Host "Agregando el remoto 'origin' -> $url"
  git remote add origin $url
}

Write-Host ""
Write-Host "Subiendo la rama main a GitHub..."
Write-Host "(si aparece una ventana de inicio de sesion, es normal: es la primera vez)"
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Listo. El repositorio quedo en: https://github.com/$Usuario/$Repositorio"
  Write-Host "Siguiente paso: conectar Cloudflare Pages -> docs/DEPLOY-CLOUDFLARE.md"
} else {
  Write-Host ""
  Write-Host "El push fallo. Causas mas comunes:"
  Write-Host "  - El repositorio todavia no existe en GitHub. Crealo en https://github.com/new"
  Write-Host "  - El nombre de usuario esta mal escrito."
  Write-Host "  - Se cancelo la ventana de inicio de sesion."
}
