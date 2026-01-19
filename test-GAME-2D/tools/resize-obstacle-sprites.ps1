param(
  [string]$InputDir = "test-GAME-2D/obstacle-types/Sprite",
  [string]$OutputDir = "test-GAME-2D/obstacle-types/Sprite/resized",
  [int]$TilesX = 3,
  [int]$TilesY = 3,
  [int]$TileSize = 64,
  [int]$Width = 0,
  [int]$Height = 0,
  [switch]$InPlace,
  [switch]$UseSpriteGrid,
  [switch]$FallbackToDefault
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InputDir)) {
  throw "InputDir introuvable: $InputDir"
}

Add-Type -AssemblyName System.Drawing

$resolvedOutput = if ($InPlace) { $InputDir } else { $OutputDir }
if (-not (Test-Path $resolvedOutput)) {
  New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
}

$spriteGridByFile = @{}
if ($UseSpriteGrid) {
  $obstacleRoot = Resolve-Path (Join-Path $InputDir "..")
  $jsonFiles = Get-ChildItem -Path $obstacleRoot -Filter *.json -File | Where-Object {
    $_.Name -ne "index.json"
  }

  function Get-SpriteFileName([string]$spriteKey) {
    if (-not $spriteKey) { return $null }
    if ($spriteKey.StartsWith("obstacle:")) {
      return ($spriteKey.Substring(9) + ".png")
    }
    return ($spriteKey + ".png")
  }

  function Register-Grid([string]$spriteKey, $grid) {
    if (-not $grid) { return }
    if (-not ($grid.tilesX -and $grid.tilesY)) { return }
    $fileName = Get-SpriteFileName $spriteKey
    if (-not $fileName) { return }
    $entry = @{
      tilesX = [int]$grid.tilesX
      tilesY = [int]$grid.tilesY
      tileSize = if ($grid.tileSize) { [int]$grid.tileSize } else { 0 }
    }
    if ($spriteGridByFile.ContainsKey($fileName)) {
      $existing = $spriteGridByFile[$fileName]
      if ($existing.tilesX -ne $entry.tilesX -or $existing.tilesY -ne $entry.tilesY -or $existing.tileSize -ne $entry.tileSize) {
        Write-Host "Conflit spriteGrid pour $fileName, on garde la premiere definition."
      }
      return
    }
    $spriteGridByFile[$fileName] = $entry
  }

  foreach ($jsonFile in $jsonFiles) {
    $json = Get-Content -Raw -Path $jsonFile.FullName | ConvertFrom-Json
    $appearance = $json.appearance
    if (-not $appearance) { continue }
    $appearanceGrid = $appearance.spriteGrid

    if ($appearance.spriteKey) {
      Register-Grid $appearance.spriteKey $appearanceGrid
    }

    if ($appearance.layers) {
      foreach ($layer in $appearance.layers) {
        $grid = if ($layer.spriteGrid) { $layer.spriteGrid } else { $appearanceGrid }
        Register-Grid $layer.spriteKey $grid
      }
    }
  }
}

$pngs = Get-ChildItem -Path $InputDir -Filter *.png -File
if (-not $pngs) {
  Write-Host "Aucun PNG trouve dans $InputDir"
  exit 0
}

foreach ($file in $pngs) {
  $srcPath = $file.FullName
  $destPath = if ($InPlace) { $srcPath } else { Join-Path $resolvedOutput $file.Name }

  $targetWidth = $null
  $targetHeight = $null
  if ($UseSpriteGrid) {
    $grid = $spriteGridByFile[$file.Name]
    if ($grid) {
      $tileSizeForSprite = if ($grid.tileSize -gt 0) { $grid.tileSize } else { $TileSize }
      $targetWidth = [int]$grid.tilesX * $tileSizeForSprite
      $targetHeight = [int]$grid.tilesY * $tileSizeForSprite
    } elseif (-not $FallbackToDefault) {
      Write-Host "SpriteGrid absent pour $($file.Name) -> ignore."
      continue
    }
  }

  if (-not $targetWidth -or -not $targetHeight) {
    $targetWidth = if ($Width -gt 0) { $Width } else { $TilesX * $TileSize }
    $targetHeight = if ($Height -gt 0) { $Height } else { $TilesY * $TileSize }
  }

  if ($targetWidth -le 0 -or $targetHeight -le 0) {
    throw "Dimensions invalides: ${targetWidth}x${targetHeight}"
  }

  $srcImg = [System.Drawing.Image]::FromFile($srcPath)
  $destBmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
  $gfx = [System.Drawing.Graphics]::FromImage($destBmp)
  $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gfx.DrawImage($srcImg, 0, 0, $targetWidth, $targetHeight)
  $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $gfx.Dispose()
  $destBmp.Dispose()
  $srcImg.Dispose()
}

Write-Host "Resize termine -> $resolvedOutput (${targetWidth}x${targetHeight})"
