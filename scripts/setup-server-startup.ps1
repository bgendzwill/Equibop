# Setup Customer Manager Sync Server Startup
$scriptName = "customer-server.ts"
$scriptPath = "d:\Skrypty\Equibop\scripts\$scriptName"
$startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$shortcutPath = [System.IO.Path]::Combine($startupFolder, "EquibopCustomerServer.lnk")

Write-Host "Setting up Customer Manager Sync Server..." -ForegroundColor Cyan

if (-not (Test-Path $scriptPath)) {
    Write-Error "Could not find server script at $scriptPath"
    exit 1
}

# Check for Bun
$bunPath = where.exe bun.exe 2>$null
if (-not $bunPath) {
    Write-Warning "Bun was not found in PATH. Please install Bun (https://bun.sh) or update the shortcut manually."
}

# Create Shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "//nologo `"$scriptPath\..\scripts\launch-invisible.vbs`""
$Shortcut.WorkingDirectory = "d:\Skrypty\Equibop"
$Shortcut.WindowStyle = 1 # Normal (wscript has no window anyway)
$Shortcut.IconLocation = "wscript.exe,0"
$Shortcut.Description = "Invisible Background Sync Server for Equibop Customer Manager"
$Shortcut.Save()

Write-Host "Success! Shortcut created in Startup folder:" -ForegroundColor Green
Write-Host "$shortcutPath"
Write-Host "The server will now start automatically when you log in."
Write-Host "To start it now, run: bun run $scriptPath" -ForegroundColor Yellow
