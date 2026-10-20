# Яркость снимков без просмотра: средняя яркость и доля почти белых пикселей.
# Запуск: powershell -File scripts/luma.ps1 review/shots/smoke/*.jpg
# Переменная окружения LUMA_RECT="x0,y0,x1,y1" — считать только в прямоугольнике.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Files)
Add-Type -AssemblyName System.Drawing
foreach ($pat in $Files) {
  foreach ($f in (Get-ChildItem $pat)) {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $r = if ($env:LUMA_RECT) { $env:LUMA_RECT.Split(',') | ForEach-Object { [int]$_ } } else { @(0, 0, $bmp.Width, $bmp.Height) }
    $sum = 0.0; $white = 0; $n = 0
    for ($y = $r[1]; $y -lt $r[3]; $y += 4) {
      for ($x = $r[0]; $x -lt $r[2]; $x += 4) {
        $c = $bmp.GetPixel($x, $y)
        $l = 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
        $sum += $l; $n++
        if ($l -gt 235) { $white++ }
      }
    }
    $bmp.Dispose()
    '{0,-45} mean={1,6:N1}  white={2,5:N1}%' -f $f.Name, ($sum / $n), (100.0 * $white / $n)
  }
}
