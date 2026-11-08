Add-Type -AssemblyName System.Drawing

function Create-AppIcon {
    param(
        [int]$size,
        [string]$outputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Background (#090a0f)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 9, 10, 15))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Emerald rounded border (#10b981)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), ($size * 0.04))
    $rect = New-Object System.Drawing.Rectangle(
        [int]($size * 0.05),
        [int]($size * 0.05),
        [int]($size * 0.9),
        [int]($size * 0.9)
    )
    # Draw rounded rect or rect
    $g.DrawRectangle($borderPen, $rect)

    # Dumbbell graphic
    $emeraldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $silverBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 209, 213, 219))

    # Center handle bar
    $handleHeight = [int]($size * 0.08)
    $handleWidth = [int]($size * 0.5)
    $handleX = [int](($size - $handleWidth) / 2)
    $handleY = [int](($size - $handleHeight) / 2)
    $g.FillRectangle($silverBrush, $handleX, $handleY, $handleWidth, $handleHeight)

    # Left plates
    $outerPlateW = [int]($size * 0.08)
    $outerPlateH = [int]($size * 0.45)
    $g.FillRectangle($emeraldBrush, [int]($handleX - $outerPlateW * 1.5), [int](($size - $outerPlateH) / 2), $outerPlateW, $outerPlateH)

    $innerPlateW = [int]($size * 0.06)
    $innerPlateH = [int]($size * 0.35)
    $g.FillRectangle($whiteBrush, [int]($handleX - $innerPlateW * 0.5), [int](($size - $innerPlateH) / 2), $innerPlateW, $innerPlateH)

    # Right plates
    $g.FillRectangle($emeraldBrush, [int]($handleX + $handleWidth + $outerPlateW * 0.5), [int](($size - $outerPlateH) / 2), $outerPlateW, $outerPlateH)
    $g.FillRectangle($whiteBrush, [int]($handleX + $handleWidth - $innerPlateW * 0.5), [int](($size - $innerPlateH) / 2), $innerPlateW, $innerPlateH)

    # Save
    $dir = Split-Path $outputPath
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bitmap.Dispose()
    Write-Host "Created icon: $outputPath ($size x $size)"
}

Create-AppIcon -size 512 -outputPath "F:\workout\public\icons\icon-512.png"
Create-AppIcon -size 192 -outputPath "F:\workout\public\icons\icon-192.png"
Create-AppIcon -size 180 -outputPath "F:\workout\public\icons\apple-touch-icon.png"
Create-AppIcon -size 32  -outputPath "F:\workout\public\icons\favicon-32.png"

# Also copy to root public for direct access
Copy-Item "F:\workout\public\icons\icon-192.png" "F:\workout\public\icon-192.png"
Copy-Item "F:\workout\public\icons\icon-512.png" "F:\workout\public\icon-512.png"
