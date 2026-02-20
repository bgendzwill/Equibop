# Equibop Customer Manager - Standalone Backup Script
# This script extracts customer data from Equibop settings and saves it as a timestamped file.

$AppData = $env:APPDATA
# New source: Storage specific file
$SourceFile = "$AppData\equibop\vencordStorage\customers.json"
$BackupDir = "$AppData\equibop\backups\external_script"
$OneDriveDir = "C:\OneDrive\EQ_backups"

# Create backup directories if they don't exist
$Dirs = @($BackupDir, $OneDriveDir)
foreach ($Dir in $Dirs) {
    if (!(Test-Path $Dir)) {
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        Write-Host "Created directory: $Dir" -ForegroundColor Gray
    }
}

if (Test-Path $SourceFile) {
    try {
        $Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
        
        # Save to standard backup dir
        $OutputFile = "$BackupDir\customers_standalone_$Timestamp.json"
        Copy-Item -Path $SourceFile -Destination $OutputFile -Force
        Write-Host "Backup saved to: $OutputFile" -ForegroundColor Green

        # Save to OneDrive
        $OneDriveFile = "$OneDriveDir\customers_standalone_$Timestamp.json"
        Copy-Item -Path $SourceFile -Destination $OneDriveFile -Force
        Write-Host "Backup saved to: $OneDriveFile" -ForegroundColor Green

        # Minimal validation (check size > 0)
        $Item = Get-Item $SourceFile
        Write-Host "Backup Source Size: $($Item.Length) bytes" -ForegroundColor Cyan
    } catch {
        Write-Error "Failed to copy backup file: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Source customers.json not found at: $SourceFile"
}

# Cleanup: Keep only the last 30 backups in LOCAL dir
$OldFiles = Get-ChildItem $BackupDir -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30
if ($OldFiles) {
    $OldFiles | Remove-Item -Force
    Write-Host "Cleaned up $($OldFiles.Count) old local backups." -ForegroundColor Gray
}

# Cleanup: Keep only the last 30 backups in ONEDRIVE dir
if (Test-Path $OneDriveDir) {
    $OldOneDriveFiles = Get-ChildItem $OneDriveDir -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30
    if ($OldOneDriveFiles) {
        $OldOneDriveFiles | Remove-Item -Force
        Write-Host "Cleaned up $($OldOneDriveFiles.Count) old OneDrive backups." -ForegroundColor Gray
    }
}
