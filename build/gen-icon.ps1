Add-Type -AssemblyName System.Drawing

$sizes = 16, 24, 32, 48, 64, 128, 256, 512
$pngs = @()

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded amber square
    $amber = [System.Drawing.Color]::FromArgb(224, 164, 88)
    $brush = New-Object System.Drawing.SolidBrush($amber)
    $r = [Math]::Max(2, [int]($s * 0.18))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $w = $s - 1
    $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $path.AddArc($w - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
    $path.AddArc($w - 2 * $r, $w - 2 * $r, 2 * $r, 2 * $r, 0, 90)
    $path.AddArc(0, $w - 2 * $r, 2 * $r, 2 * $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)

    # Dark "M" + down arrow
    $ink = [System.Drawing.Color]::FromArgb(20, 22, 28)
    $inkBrush = New-Object System.Drawing.SolidBrush($ink)

    # M glyph
    $fontSize = [Math]::Max(6, $s * 0.52)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $mRect = New-Object System.Drawing.RectangleF(0, ($s * -0.02), ($s * 0.72), $s)
    $g.DrawString("M", $font, $inkBrush, $mRect, $fmt)

    # Down arrow on the right
    $ax = $s * 0.78          # arrow center x
    $at = $s * 0.30          # top of shaft
    $ab = $s * 0.68          # bottom point
    $aw = $s * 0.085         # shaft half-width
    $hw = $s * 0.17          # head half-width
    $hh = $s * 0.20          # head height
    $pts = @(
        (New-Object System.Drawing.PointF(($ax - $aw), $at)),
        (New-Object System.Drawing.PointF(($ax + $aw), $at)),
        (New-Object System.Drawing.PointF(($ax + $aw), ($ab - $hh))),
        (New-Object System.Drawing.PointF(($ax + $hw), ($ab - $hh))),
        (New-Object System.Drawing.PointF($ax, $ab)),
        (New-Object System.Drawing.PointF(($ax - $hw), ($ab - $hh))),
        (New-Object System.Drawing.PointF(($ax - $aw), ($ab - $hh)))
    )
    $g.FillPolygon($inkBrush, $pts)

    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += , @($s, $ms.ToArray())
    $bmp.Dispose()
}

# The 512px render becomes the PNG icon for macOS/Linux builds
foreach ($entry in $pngs) {
    if ($entry[0] -eq 512) {
        [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "icon.png"), $entry[1])
    }
}

# Assemble ICO container from sizes <= 256 (ICO spec limit)
$icoPngs = @()
foreach ($entry in $pngs) { if ($entry[0] -le 256) { $icoPngs += , $entry } }
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($out)
$bw.Write([UInt16]0)               # reserved
$bw.Write([UInt16]1)               # type: icon
$bw.Write([UInt16]$icoPngs.Count)  # count

$offset = 6 + 16 * $icoPngs.Count
foreach ($entry in $icoPngs) {
    $s = $entry[0]; $data = $entry[1]
    $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))  # width
    $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))  # height
    $bw.Write([Byte]0)             # palette
    $bw.Write([Byte]0)             # reserved
    $bw.Write([UInt16]1)           # planes
    $bw.Write([UInt16]32)          # bpp
    $bw.Write([UInt32]$data.Length)
    $bw.Write([UInt32]$offset)
    $offset += $data.Length
}
foreach ($entry in $icoPngs) { $bw.Write($entry[1]) }
$bw.Flush()

$icoPath = Join-Path $PSScriptRoot "icon.ico"
[System.IO.File]::WriteAllBytes($icoPath, $out.ToArray())
Write-Host "Wrote $icoPath ($($out.Length) bytes, $($icoPngs.Count) sizes) and icon.png (512px)"
