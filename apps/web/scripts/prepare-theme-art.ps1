param([string]$Root = 'apps/web/src/assets/cards/themes')

$allowedRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../src/assets/cards/themes')).Path
$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
if ($resolvedRoot -ne $allowedRoot -and -not $resolvedRoot.StartsWith($allowedRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Theme card preparation must stay within $allowedRoot"
}

Add-Type -AssemblyName System.Drawing
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$quality = [System.Drawing.Imaging.EncoderParameters]::new(1)
$quality.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
  [System.Drawing.Imaging.Encoder]::Quality, [long]88)

Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Filter '*.png' | ForEach-Object {
  $sourcePath = $_.FullName
  $targetPath = [System.IO.Path]::ChangeExtension($sourcePath, '.jpg')
  if (Test-Path -LiteralPath $targetPath) { throw "Target already exists: $targetPath" }
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $target = [System.Drawing.Bitmap]::new(600, 900)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, 0, 0, 600, 900)
    } finally { $graphics.Dispose() }
    $target.Save($targetPath, $encoder, $quality)
  } finally {
    $target.Dispose()
    $source.Dispose()
  }
  if ((Get-Item -LiteralPath $targetPath).Length -lt 10000) { throw "Output too small: $targetPath" }
  Remove-Item -LiteralPath $sourcePath
  Write-Output "Prepared $targetPath"
}
