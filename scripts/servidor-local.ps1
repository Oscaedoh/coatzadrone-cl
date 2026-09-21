# Servidor estatico local para previsualizar el sitio.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\servidor-local.ps1
# Luego abre http://localhost:8899
param([string]$Root = (Split-Path -Parent $PSScriptRoot), [int]$Port = 8899)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"
$mime = @{ ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8"; ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".webp"="image/webp"; ".ico"="image/x-icon"; ".pdf"="application/pdf"; ".woff2"="font/woff2"; ".txt"="text/plain; charset=utf-8"; ".xml"="application/xml"; ".webmanifest"="application/manifest+json" }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $Root $rel
    if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (-not (Test-Path $path -PathType Leaf)) {
      $alt = "$path.html"
      if (Test-Path $alt -PathType Leaf) { $path = $alt }
    }
    if (Test-Path $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = $ct
      $ctx.Response.Headers.Add("Access-Control-Allow-Origin","*")
      $ctx.Response.Headers.Add("Cache-Control","no-store")
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $ctx.Response.ContentLength64 = $b.Length
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch { Write-Host "ERR: $($_.Exception.Message)" }
}
