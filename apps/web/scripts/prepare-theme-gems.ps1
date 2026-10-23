param([string]$Root = 'apps/web/src/assets/gems/themes')

$allowedRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../src/assets/gems/themes')).Path
$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
if ($resolvedRoot -ne $allowedRoot) { throw "Theme gem preparation must stay within $allowedRoot" }

Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath $resolvedRoot -File -Filter '*.png' | ForEach-Object {
  $sourcePath = $_.FullName
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  if ($source.Width -eq 128 -and $source.Height -eq 128) {
    $source.Dispose()
    return
  }
  $targetPath = "$sourcePath.optimized.png"
  $target = [System.Drawing.Bitmap]::new(128, 128, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.DrawImage($source, 0, 0, 128, 128)
    } finally { $graphics.Dispose() }
    $target.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $target.Dispose()
    $source.Dispose()
  }
  if ((Get-Item -LiteralPath $targetPath).Length -lt 1000) { throw "Output too small: $targetPath" }
  Remove-Item -LiteralPath $sourcePath
  Move-Item -LiteralPath $targetPath -Destination $sourcePath
  Write-Output "Prepared $sourcePath"
}
