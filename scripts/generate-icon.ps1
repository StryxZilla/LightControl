Add-Type -AssemblyName System.Drawing

$buildDir = "G:\Light Test\apps\desktop\build"
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
}

function Create-AppIconImage([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background clear
    $g.Clear([System.Drawing.Color]::Transparent)

    # Outer rounded rect / circle
    $margin = [int]($size * 0.04)
    $badgeRect = New-Object System.Drawing.Rectangle $margin, $margin, ($size - 2 * $margin), ($size - 2 * $margin)
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 13, 17, 23)) # #0d1117
    $g.FillEllipse($bgBrush, $badgeRect)
    $bgBrush.Dispose()

    # Outer gradient ring (Cyan -> Blue -> Purple -> Amber)
    $ringPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 56, 189, 248)), ([float]($size * 0.05)) # Cyan
    $ringRect = New-Object System.Drawing.Rectangle ($margin + [int]($size * 0.06)), ($margin + [int]($size * 0.06)), ($size - 2 * $margin - [int]($size * 0.12)), ($size - 2 * $margin - [int]($size * 0.12))
    $g.DrawEllipse($ringPen, $ringRect)
    $ringPen.Dispose()

    # Inner glow
    $glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 168, 85, 247)), ([float]($size * 0.03)) # Purple
    $glowRect = New-Object System.Drawing.Rectangle ($margin + [int]($size * 0.14)), ($margin + [int]($size * 0.14)), ($size - 2 * $margin - [int]($size * 0.28)), ($size - 2 * $margin - [int]($size * 0.28))
    $g.DrawEllipse($glowPen, $glowRect)
    $glowPen.Dispose()

    # Center Radiant 4-point LED Star
    $cx = [float]($size / 2.0)
    $cy = [float]($size / 2.0)
    $rOut = [float]($size * 0.28)
    $rIn = [float]($size * 0.08)

    $starPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $points = @(
        [System.Drawing.PointF]::new([float]$cx, [float]($cy - $rOut)),
        [System.Drawing.PointF]::new([float]($cx + $rIn), [float]($cy - $rIn)),
        [System.Drawing.PointF]::new([float]($cx + $rOut), [float]$cy),
        [System.Drawing.PointF]::new([float]($cx + $rIn), [float]($cy + $rIn)),
        [System.Drawing.PointF]::new([float]$cx, [float]($cy + $rOut)),
        [System.Drawing.PointF]::new([float]($cx - $rIn), [float]($cy + $rIn)),
        [System.Drawing.PointF]::new([float]($cx - $rOut), [float]$cy),
        [System.Drawing.PointF]::new([float]($cx - $rIn), [float]($cy - $rIn))
    )
    $starPath.AddPolygon($points)

    $starBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        [System.Drawing.PointF]::new([float]($cx - $rOut), [float]($cy - $rOut)),
        [System.Drawing.PointF]::new([float]($cx + $rOut), [float]($cy + $rOut)),
        ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)),
        ([System.Drawing.Color]::FromArgb(255, 59, 130, 246)) # Blue 500
    )
    $g.FillPath($starBrush, $starPath)
    $starBrush.Dispose()
    $starPath.Dispose()

    # Core Sparkle
    $coreBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $coreR = [float]($size * 0.05)
    $g.FillEllipse($coreBrush, ($cx - $coreR), ($cy - $coreR), (2 * $coreR), (2 * $coreR))
    $coreBrush.Dispose()

    $g.Dispose()
    return $bmp
}

# Generate 256x256 master PNG
$masterBmp = Create-AppIconImage 256
$pngPath = Join-Path $buildDir "icon.png"
$masterBmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved master PNG icon to: $pngPath"

# Generate multi-resolution Windows ICO (256, 48, 32, 16)
$sizes = @(256, 48, 32, 16)
$icoBitmaps = @()
$pngStreams = @()

foreach ($s in $sizes) {
    $bmp = Create-AppIconImage $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += $ms
    $bmp.Dispose()
}

$icoPath = Join-Path $buildDir "icon.ico"
$fs = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR Header
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type: 1 = ICO
$bw.Write([UInt16]$sizes.Count) # Count of images

# Calculate offset
$offset = 6 + ($sizes.Count * 16)

# Write ICONDIRENTRY for each size
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $w = if ($s -ge 256) { 0 } else { [byte]$s }
    $h = if ($s -ge 256) { 0 } else { [byte]$s }
    $len = [UInt32]$pngStreams[$i].Length

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)   # Color count (0 = 256+ colors)
    $bw.Write([byte]0)   # Reserved
    $bw.Write([UInt16]1) # Color planes
    $bw.Write([UInt16]32)# Bits per pixel
    $bw.Write([UInt32]$len) # Bytes in resource
    $bw.Write([UInt32]$offset) # Offset of resource
    $offset += $len
}

# Write image data
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bytes = $pngStreams[$i].ToArray()
    $bw.Write($bytes)
    $pngStreams[$i].Dispose()
}

$bw.Close()
$fs.Close()
$masterBmp.Dispose()

Write-Output "Saved Windows multi-resolution ICO icon to: $icoPath"
