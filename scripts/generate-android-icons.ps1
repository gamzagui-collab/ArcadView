# Export all launcher/UI bitmap sizes from the selected metallic document mark.
# Windows: powershell -NoProfile -File scripts/generate-android-icons.ps1
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$master=[Drawing.Image]::FromFile((Join-Path $project 'branding/arcad-mark-metal-master.png'))
$navy=[Drawing.ColorTranslator]::FromHtml('#071a30')
function Save-Icon([string]$DestinationPath,[int]$Size,[string]$Kind){
 $factor=if($Size -lt 512){4}else{2}
 $bitmap=[Drawing.Bitmap]::new($Size*$factor,$Size*$factor)
 $g=[Drawing.Graphics]::FromImage($bitmap)
 try{
  $g.Clear([Drawing.Color]::Transparent)
  $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.ScaleTransform($Size*$factor/108.0,$Size*$factor/108.0)
  if($Kind -in @('legacy','round')){
   $clip=[Drawing.Drawing2D.GraphicsPath]::new()
   try{
    if($Kind -eq 'round'){$clip.AddEllipse(0,0,108,108)}
    else{$clip.AddArc(0,0,36,36,180,90);$clip.AddArc(72,0,36,36,270,90);$clip.AddArc(72,72,36,36,0,90);$clip.AddArc(0,72,36,36,90,90);$clip.CloseFigure()}
    $g.SetClip($clip)
   }finally{$clip.Dispose()}
  }
  $brush=[Drawing.SolidBrush]::new($navy)
  try{$g.FillRectangle($brush,0,0,108,108)}finally{$brush.Dispose()}
  if($Kind -ne 'background'){
   # The source emblem occupies ~73% of its square. A 72dp source image puts
   # its ~53dp emblem inside the central 66dp adaptive-icon safe zone.
   $rect=if($Kind -eq 'foreground'){[Drawing.RectangleF]::new(18,18,72,72)}else{[Drawing.RectangleF]::new(0,0,108,108)}
   $g.DrawImage($master,$rect)
  }
  $result=[Drawing.Bitmap]::new($Size,$Size)
  $output=[Drawing.Graphics]::FromImage($result)
  try{
   $output.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
   $output.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $output.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
   $output.DrawImage($bitmap,0,0,$Size,$Size)
   $result.Save($DestinationPath,[Drawing.Imaging.ImageFormat]::Png)
  }finally{$output.Dispose();$result.Dispose()}
 }finally{$g.Dispose();$bitmap.Dispose()}
}
try{
 $densities=@{ldpi=.75;mdpi=1;hdpi=1.5;xhdpi=2;xxhdpi=3;xxxhdpi=4}
 foreach($density in $densities.GetEnumerator()){
  $directory=Join-Path $project ('android/app/src/main/res/mipmap-'+$density.Key)
  Save-Icon (Join-Path $directory 'ic_launcher.png') ([int](48*$density.Value)) 'legacy'
  Save-Icon (Join-Path $directory 'ic_launcher_round.png') ([int](48*$density.Value)) 'round'
  Save-Icon (Join-Path $directory 'ic_launcher_foreground.png') ([int](108*$density.Value)) 'foreground'
  Save-Icon (Join-Path $directory 'ic_launcher_background.png') ([int](108*$density.Value)) 'background'
 }
 Save-Icon (Join-Path $project 'public/arcad-mark.png') 512 'tile'
 Save-Icon (Join-Path $project 'branding/play-store-icon.png') 512 'tile'
 Save-Icon (Join-Path $project 'branding/icon-only.png') 512 'legacy'
 Save-Icon (Join-Path $project 'branding/icon-foreground.png') 432 'foreground'
 Save-Icon (Join-Path $project 'branding/icon-background.png') 432 'background'
}finally{$master.Dispose()}
Write-Output 'Generated 24 Android density assets, the web mark and 4 branding exports.'
