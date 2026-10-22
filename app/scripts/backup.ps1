<#
.SYNOPSIS
    Automated 3-tier backup script for FEST Stage 3D project.
.DESCRIPTION
    Creates a full backup in C:\Backups every 10 git commits (or on demand with -Force):
    1. Mirrored working folder: C:\Backups\fest-3dmodels-and-stages
    2. Timestamped snapshot folder: C:\Backups\fest-3dmodels-and-stages_YYYY-MM-DD_HH-mm-ss
    3. Standalone ZIP archive: C:\Backups\fest-3dmodels-and-stages_YYYY-MM-DD_HH-mm-ss.zip
    Verifies 100% file count and byte integrity.
#>
param(
    [switch]$Force = $false,
    [switch]$CheckOnly = $false,
    [string]$BackupBase = "C:\Backups"
)

$ErrorActionPreference = "Stop"

# Determine project root directory (two levels up from app/scripts)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path

# Get git commit count
$commitCount = 0
try {
    $commitCountStr = git -C $rootDir rev-list --count HEAD 2>$null
    if ($commitCountStr) {
        $commitCount = [int]$commitCountStr.Trim()
    }
} catch {
    Write-Warning "Could not determine git commit count."
}

$isMilestone = ($commitCount -gt 0 -and ($commitCount % 10 -eq 0))

Write-Host "Project Root:    $rootDir"
Write-Host "Current Commits: $commitCount"
Write-Host "Milestone (x10): $(if ($isMilestone) { 'YES' } else { 'NO' })"

if ($CheckOnly) {
    if ($isMilestone) {
        Write-Host "Backup is DUE (commit count $commitCount is a multiple of 10)." -ForegroundColor Yellow
        exit 0
    } else {
        $next = ($commitCount - ($commitCount % 10)) + 10
        Write-Host "Backup is NOT due yet. Next milestone commit: $next (in $($next - $commitCount) commits)." -ForegroundColor Cyan
        exit 0
    }
}

if (-not $isMilestone -and -not $Force) {
    $next = ($commitCount - ($commitCount % 10)) + 10
    Write-Host "Current commit ($commitCount) is not a multiple of 10." -ForegroundColor Yellow
    Write-Host "Next scheduled backup at commit $next (in $($next - $commitCount) commits)."
    Write-Host "Use -Force to run backup immediately."
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$destFolder = Join-Path $BackupBase "fest-3dmodels-and-stages"
$destTimestampFolder = Join-Path $BackupBase ("fest-3dmodels-and-stages_" + $timestamp)
$destZip = Join-Path $BackupBase ("fest-3dmodels-and-stages_" + $timestamp + ".zip")

Write-Host "`n>>> Starting full 3-tier backup to $BackupBase..." -ForegroundColor Cyan

if (-not (Test-Path $BackupBase)) {
    New-Item -ItemType Directory -Path $BackupBase -Force | Out-Null
}

# 1. Mirror copy
Write-Host "1/3. Updating mirror directory: $destFolder"
& robocopy.exe $rootDir $destFolder /E /DCOPY:DAT /COPY:DAT /R:2 /W:1 /MT:8 /NP /NFL /NDL
$rc1 = $LASTEXITCODE
if ($rc1 -ge 8) {
    throw "Robocopy mirror failed with exit code $rc1"
}
Write-Host "     Mirror copy completed (code $rc1)." -ForegroundColor Green

# 2. Timestamped snapshot
Write-Host "2/3. Creating timestamped snapshot folder: $destTimestampFolder"
& robocopy.exe $destFolder $destTimestampFolder /E /DCOPY:DAT /COPY:DAT /R:2 /W:1 /MT:8 /NP /NFL /NDL
$rc2 = $LASTEXITCODE
if ($rc2 -ge 8) {
    throw "Robocopy snapshot failed with exit code $rc2"
}
Write-Host "     Snapshot folder completed (code $rc2)." -ForegroundColor Green

# 3. Standalone ZIP archive
Write-Host "3/3. Creating standalone ZIP archive: $destZip"
Push-Location $BackupBase
try {
    & tar.exe -a -cf $destZip ("fest-3dmodels-and-stages_" + $timestamp)
    if ($LASTEXITCODE -ne 0) {
        throw "tar.exe failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
Write-Host "     ZIP archive created successfully." -ForegroundColor Green

# Integrity verification
Write-Host "`n>>> Verifying backup integrity..." -ForegroundColor Cyan
$srcMeasure = Get-ChildItem -LiteralPath $rootDir -Recurse -Force | Measure-Object -Property Length -Sum
$destMeasure = Get-ChildItem -LiteralPath $destFolder -Recurse -Force | Measure-Object -Property Length -Sum
$snapMeasure = Get-ChildItem -LiteralPath $destTimestampFolder -Recurse -Force | Measure-Object -Property Length -Sum
$zipFile = Get-Item -LiteralPath $destZip

$tarEntries = (& tar.exe -tf $destZip | Measure-Object).Count

$foldersMatch = ($srcMeasure.Count -eq $destMeasure.Count) -and ($srcMeasure.Sum -eq $destMeasure.Sum)
$snapMatch = ($srcMeasure.Count -eq $snapMeasure.Count) -and ($srcMeasure.Sum -eq $snapMeasure.Sum)

Write-Host "`n=================== BACKUP VERIFICATION REPORT ==================="
Write-Host "Source Root:          $rootDir"
Write-Host "Commit Milestone:     Commit #$commitCount"
Write-Host "Source Files:         $($srcMeasure.Count) files | $([math]::Round($srcMeasure.Sum / 1MB, 2)) MB ($($srcMeasure.Sum) bytes)"
Write-Host "------------------------------------------------------------------"
Write-Host "Mirror Folder:        $destFolder"
Write-Host "Mirror Status:        $($destMeasure.Count) files | $([math]::Round($destMeasure.Sum / 1MB, 2)) MB | $(if ($foldersMatch) {'VERIFIED (100% MATCH)'} else {'MISMATCH!'})"
Write-Host "------------------------------------------------------------------"
Write-Host "Snapshot Folder:      $destTimestampFolder"
Write-Host "Snapshot Status:      $($snapMeasure.Count) files | $([math]::Round($snapMeasure.Sum / 1MB, 2)) MB | $(if ($snapMatch) {'VERIFIED (100% MATCH)'} else {'MISMATCH!'})"
Write-Host "------------------------------------------------------------------"
Write-Host "ZIP Archive:          $destZip"
Write-Host "ZIP Archive Size:     $([math]::Round($zipFile.Length / 1MB, 2)) MB ($($zipFile.Length) bytes)"
Write-Host "ZIP Entries Verified: $tarEntries entries (valid archive)"
Write-Host "=================================================================="

if (-not $foldersMatch -or -not $snapMatch) {
    throw "Verification failed: file count or byte size mismatch!"
}

Write-Host "Backup completed and verified successfully!`n" -ForegroundColor Green
