# Regenerate Android bitmap fallbacks from the existing Arcad View vector mark.
# Run on Windows: powershell -NoProfile -File scripts/generate-android-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$res = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../android/app/src/main/res'))
[xml]$vector = Get-Content -LiteralPath (Join-Path $res 'drawable/arcad_logo.xml') -Raw
$ns = 'http://schemas.android.com/apk/res/android'
$paths = @($vector.vector.path | ForEach-Object {
    $data = $_.GetAttribute('pathData', $ns)
    if ($data -notmatch '^M[\d,. LZ]+$') { throw 'Only the existing straight polygon mark is supported.' }
    $numbers = @([regex]::Matches($data, '\d+(?:\.\d+)?') | ForEach-Object { [single]::Parse($_.Value, [Globalization.CultureInfo]::InvariantCulture) })
    $points = for ($i=0; $i -lt $numbers.Count; $i+=2) { [Drawing.PointF]::new($numbers[$i], $numbers[$i+1]) }
    @{Color=[Drawing.ColorTranslator]::FromHtml($_.GetAttribute('fillColor', $ns)); Points=[Drawing.PointF[]]$points}
})
$navy = [Drawing.ColorTranslator]::FromHtml('#071a30')
function Save-Icon([string]$DestinationPath, [int]$Size, [string]$Kind) {
    $supersample = 4
    $bitmap = [Drawing.Bitmap]::new($Size*$supersample, $Size*$supersample)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.ScaleTransform($Size*$supersample/108.0, $Size*$supersample/108.0)
        if ($Kind -eq 'background') { $graphics.Clear($navy) }
        elseif ($Kind -in @('legacy','round')) {
            $background = [Drawing.Drawing2D.GraphicsPath]::new()
            $brush = [Drawing.SolidBrush]::new($navy)
            try {
                if ($Kind -eq 'round') { $background.AddEllipse(0,0,108,108) }
                else {
                    $background.AddArc(0,0,36,36,180,90); $background.AddArc(72,0,36,36,270,90)
                    $background.AddArc(72,72,36,36,0,90); $background.AddArc(0,72,36,36,90,90)
                    $background.CloseFigure()
                }
                $graphics.FillPath($brush,$background)
            } finally { $brush.Dispose(); $background.Dispose() }
            $graphics.TranslateTransform(-16.85,-12.3)
            $graphics.ScaleTransform(1.3,1.3)
        }
        if ($Kind -ne 'background') {
            foreach ($polygon in $paths) {
                $brush = [Drawing.SolidBrush]::new($polygon.Color)
                try { $graphics.FillPolygon($brush,$polygon.Points) } finally { $brush.Dispose() }
            }
        }
        $result = [Drawing.Bitmap]::new($Size,$Size)
        $output = [Drawing.Graphics]::FromImage($result)
        try {
            $output.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
            $output.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $output.DrawImage($bitmap,0,0,$Size,$Size)
            $result.Save($DestinationPath,[Drawing.Imaging.ImageFormat]::Png)
        } finally { $output.Dispose(); $result.Dispose() }
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}
$densities = @{ldpi=.75; mdpi=1; hdpi=1.5; xhdpi=2; xxhdpi=3; xxxhdpi=4}
foreach ($density in $densities.GetEnumerator()) {
    $directory = Join-Path $res ('mipmap-'+$density.Key)
    Save-Icon (Join-Path $directory 'ic_launcher.png') ([int](48*$density.Value)) 'legacy'
    Save-Icon (Join-Path $directory 'ic_launcher_round.png') ([int](48*$density.Value)) 'round'
    Save-Icon (Join-Path $directory 'ic_launcher_foreground.png') ([int](108*$density.Value)) 'foreground'
    Save-Icon (Join-Path $directory 'ic_launcher_background.png') ([int](108*$density.Value)) 'background'
}
Write-Output 'Generated 24 Arcad View Android bitmap icons from drawable/arcad_logo.xml.'
