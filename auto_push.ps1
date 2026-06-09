<#
.SYNOPSIS
    Auto-push: Watches the Dashboard_Bakso Ibu project for file changes
    and automatically commits & pushes to GitHub.

.DESCRIPTION
    Uses FileSystemWatcher to detect changes in the project directory.
    When a change is detected, waits a short debounce period, then
    stages all changes, commits with a timestamp message, and pushes.

.USAGE
    Run in PowerShell:  .\auto_push.ps1
    Stop with:          Ctrl+C
#>

$projectPath = "D:\Dashboard_Bakso Ibu"
$debounceSeconds = 10
$lastPushTime = [datetime]::MinValue

# Excluded patterns
$excludePatterns = @("node_modules", ".git", "package-lock.json", "auto_push.ps1")

function Should-Ignore($path) {
    foreach ($pattern in $excludePatterns) {
        if ($path -match [regex]::Escape($pattern)) { return $true }
    }
    return $false
}

function Push-Changes {
    $now = Get-Date
    $timeSinceLast = ($now - $script:lastPushTime).TotalSeconds

    if ($timeSinceLast -lt $debounceSeconds) {
        return
    }

    Set-Location $projectPath

    # Check if there are actual changes
    $status = git status --porcelain 2>&1
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "  [SKIP] No actual changes detected." -ForegroundColor DarkGray
        return
    }

    $timestamp = $now.ToString("yyyy-MM-dd HH:mm:ss")

    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Cyan
    Write-Host "  AUTO-PUSH triggered at $timestamp" -ForegroundColor Cyan
    Write-Host "  ========================================" -ForegroundColor Cyan

    # Stage all changes
    Write-Host "  [1/3] Staging changes..." -ForegroundColor Yellow
    git add -A 2>&1 | Out-Null

    # Commit
    $commitMsg = "auto-update: $timestamp"
    Write-Host "  [2/3] Committing: $commitMsg" -ForegroundColor Yellow
    $commitResult = git commit -m $commitMsg 2>&1
    Write-Host "  $commitResult" -ForegroundColor DarkGray

    # Push
    Write-Host "  [3/3] Pushing to origin/main..." -ForegroundColor Yellow
    $pushResult = git push origin main 2>&1
    Write-Host "  $pushResult" -ForegroundColor DarkGray

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Push successful!" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Push failed. Check your connection." -ForegroundColor Red
    }

    $script:lastPushTime = $now
    Write-Host ""
}

# ─── Banner ───
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   🍜  BAKSO IBU - Auto Push to GitHub  🍜   ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Monitoring: $projectPath" -ForegroundColor Cyan
Write-Host "  Remote:     https://github.com/MAliefRuslan/Dashboard_BaksoIbu.git" -ForegroundColor Cyan
Write-Host "  Debounce:   ${debounceSeconds}s" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Watching for changes... (Press Ctrl+C to stop)" -ForegroundColor Gray
Write-Host ""

# ─── FileSystemWatcher ───
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $projectPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $false
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor
                         [System.IO.NotifyFilters]::LastWrite -bor
                         [System.IO.NotifyFilters]::DirectoryName

# ─── Main Loop ───
try {
    while ($true) {
        $result = $watcher.WaitForChanged(
            [System.IO.WatcherChangeTypes]::All,
            5000  # timeout ms — check every 5s
        )

        if (-not $result.TimedOut) {
            $changedPath = $result.Name
            if (-not (Should-Ignore $changedPath)) {
                Write-Host "  [CHANGE] $changedPath ($($result.ChangeType))" -ForegroundColor DarkYellow

                # Debounce: wait a few seconds for additional changes to settle
                Start-Sleep -Seconds $debounceSeconds

                Push-Changes
            }
        }
    }
}
catch {
    # Ctrl+C or error
    Write-Host ""
    Write-Host "  Auto-push stopped." -ForegroundColor Yellow
}
finally {
    $watcher.Dispose()
    Write-Host "  Watcher disposed. Goodbye!" -ForegroundColor Gray
}
