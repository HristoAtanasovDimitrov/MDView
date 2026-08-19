Add-Type -AssemblyName System.Drawing
$ico = New-Object System.Drawing.Icon((Join-Path $PSScriptRoot 'icon.ico'), 256, 256)
$bmp = $ico.ToBitmap()
$bmp.Save((Join-Path $PSScriptRoot 'icon-256.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "ok"
