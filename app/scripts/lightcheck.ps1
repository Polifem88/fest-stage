# Прогон вариантов освещения (каждый в отдельной загрузке) + замер яркости пола/стены.
# Запуск из app/: powershell -ExecutionPolicy Bypass -File scripts/lightcheck.ps1 [page] [variants...]
param([string]$Page = 'desktop', [Parameter(ValueFromRemainingArguments = $true)][string[]]$Variants)
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $Variants) { $Variants = @('hall', 'hall+nohaze', 'hall+noduty', 'hall+off') }
$out = 'review/shots/light'
New-Item -ItemType Directory -Force $out | Out-Null
Remove-Item "$out/*" -ErrorAction SilentlyContinue
foreach ($v in $Variants) { node scripts/smoke.mjs $Page $v $out | Select-String 'error' }
$rects = if ($Page -eq 'mobile') { @{ floor = '40,420,350,520'; wall = '60,250,330,380' } } else { @{ floor = '420,360,900,425'; wall = '450,180,850,300' } }
foreach ($k in 'floor', 'wall') {
  "${k}:"
  $env:LUMA_RECT = $rects[$k]
  powershell -ExecutionPolicy Bypass -File scripts/luma.ps1 "$out/*.jpg"
}
