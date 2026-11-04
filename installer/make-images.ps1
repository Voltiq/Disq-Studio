# Draws the installer artwork in the Graphiq style:
#   sidebar.bmp  164 x 314  welcome / finish pages (Graphite, accent glow)
#   header.bmp   150 x 57   top of the other pages (Porcelain)
#
# Usage: powershell -NoProfile -File installer/make-images.ps1

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$accent = [System.Drawing.Color]::FromArgb(0x64, 0x57, 0xF0)
$accentHi = [System.Drawing.Color]::FromArgb(0x83, 0x79, 0xF4)
$accentLo = [System.Drawing.Color]::FromArgb(0x4F, 0x43, 0xD6)

function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    $p
}

# The app glyph: a lit accent tile with treemap blocks, as in public/app-icon.svg.
function Draw-Glyph($g, [float]$x, [float]$y, [float]$size) {
    $s = $size / 64
    $tile = New-RoundedRect ($x + 2 * $s) ($y + 2 * $s) (60 * $s) (60 * $s) (16 * $s)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF($x, $y)),
        (New-Object System.Drawing.PointF(($x + $size), ($y + $size))),
        $accentHi, $accentLo)
    $g.FillPath($brush, $tile)
    $blocks = @(
        @(13, 13, 22, 38, 5, 255),
        @(38, 13, 13, 18, 4, 184),
        @(38, 34, 13, 8, 3, 128),
        @(38, 45, 13, 6, 2.5, 82)
    )
    foreach ($b in $blocks) {
        $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($b[5], 255, 255, 255))
        $g.FillPath($white, (New-RoundedRect ($x + $b[0] * $s) ($y + $b[1] * $s) ($b[2] * $s) ($b[3] * $s) ($b[4] * $s)))
    }
}

function Save-Bmp($bitmap, $path) {
    # NSIS wants plain 24-bit bitmaps.
    $flat = New-Object System.Drawing.Bitmap($bitmap.Width, $bitmap.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($flat)
    $g.DrawImage($bitmap, 0, 0, $bitmap.Width, $bitmap.Height)
    $g.Dispose()
    $flat.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $flat.Dispose()
}

function New-Canvas($w, $h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    @($bmp, $g)
}

# ----- Sidebar -----
$bmp, $g = New-Canvas 164 314
$g.Clear([System.Drawing.Color]::FromArgb(0x0D, 0x0E, 0x11))
# Accent glow from the top right, like the app's background.
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(20, -150, 260, 300)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, $accent)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $accent))
$g.FillPath($glowBrush, $glow)
Draw-Glyph $g 24 40 56
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0xF1, 0xF2, 0xF4))
$muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0xAE, 0xB3, 0xBD))
$faint = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0x8A, 0x90, 0x9B))
$g.DrawString("Disq Studio", (New-Object System.Drawing.Font("Segoe UI Semibold", 15)), $white, 20, 110)
$g.DrawString("See what's filling`nyour drive.", (New-Object System.Drawing.Font("Segoe UI", 9.5)), $muted, 21, 142)
# A small treemap strip along the bottom, in the file-type colours.
$colors = @(0xF59A72, 0x2BB5A0, 0x6457F0, 0xE0B23A, 0x5BA8FF, 0xC9658A)
$widths = @(46, 30, 22, 16, 12, 8)
$px = 20
for ($i = 0; $i -lt $colors.Count; $i++) {
    $c = [System.Drawing.Color]::FromArgb(255, ($colors[$i] -shr 16) -band 255, ($colors[$i] -shr 8) -band 255, $colors[$i] -band 255)
    $g.FillPath((New-Object System.Drawing.SolidBrush($c)), (New-RoundedRect $px 262 ($widths[$i] - 2) 14 3))
    $px += $widths[$i]
}
$g.DrawString("Graphiq design", (New-Object System.Drawing.Font("Consolas", 7)), $faint, 20, 284)
$g.Dispose()
Save-Bmp $bmp (Join-Path $PSScriptRoot "sidebar.bmp")
$bmp.Dispose()

# ----- Header -----
$bmp, $g = New-Canvas 150 57
$g.Clear([System.Drawing.Color]::White)
Draw-Glyph $g 104 10 36
$g.Dispose()
Save-Bmp $bmp (Join-Path $PSScriptRoot "header.bmp")
$bmp.Dispose()

Write-Host "Wrote sidebar.bmp and header.bmp"
